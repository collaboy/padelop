import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

const DAY_CONTEXT: Record<string, string> = {
  match:    "today is a match day — the player needs pre-match carbs and protein, and a recovery meal within 30 min of the match",
  recovery: "today is a recovery day after a match — anti-inflammatory foods, high protein, easy on heavy carbs",
  training: "today is a training day — balanced nutrition with good protein and complex carbs throughout the day",
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  let body: { meals: Array<{ time: string; description: string }>; dayType: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { meals, dayType } = body;
  if (!meals?.length) {
    return NextResponse.json({ error: "no_meals" }, { status: 400 });
  }

  const context = DAY_CONTEXT[dayType] ?? DAY_CONTEXT.training;
  const mealList = meals.map(m => `${m.time}: ${m.description}`).join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string;
  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `You are a padel sports nutritionist. Evaluate how well this player's meals align with what a padel player should eat today.

Context: ${context}

Meals logged:
${mealList}

Give a score from 0–100 (100 = perfectly optimised for a padel player, 0 = completely off). Then write ONE honest sentence (under 20 words) — what they did well or what was missing. Be direct and specific.

Respond with ONLY valid JSON, no markdown: {"score": number, "insight": "string"}`,
      }],
    });
    raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  } catch (err) {
    console.error("nutrition-analysis:", err);
    return NextResponse.json({ error: "api_error" }, { status: 502 });
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: "parse_error" }, { status: 422 });
  }
}
