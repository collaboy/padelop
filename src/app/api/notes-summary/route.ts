import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!checkRateLimit(`notes-summary:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many requests — please try again in a bit." }, { status: 429 });
  }

  let body: { notes: Array<{ date: string; text: string }> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { notes } = body;
  if (!notes?.length) {
    return NextResponse.json({ error: "no_notes" }, { status: 400 });
  }

  const noteList = notes.map(n => `${n.date}: ${n.text}`).join("\n\n");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let sections: { title: string; text: string }[] = [];
  let title = "";
  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `You are a padel performance coach. Below are a player's own match notes, in chronological order.

${noteList}

Organize what you notice into 3-5 distinct themes (e.g. recurring strengths, recurring weaknesses, specific opponents or situations that come up more than once, trends over time, mental/tactical patterns — pick whichever themes actually fit what's in the notes, don't force ones that don't apply). For each theme, write a short, punchy title (2-4 words) and a body of 2-3 sentences. Be specific and reference concrete details (names, shots, situations) from the notes. Do not invent anything not supported by the notes.

Also write one overall title (3-6 words) for this whole report, capturing the single most notable takeaway across all the themes.

Respond with ONLY valid JSON, no markdown fences: {"title": "string", "sections": [{"title": "string", "text": "string"}, ...]}`,
      }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    title = typeof parsed.title === "string" ? parsed.title : "";
  } catch (err) {
    console.error("notes-summary:", err);
    return NextResponse.json({ error: "api_error" }, { status: 502 });
  }

  if (!sections.length) return NextResponse.json({ error: "empty_summary" }, { status: 422 });
  return NextResponse.json({ title, sections });
}
