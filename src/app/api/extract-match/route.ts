import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const MAX_BYTES = 4.5 * 1024 * 1024; // 4.5 MB decoded limit

export async function POST(req: NextRequest) {
  let body: { image: string; mediaType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { image, mediaType } = body;

  if (!image || !mediaType) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Validate media type
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) {
    return NextResponse.json({ error: "unsupported_type", message: "Please upload a JPEG, PNG, or WebP image." }, { status: 415 });
  }

  // Check decoded size — base64 encodes 3 bytes per 4 chars
  const decodedBytes = (image.length * 3) / 4;
  if (decodedBytes > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", message: "Image is too large. Please use a screenshot under 4.5 MB." }, { status: 413 });
  }

  let raw: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: image },
          },
          {
            type: "text",
            text: `You are a padel match assistant. Today's date is ${new Date().toISOString().slice(0, 10)}.

Analyse this screenshot. Determine if it shows a padel match booking, schedule confirmation, WhatsApp/group message about a padel match, or any padel/racket sports related communication.

If the image is NOT related to a padel or racket sports match (random photo, meme, unrelated content, etc.), respond with exactly this JSON:
{"error":"not_relevant","message":"This doesn't look like a padel match confirmation. Please upload a screenshot of your match booking or group message."}

If it IS related, extract these fields (null if not found):
- date: YYYY-MM-DD. Resolve relative dates (e.g. "tomorrow", "Saturday") using today's date above.
- time: HH:MM 24h format
- player_1: first player name mentioned
- player_2: second player name mentioned
- player_3: third player name mentioned (null if not found)
- player_4: fourth player name mentioned (null if not found)
- club: venue or club name
- court: court number or name

List players in the order they appear. Do not attempt to assign teams.

Respond with ONLY valid JSON, no markdown, no explanation.`,
          },
        ],
      }],
    });

    raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json({ error: "api_error", message: "Something went wrong. Please try again." }, { status: 502 });
  }

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  try {
    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "parse_error", message: "Couldn't read the screenshot clearly. Please try a cleaner image." }, { status: 422 });
  }
}
