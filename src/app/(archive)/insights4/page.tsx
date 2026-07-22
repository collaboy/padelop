"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates,
  type Scores, type ScoreSnapshot, type ReviewEntry, type PillarStates, type PillarStatus,
} from "@/lib/scoring";

const PILLARS: { key: keyof Omit<Scores, "overall">; label: string; color: string }[] = [
  { key: "recovery",  label: "Recovery",  color: "#7c3aed" },
  { key: "nutrition", label: "Nutrition", color: "#0891b2" },
  { key: "training",  label: "Training",  color: "#16a34a" },
  { key: "wellbeing", label: "Wellbeing", color: "#f59e0b" },
];

const STATUS_META: Record<PillarStatus, { label: string; bg: string; text: string }> = {
  good:       { label: "Good",       bg: "#f0fdf4", text: "#16a34a" },
  ok:         { label: "OK",         bg: "#fffbeb", text: "#d97706" },
  low:        { label: "Low",        bg: "#fef2f2", text: "#dc2626" },
  not_logged: { label: "Not logged", bg: "#f4f4f6", text: "#9aa5b0" },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const W = 56, H = 24;
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(max - min, 3);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * (H - 4) - 2;
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.5" fill={color}/>
    </svg>
  );
}

function improveTips(states: PillarStates): string[] {
  const tips: string[] = [];
  if (states.nutrition.status === "low")     tips.push(states.nutrition.reason);
  if (states.recovery.status === "low")      tips.push(states.recovery.reason);
  if (states.wellbeing.status === "low")     tips.push(states.wellbeing.reason);
  if (states.training.status === "not_logged") tips.push("Log a session — even 30 min of drills counts");
  if (states.nutrition.status === "not_logged") tips.push("Complete your night check-in to track nutrition");
  if (tips.length === 0) tips.push("You're in great shape — keep the habits going");
  return tips.slice(0, 3);
}

function topTag(tags: string[]): string | null {
  if (!tags.length) return null;
  const counts = tags.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export default function Insights4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65, recoveryRaw: 65, wellbeingRaw: 65 });
  const [pillarStates, setPillarStates] = useState<PillarStates>({
    recovery:  { status: "not_logged", reason: "Morning check-in not done" },
    nutrition: { status: "not_logged", reason: "Night check-in not done yet" },
    training:  { status: "not_logged", reason: "No session logged today" },
    wellbeing: { status: "not_logged", reason: "Check-in not done yet" },
  });
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);

  function refresh() {
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    setScores(s);
    saveScoreSnapshot(s);
    setHistory(loadScoreHistory());
    try { setReviews(JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[]); } catch {}
    const todayStr = new Date().toISOString().slice(0, 10);
    let m: { date: string } | null = null;
    try { m = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
    setPillarStates(computePillarStates(d.checkIn, d.hydration, d.nutrition, d.habits, d.training, m?.date === todayStr));
  }

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const deduped = Object.values(
    history.reduce((acc, s) => { acc[s.date] = s; return acc; }, {} as Record<string, ScoreSnapshot>)
  ).sort((a, b) => a.date.localeCompare(b.date));

  const last14 = deduped.slice(-14);

  const dow = (new Date().getDay() + 6) % 7;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - dow);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const thisWeek = deduped.filter(s => s.date >= weekStartStr);
  const lastWeek = deduped.filter(s => s.date >= lastWeekStartStr && s.date < weekStartStr);
  const avg = (arr: ScoreSnapshot[]) => arr.length ? Math.round(arr.reduce((s, x) => s + x.overall, 0) / arr.length) : null;
  const thisWeekAvg = avg(thisWeek);
  const lastWeekAvg = avg(lastWeek);

  const wins   = reviews.filter(r => r.result === "win").length;
  const losses = reviews.filter(r => r.result === "loss").length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;
  const topStrength = topTag(reviews.flatMap(r => r.wellDone ?? []));
  const topWeakness = topTag(reviews.flatMap(r => r.improved ?? []));

  const tips = improveTips(pillarStates);

  return (
    <main style={{ fontFamily: "Inter, sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, padding: "40px 16px 176px" }}>

      {/* Pillar states */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Your State Today</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PILLARS.map(row => {
            const state = pillarStates[row.key as keyof PillarStates];
            const meta = STATUS_META[state.status];
            const sparkData = last14.map(s => s[row.key]);
            return (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1c1c" }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: meta.bg, color: meta.text }}>{meta.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7480", margin: 0, lineHeight: 1.3 }}>{state.reason}</p>
                </div>
                <Sparkline data={sparkData} color={row.color}/>
              </div>
            );
          })}
        </div>
      </div>

      {/* Week comparison */}
      {(thisWeekAvg !== null || lastWeekAvg !== null) && (
        <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Week Comparison</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "#f4f6ff", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7480", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>This week</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: "#2653d4", margin: 0, lineHeight: 1 }}>{thisWeekAvg ?? "–"}</p>
              <p style={{ fontSize: 11, color: "#9aa5b0", margin: "4px 0 0" }}>{thisWeek.length} day{thisWeek.length !== 1 ? "s" : ""} logged</p>
            </div>
            <div style={{ flex: 1, background: "#f9f9f9", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7480", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Last week</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1 }}>{lastWeekAvg ?? "–"}</p>
              <p style={{ fontSize: 11, color: "#9aa5b0", margin: "4px 0 0" }}>{lastWeek.length} day{lastWeek.length !== 1 ? "s" : ""} logged</p>
            </div>
          </div>
          {thisWeekAvg !== null && lastWeekAvg !== null && (
            <p style={{ fontSize: 13, fontWeight: 600, color: thisWeekAvg >= lastWeekAvg ? "#16a34a" : "#dc2626", margin: "12px 0 0", textAlign: "center" }}>
              {thisWeekAvg >= lastWeekAvg ? "▲" : "▼"} {Math.abs(thisWeekAvg - lastWeekAvg)} pts {thisWeekAvg >= lastWeekAvg ? "up" : "down"} from last week
            </p>
          )}
        </div>
      )}

      {/* Match record */}
      {reviews.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Match Record</p>
          <div style={{ display: "flex", gap: 10, marginBottom: topStrength || topWeakness ? 16 : 0 }}>
            <div style={{ flex: 1, textAlign: "center", background: "#f0fdf4", borderRadius: 14, padding: "12px 8px" }}>
              <p style={{ fontSize: 30, fontWeight: 700, color: "#16a34a", margin: 0, lineHeight: 1 }}>{wins}</p>
              <p style={{ fontSize: 11, color: "#16a34a", margin: "4px 0 0", fontWeight: 600 }}>Wins</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "#fef2f2", borderRadius: 14, padding: "12px 8px" }}>
              <p style={{ fontSize: 30, fontWeight: 700, color: "#dc2626", margin: 0, lineHeight: 1 }}>{losses}</p>
              <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0", fontWeight: 600 }}>Losses</p>
            </div>
            {winRate !== null && (
              <div style={{ flex: 1, textAlign: "center", background: "#f4f6ff", borderRadius: 14, padding: "12px 8px" }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: "#2653d4", margin: 0, lineHeight: 1 }}>{winRate}%</p>
                <p style={{ fontSize: 11, color: "#2653d4", margin: "4px 0 0", fontWeight: 600 }}>Win rate</p>
              </div>
            )}
          </div>
          {(topStrength || topWeakness) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topStrength && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: "#1a1c1c" }}>Strongest: <strong>{topStrength}</strong></span>
                </div>
              )}
              {topWeakness && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: "#1a1c1c" }}>Focus area: <strong>{topWeakness}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Improve */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Focus Today</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tips.map(tip => (
            <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4", flexShrink: 0, marginTop: 5 }}/>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1c1c", lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setLogSheetOpen(true)}
          className="w-full mt-5 py-3 rounded-2xl text-[14px] font-semibold text-white active:opacity-70 transition-opacity"
          style={{ background: "#2653d4" }}>
          Log data
        </button>
      </div>

      <Nav4/>
      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)}/>
    </main>
  );
}
