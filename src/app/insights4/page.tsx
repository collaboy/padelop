"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";
import { computeScores, loadScoringData, type Scores } from "@/lib/scoring";

const S = { fontFamily: "Inter, sans-serif" };

const SCORE_ROWS: { key: keyof Omit<Scores, "overall">; label: string; color: string }[] = [
  { key: "recovery",  label: "Recovery",  color: "#7c3aed" },
  { key: "hydration", label: "Hydration", color: "#0891b2" },
  { key: "energy",    label: "Energy",    color: "#f59e0b" },
  { key: "mobility",  label: "Mobility",  color: "#16a34a" },
];

function improveTips(scores: Scores): string[] {
  const tips: string[] = [];
  if (scores.hydration < 75) tips.push("Log your water intake — hydration is your quickest win");
  if (scores.recovery < 75)  tips.push("A foam roll or cold shower boosts recovery fast");
  if (scores.energy < 75)    tips.push("Protein-rich meal + earlier sleep tonight");
  if (scores.mobility < 75)  tips.push("10 min mobility session — hips and shoulders");
  if (tips.length === 0)     tips.push("You're in great shape — keep the habits going");
  return tips.slice(0, 3);
}

export default function Insights4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, hydration: 65, energy: 65, mobility: 65 });

  function refresh() {
    const data = loadScoringData();
    setScores(computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek, data.habits));
  }

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const tips = improveTips(scores);

  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "40px 16px 176px" }}>

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
