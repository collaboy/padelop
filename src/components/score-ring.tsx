"use client";

import React, { useState, useEffect } from "react";
import { computeScores, loadScoringData, type Scores } from "@/lib/scoring";

export default function ScoreRing() {
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, hydration: 65, energy: 65, mobility: 65 });

  useEffect(() => {
    function load() {
      const data = loadScoringData();
      setScores(computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek));
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const p = scores.overall / 100;
  const cx = 50, cy = 50, r = 42, sw = 6;
  const SEGS = 60;
  const pt = (a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const segColor = () => "#2653d4";
  const start = -Math.PI / 2;
  const arcs: React.ReactNode[] = [];
  for (let i = 0; i < SEGS; i++) {
    const t0 = i / SEGS;
    if (t0 >= p) break;
    const t1 = Math.min((i + 1) / SEGS, p);
    const a0 = start + t0 * 2 * Math.PI;
    const a1 = start + t1 * 2 * Math.PI;
    const p0 = pt(a0), p1 = pt(a1);
    const isLast = t1 >= p;
    arcs.push(
      <path key={i}
        d={`M${p0.x} ${p0.y} A${r} ${r} 0 0 1 ${p1.x} ${p1.y}`}
        fill="none" stroke={segColor()} strokeWidth={sw}
        strokeLinecap={isLast ? "round" : "butt"}
      />
    );
  }

  const metrics = [
    { label: "Recovery", value: scores.recovery, color: "#7c3aed" },
    { label: "Hydration", value: scores.hydration, color: "#0891b2" },
    { label: "Energy", value: scores.energy, color: "#f59e0b" },
    { label: "Mobility", value: scores.mobility, color: "#16a34a" },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative" style={{ width: 189, height: 189 }}>
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx={cx} cy={cy} r={r} fill="transparent" strokeWidth={sw} stroke="#e2e2e2" />
          {arcs}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#444748", textTransform: "uppercase" }}>Match</span>
          <span className="text-black" style={{ fontSize: 68, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.02em" }}>{Math.round(scores.overall)}</span>
          <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", color: "#444748", textTransform: "uppercase" }}>Readiness</span>
        </div>
      </div>
      <div className="flex justify-between w-full px-4 mt-4">
        {metrics.map(m => (
          <div key={m.label} className="flex flex-col items-center gap-1">
            <span style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{Math.round(m.value)}</span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: "#9aab96", textTransform: "uppercase" }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
