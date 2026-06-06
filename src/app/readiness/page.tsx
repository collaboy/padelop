"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates,
  type Scores, type ScoreSnapshot, type PillarStates, type PillarStatus,
} from "@/lib/scoring";

const PILLARS: { key: keyof Omit<Scores, "overall">; label: string; color: string; icon: string }[] = [
  { key: "recovery",  label: "Recovery",  color: "#7c3aed", icon: "🌙" },
  { key: "nutrition", label: "Nutrition", color: "#0891b2", icon: "🥗" },
  { key: "training",  label: "Training",  color: "#16a34a", icon: "🎾" },
  { key: "wellbeing", label: "Wellbeing", color: "#f59e0b", icon: "🧠" },
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

export default function ReadinessPage() {
  const router = useRouter();
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [pillarStates, setPillarStates] = useState<PillarStates>({
    recovery:  { status: "not_logged", reason: "Morning check-in not done" },
    nutrition: { status: "not_logged", reason: "Night check-in not done yet" },
    training:  { status: "not_logged", reason: "No session logged today" },
    wellbeing: { status: "not_logged", reason: "Check-in not done yet" },
  });
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);

  function refresh() {
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    saveScoreSnapshot(s);
    setHistory(loadScoreHistory());
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

  const vals = Object.values(pillarStates);
  const allNotLogged = vals.every(v => v.status === "not_logged");
  const hasLow = vals.some(v => v.status === "low");
  const hasOk  = vals.some(v => v.status === "ok");
  const word  = allNotLogged ? "–" : hasLow ? "Low" : hasOk ? "OK" : "Good";
  const color = allNotLogged ? "#9aa5b0" : hasLow ? "#dc2626" : hasOk ? "#d97706" : "#16a34a";
  const bg    = allNotLogged ? "rgba(154,165,176,0.1)" : hasLow ? "rgba(220,38,38,0.08)" : hasOk ? "rgba(217,119,6,0.08)" : "rgba(22,163,74,0.08)";

  return (
    <main style={{ fontFamily: "Inter, sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, padding: "16px 16px 176px" }}>

      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Today</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1c1c", margin: 0, lineHeight: 1.1 }}>Match Readiness</h1>
        </div>
      </div>

      {/* Overall verdict */}
      {(() => {
        const stops: { key: string; label: string; color: string }[] = [
          { key: 'low',  label: 'Low',  color: '#dc2626' },
          { key: 'ok',   label: 'OK',   color: '#d97706' },
          { key: 'good', label: 'Good', color: '#16a34a' },
        ];
        const activeIdx = allNotLogged ? -1 : hasLow ? 0 : hasOk ? 1 : 2;
        const fillPct = activeIdx < 0 ? 0 : (activeIdx / (stops.length - 1)) * 100;
        const trackColor = activeIdx < 0 ? '#e5e7eb' : stops[activeIdx].color;
        return (
          <div style={{ background: "#fff", borderRadius: 24, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 6px" }}>Overall</p>
                <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, padding: "6px 18px", borderRadius: 999, background: bg, display: "inline-block" }}>{word}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, color: "#9aa5b0", margin: "0 0 2px" }}>Today&apos;s readiness</p>
                <p style={{ fontSize: 12, color: "#6b7480", margin: 0 }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</p>
              </div>
            </div>
            {/* Full-width scale */}
            <div style={{ position: "relative", paddingBottom: 20 }}>
              {/* Track */}
              <div style={{ position: "relative", height: 6, borderRadius: 99, background: "#f0f0f0", margin: "0 6px" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 99, background: trackColor, width: `${fillPct}%`, transition: "width 0.4s ease" }} />
              </div>
              {/* Stops */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {stops.map((s, i) => {
                  const isActive = i === activeIdx;
                  const isPast = i < activeIdx;
                  const dotColor = isActive || isPast ? s.color : "#e5e7eb";
                  return (
                    <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : i === stops.length - 1 ? "flex-end" : "center", gap: 0 }}>
                      <div style={{ width: isActive ? 12 : 8, height: isActive ? 12 : 8, borderRadius: "50%", background: dotColor, marginTop: -13, border: isActive ? `2px solid #fff` : "none", boxShadow: isActive ? `0 0 0 2px ${s.color}` : "none", transition: "all 0.2s" }} />
                      <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? s.color : "#9aa5b0", marginTop: 6, lineHeight: 1 }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Take Action header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Suggestions</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1c1c", margin: 0, lineHeight: 1.1 }}>Take Action!</h2>
        </div>
      </div>

      {/* Log CTA */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#3a4550", margin: "0 0 14px", lineHeight: 1.5 }}>Log your check-ins to keep your readiness score accurate.</p>
        <button onClick={() => setLogSheetOpen(true)} className="w-full py-3 rounded-2xl text-[14px] font-semibold text-white active:opacity-70 transition-opacity" style={{ background: "#2653d4", border: "none", cursor: "pointer" }}>
          Log data
        </button>
      </div>

      {/* Pillar breakdown */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Pillar Breakdown</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {PILLARS.map(row => {
            const state = pillarStates[row.key as keyof PillarStates];
            const meta = STATUS_META[state.status];
            const sparkData = last14.map(s => s[row.key]);
            return (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: `${row.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>{row.icon}</div>
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

      <Nav4/>
      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)}/>
    </main>
  );
}
