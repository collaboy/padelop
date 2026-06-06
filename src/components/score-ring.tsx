"use client";

import React, { useState, useEffect } from "react";
import { computeScores, loadScoringData, type Scores } from "@/lib/scoring";

const METRIC_META: Record<string, { label: string; sublabel: string; color: string }> = {
  overall:   { label: "Match",     sublabel: "Readiness", color: "#2653d4" },
  recovery:  { label: "Recovery",  sublabel: "Score",     color: "#7c3aed" },
  nutrition: { label: "Nutrition", sublabel: "Score",     color: "#0891b2" },
  training:  { label: "Training",  sublabel: "Score",     color: "#16a34a" },
  wellbeing: { label: "Wellbeing", sublabel: "Score",     color: "#f59e0b" },
};

export default function ScoreRing({ metric = "overall" }: { metric?: string }) {
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 });

  useEffect(() => {
    function load() {
      const data = loadScoringData();
      setScores(computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek, data.habits, data.training));
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const meta = METRIC_META[metric] ?? METRIC_META.overall;
  const value = scores[metric as keyof Scores] ?? scores.overall;
  const p = value / 100;
  const cx = 50, cy = 50, r = 42, sw = 6;
  const SEGS = 60;
  const pt = (a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
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
        fill="none" stroke={meta.color} strokeWidth={sw}
        strokeLinecap={isLast ? "round" : "butt"}
      />
    );
  }

  const subMetrics = [
    { label: "Recovery",  value: scores.recovery,  color: "#7c3aed" },
    { label: "Nutrition", value: scores.nutrition, color: "#0891b2" },
    { label: "Training",  value: scores.training,  color: "#16a34a" },
    { label: "Wellbeing", value: scores.wellbeing, color: "#f59e0b" },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative" style={{ width: 189, height: 189 }}>
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx={cx} cy={cy} r={r} fill="transparent" strokeWidth={sw} stroke="#e2e2e2" />
          {arcs}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontSize: 56, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.02em", color: meta.color }}>{Math.round(value)}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: meta.color, opacity: 0.7, marginTop: 2 }}>{meta.sublabel}</span>
        </div>
      </div>
    </div>
  );
}
