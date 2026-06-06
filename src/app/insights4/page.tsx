"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";
import { computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory, type Scores, type ScoreSnapshot } from "@/lib/scoring";

const S = { fontFamily: "Inter, sans-serif" };

const SCORE_ROWS: { key: keyof Omit<Scores, "overall">; label: string; color: string }[] = [
  { key: "recovery",  label: "Recovery",  color: "#7c3aed" },
  { key: "nutrition", label: "Nutrition", color: "#0891b2" },
  { key: "training",  label: "Training",  color: "#16a34a" },
  { key: "wellbeing", label: "Wellbeing", color: "#f59e0b" },
];

function improveTips(scores: Scores): string[] {
  const tips: string[] = [];
  if (scores.nutrition < 75)  tips.push("Log your water intake — hydration is your quickest nutrition win");
  if (scores.recovery < 75)   tips.push("A foam roll or cold shower boosts recovery fast");
  if (scores.training < 75)   tips.push("Log a training session — even 30 min of drills counts");
  if (scores.wellbeing < 75)  tips.push("High stress or low motivation? Box breathing helps both");
  if (tips.length === 0)      tips.push("You're in great shape — keep the habits going");
  return tips.slice(0, 3);
}

export default function Insights4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 });
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);

  function refresh() {
    const data = loadScoringData();
    const s = computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek, data.habits, data.training);
    setScores(s);
    saveScoreSnapshot(s);
    setHistory(loadScoreHistory());
  }

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const tips = improveTips(scores);

  return (
    <main style={{ ...S, background: "#ffffff", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "40px 16px 176px" }}>

      {/* Match Readiness score */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 12px" }}>Match Readiness</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span style={{ ...S, fontSize: 64, fontWeight: 700, lineHeight: 1, color: "#2653d4" }}>{scores.overall}</span>
          <span style={{ ...S, fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#2653d4" }}>/100</span>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Breakdown</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {SCORE_ROWS.map((row) => {
            const val = scores[row.key];
            const pct = Math.round(((val - 65) / 35) * 100);
            return (
              <div key={row.key}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ ...S, fontSize: 15, fontWeight: 500, color: "#1a1c1c" }}>{row.label}</span>
                  <span style={{ ...S, fontSize: 15, fontWeight: 700, color: row.color }}>{val}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "#f0f0f0", overflow: "hidden" }}>
                  <div style={{ height: 6, borderRadius: 999, background: row.color, width: `${pct}%`, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend */}
      {history.length > 1 && (() => {
        const pts = history.slice(0, 14).reverse();
        const vals = pts.map(p => p.overall);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = Math.max(max - min, 5);
        const W = 280, H = 48;
        const x = (i: number) => (i / (pts.length - 1)) * W;
        const y = (v: number) => H - ((v - min) / range) * H;
        const d = vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        const latest = vals[vals.length - 1];
        const prev = vals[vals.length - 2];
        const delta = latest - prev;
        return (
          <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Trend</p>
              <span style={{ ...S, fontSize: 13, fontWeight: 700, color: delta >= 0 ? "#496640" : "#dc2626" }}>
                {delta >= 0 ? "+" : ""}{delta} pts
              </span>
            </div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
              <path d={d} fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={x(vals.length - 1)} cy={y(latest)} r="3.5" fill="#2653d4" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ ...S, fontSize: 10, color: "#9aab96" }}>{pts[0].date.slice(5)}</span>
              <span style={{ ...S, fontSize: 10, color: "#9aab96" }}>{pts[pts.length - 1].date.slice(5)}</span>
            </div>
          </div>
        );
      })()}

      {/* Improve Score */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Improve Score</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tips.map((tip) => (
            <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4", flexShrink: 0, marginTop: 5 }} />
              <span style={{ ...S, fontSize: 15, fontWeight: 500, color: "#1a1c1c", lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setLogSheetOpen(true)}
          className="w-full mt-5 py-3 rounded-2xl text-[14px] font-semibold text-white active:opacity-70 transition-opacity"
          style={{ background: "#2653d4" }}
        >
          Log data to improve
        </button>
      </div>

      {/* FAB */}
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: "#2653d4", boxShadow: "0 4px 16px #2653d455" }}
        aria-label="Log activity"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <Nav4 />
      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
    </main>
  );
}
