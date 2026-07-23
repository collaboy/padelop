"use client";

import React, { useState } from "react";
import { loadScoreHistory, type ReviewEntry, type ScoreSnapshot } from "@/lib/scoring";

type TrainingEntry = { ts: string; sessionType: string[]; drillFocus: string[]; duration: string; intensity: string };

export default function InsightsContent() {
  const [featuredIdx, setFeaturedIdx] = useState(() => Math.floor(Math.random() * 8));

  const reviews: ReviewEntry[] = (() => { try { const raw = localStorage.getItem("padelop:match-reviews"); return raw ? JSON.parse(raw) as ReviewEntry[] : []; } catch { return []; } })();

  let habitDates = new Set<string>();
  try {
    const habits: { date: string }[] = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
    habitDates = new Set(habits.map(h => h.date));
  } catch {}
  const cur = new Date();
  if (!habitDates.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  let streak = 0;
  while (habitDates.has(cur.toISOString().slice(0, 10))) { streak++; cur.setDate(cur.getDate() - 1); }

  let partnerCount = 0;
  try {
    const allMatches: { player_2?: string }[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
    partnerCount = new Set(allMatches.map(m => m.player_2).filter(Boolean)).size;
  } catch {}

  let tournamentCount = 0;
  try {
    const t = JSON.parse(localStorage.getItem("padelop:tournaments") || "null");
    tournamentCount = typeof t?.count === "number" ? t.count : 0;
  } catch {}

  let trainingSessions: TrainingEntry[] = [];
  try {
    const raw = localStorage.getItem("padelop:training-logs");
    trainingSessions = raw ? (JSON.parse(raw) as TrainingEntry[]).sort((a, b) => b.ts.localeCompare(a.ts)) : [];
  } catch {}

  const history: ScoreSnapshot[] = loadScoreHistory();

  const wins = reviews.filter(r => r.result === "win").length;
  const losses = reviews.filter(r => r.result === "loss").length;
  const last5 = [...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
  const last5Wins = last5.filter(r => r.result === "win").length;
  const topWellDone = (() => {
    const counts: Record<string, number> = {};
    reviews.flatMap(r => r.wellDone ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
  })();
  const topImprove = (() => {
    const counts: Record<string, number> = {};
    reviews.flatMap(r => r.improved ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
  })();

  const deduped = Object.values(
    history.reduce((acc, s) => { acc[s.date] = s; return acc; }, {} as Record<string, ScoreSnapshot>)
  ).sort((a, b) => a.date.localeCompare(b.date));
  const dow = (new Date().getDay() + 6) % 7;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - dow);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const thisWeekSnaps = deduped.filter(s => s.date >= weekStartStr);
  const lastWeekSnaps = deduped.filter(s => s.date >= lastWeekStartStr && s.date < weekStartStr);
  const avgSnap = (arr: ScoreSnapshot[]) => arr.length ? Math.round(arr.reduce((s, x) => s + x.overall, 0) / arr.length) : null;
  const thisWeekAvg = avgSnap(thisWeekSnaps);
  const lastWeekAvg = avgSnap(lastWeekSnaps);

  const pool: { label: string; body: string }[] = [
    reviews.length >= 3 && wins + losses > 0
      ? { label: "Win rate", body: `You've won ${wins} out of ${wins + losses} recorded matches — a ${Math.round((wins / (wins + losses)) * 100)}% win rate. ${wins > losses ? "Keep it going." : "Every loss is data. Use it."}` }
      : null,
    last5.length >= 3
      ? { label: "Recent form", body: `In your last ${last5.length} matches you won ${last5Wins}. ${last5Wins >= 3 ? "Strong run — confidence should be high going into your next game." : last5Wins === 0 ? "Tough stretch. Look back at what you improved on and build from there." : "Mixed results — small consistency gains will tip the balance."}` }
      : null,
    topWellDone
      ? { label: "Your strength", body: `"${topWellDone[0]}" is the thing you've done well in most often — flagged across ${topWellDone[1]} match${topWellDone[1] > 1 ? "es" : ""}. That's your weapon. Keep sharpening it.` }
      : null,
    topImprove
      ? { label: "Your focus area", body: `"${topImprove[0]}" is the area you've logged as needing work most — ${topImprove[1]} time${topImprove[1] > 1 ? "s" : ""}. Targeted practice on this one will move your game the fastest.` }
      : null,
    streak > 0
      ? { label: "Streak", body: streak >= 7 ? `${streak} days and counting. A week-plus streak means habits are forming — that's where real gains live.` : streak >= 3 ? `${streak}-day streak. You're building momentum. Don't break the chain.` : `${streak} day${streak > 1 ? "s" : ""} in a row. Small start, big potential — log tomorrow and keep it going.` }
      : null,
    partnerCount >= 2
      ? { label: "Partners", body: `You've played with ${partnerCount} different partners. Variety in partners exposes you to different styles and speeds up your adaptability on court.` }
      : null,
    trainingSessions.length > 0
      ? { label: "Training", body: `${trainingSessions.length} training session${trainingSessions.length > 1 ? "s" : ""} logged so far. Players who train consistently between matches typically improve 2–3× faster than those who only play.` }
      : null,
    thisWeekAvg !== null && lastWeekAvg !== null
      ? (() => {
          const band = (n: number) => n >= 85 ? "Strong" : n >= 75 ? "Good" : n >= 65 ? "Steady" : "Low";
          const thisLabel = band(thisWeekAvg);
          const lastLabel = band(lastWeekAvg);
          const avgPillar = (snaps: ScoreSnapshot[], key: keyof ScoreSnapshot) => snaps.length ? snaps.reduce((a, s) => a + (s[key] as number), 0) / snaps.length : 0;
          const pillars = ["recovery", "nutrition", "training", "wellbeing"] as const;
          const pillarNames: Record<string, string> = { recovery: "Recovery", nutrition: "Nutrition", training: "Training", wellbeing: "Wellbeing" };
          const deltas = pillars.map(p => ({ p, delta: avgPillar(thisWeekSnaps, p) - avgPillar(lastWeekSnaps, p) }));
          const bestGain = deltas.filter(d => d.delta > 2).reduce((a, b) => b.delta > a.delta ? b : a, { p: "", delta: -Infinity });
          const worstDrop = deltas.filter(d => d.delta < -2).reduce((a, b) => b.delta < a.delta ? b : a, { p: "", delta: Infinity });
          const body = thisLabel === lastLabel
            ? thisWeekAvg > lastWeekAvg
              ? `Still ${thisLabel} — you improved slightly this week${bestGain.p ? `, with ${pillarNames[bestGain.p].toLowerCase()} leading the way` : ""}. You're close to breaking into ${band(thisWeekAvg + 5)} territory.`
              : thisWeekAvg < lastWeekAvg
                ? `Still ${thisLabel}, but your scores dipped slightly this week${worstDrop.p ? ` — ${pillarNames[worstDrop.p].toLowerCase()} was the weakest area` : ""}. Nothing alarming, but worth keeping an eye on.`
                : `Exactly the same as last week — your routine is holding steady. ${thisLabel === "Strong" ? "That's a great place to be." : "Improving your sleep or hydration consistency is usually the quickest way to move forward."}`
            : thisWeekAvg > lastWeekAvg
              ? `You moved from ${lastLabel} to ${thisLabel} this week${bestGain.p ? ` — ${pillarNames[bestGain.p].toLowerCase()} improved the most` : ""}. That's real progress.`
              : `Your scores dropped from ${lastLabel} to ${thisLabel} this week${worstDrop.p ? ` — ${pillarNames[worstDrop.p].toLowerCase()} took the biggest hit` : ""}. A dip happens; focus on getting your sleep and recovery back on track.`;
          return { label: "Week on week", body };
        })()
      : null,
    tournamentCount > 0
      ? { label: "Tournaments", body: `You've entered ${tournamentCount} tournament${tournamentCount > 1 ? "s" : ""}. Competitive pressure is one of the best accelerators — the nerves, the intensity, the opponents. Keep entering.` }
      : null,
  ].filter((x): x is { label: string; body: string } => x !== null);

  if (pool.length === 0) {
    return <p style={{ fontSize: 15, color: "#9aa0a6", margin: 0 }}>No insights yet — log some matches and check-ins to unlock.</p>;
  }

  const idx = featuredIdx % pool.length;
  const insight = pool[idx];
  return (
    <button
      onClick={() => setFeaturedIdx(i => (i + 1) % pool.length)}
      style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-blue)" }}>{insight.label}</p>
      <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500, color: "#2c3235", lineHeight: 1.65 }}>{insight.body}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {pool.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, background: i === idx ? "var(--c-blue)" : "#e2e5ea", transition: "width 0.2s" }} />
          ))}
        </div>
        <span style={{ fontSize: 13, color: "var(--c-hint)", fontWeight: 500 }}>Tap for next</span>
      </div>
    </button>
  );
}
