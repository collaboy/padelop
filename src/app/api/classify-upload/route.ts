import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

const MAX_BYTES = 4.5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: true, message: "API key not configured." }, { status: 503 });
  }

  let body: { image: string; mediaType: string; forceCategory?: string; hint?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: true, message: "Invalid request." }, { status: 400 });
  }

  const { image, mediaType, forceCategory, hint } = body;
  if (!image || !mediaType) return NextResponse.json({ error: true }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType))
    return NextResponse.json({ error: true, message: "Please upload a JPEG, PNG, or WebP image." }, { status: 415 });
  if ((image.length * 3) / 4 > MAX_BYTES)
    return NextResponse.json({ error: true, message: "Image too large (max 4.5 MB)." }, { status: 413 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: image },
          },
          {
            type: "text",
            text: forceCategory
              ? `Extract structured data from this image for a padel fitness app. Today is ${new Date().toISOString().slice(0, 10)}. The category is "${forceCategory}".

Return ONLY valid JSON:
{
  "category": "${forceCategory}",
  "label": "one short sentence describing what you see",
  "confidence": "high" | "medium" | "low",
  "data": ${forceCategory === "match_schedule"
    ? `{ "date": "YYYY-MM-DD or empty", "time": "HH:MM or empty", "club": "", "court": "", "player_1": "", "player_2": "", "player_3": "", "player_4": "" }`
    : forceCategory === "meal"
    ? `{ "description": "what the food is", "meal_type": "breakfast|lunch|dinner|snack|pre-match|post-match" }`
    : forceCategory === "gear"
    ? `{ "type": "racket|shoes|bag|other", "name": "", "brand": "" }`
    : forceCategory === "match_result"
    ? `{ "result": "win|loss|draw", "score": "", "opponent_names": "" }`
    : `{}`}
}`
              : `Analyse this image for a padel fitness app. Today is ${new Date().toISOString().slice(0, 10)}.${hint === "post-match" ? "\n\nContext: the user played a match today or yesterday. If this image could be a score, result, or post-game screenshot, prefer classifying it as match_result." : ""}

Classify it as one of:
- "match_schedule" — a booking, calendar invite, or WhatsApp message about an UPCOMING match
- "meal" — food, a plate, restaurant dish, or nutrition label
- "gear" — a padel racket, shoes, bag, or sports equipment
- "match_result" — a scoreboard, match result screenshot, or post-game summary
- "unknown" — anything else

Return ONLY valid JSON:
{
  "category": "match_schedule" | "meal" | "gear" | "match_result" | "unknown",
  "label": "one short sentence describing what you see",
  "confidence": "high" | "medium" | "low",
  "data": {
    // match_schedule: { "date": "YYYY-MM-DD or empty", "time": "HH:MM or empty", "club": "", "court": "", "player_1": "", "player_2": "", "player_3": "", "player_4": "" }
    // meal: { "description": "what the food is", "meal_type": "breakfast|lunch|dinner|snack|pre-match|post-match" }
    // gear: { "type": "racket|shoes|bag|other", "name": "", "brand": "" }
    // match_result: { "result": "win|loss|draw", "score": "", "opponent_names": "" }
    // unknown: {}
  }
}`,
          },
        ],
      }],
    });
    raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  } catch (err) {
    return NextResponse.json({ error: true, message: `Analysis failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }

  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: true, message: "Couldn't parse the image. Please try again." }, { status: 422 });
  }
}
