import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: true }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { dayType, drillTag, matchTime, matchClub, recentResults, strengths, weaknesses } = body;

  const context: string[] = [];
  if (dayType === "match") {
    context.push(`Today is match day.${matchTime ? ` The match is at ${matchTime}` : ""}${matchClub ? ` at ${matchClub}` : ""}.`);
  } else if (dayType === "recovery") {
    context.push("You played yesterday — today is a recovery day.");
  } else {
    context.push("Today is a training day.");
  }
  if (drillTag) context.push(`Current focus area: ${drillTag}.`);
  if (recentResults?.length) context.push(`Recent results: ${recentResults.slice(0, 3).join(", ")}.`);
  if (strengths?.length) context.push(`Strengths: ${strengths.slice(0, 2).join(", ")}.`);
  if (weaknesses?.length) context.push(`Working on: ${weaknesses.slice(0, 2).join(", ")}.`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are a personal padel coach. Write a short, punchy pep talk (4–6 sentences, spoken aloud in about 30 seconds) for a recreational padel player. It should feel personal and energetic — not generic.

Context:
${context.join("\n")}

Write only the pep talk text, no preamble, no quotes. Use "you" and "your". Keep it tight and motivating.`,
      }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: true }, { status: 500 });
  }
}
