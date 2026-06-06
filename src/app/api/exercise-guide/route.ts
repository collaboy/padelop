import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const { title, tag, context, subtitle } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a padel performance coach. Write a 3-step exercise guide for: "${title}"${subtitle ? ` (${subtitle})` : ""}.
${tag ? `Focus area: ${tag}` : ""}
The player is ${context === "court" ? "at a padel court with a partner" : "training solo — at home, gym, or outdoors without a court"}.

Rules:
- Each step must be concrete and immediately actionable — no vague instructions
- Include specific reps, sets, or duration for each step
- The cue is one sentence: what to focus on physically or mentally
- Solo steps must not require a court or partner

Respond with ONLY this JSON, no markdown:
{"steps":[{"step":"exercise name","cue":"one sentence physical or mental focus cue","reps":"sets/reps/duration"},{"step":"...","cue":"...","reps":"..."},{"step":"...","cue":"...","reps":"..."}]}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "api_error", message: msg }, { status: 502 });
  }
}
