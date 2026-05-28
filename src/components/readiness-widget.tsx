"use client";

import React, { useState, useEffect } from "react";
import { computeScores, loadScoringData, saveCheckIn, computeAllTimeScores, type Scores } from "@/lib/scoring";

export default function ReadinessWidget({ hideCard = false }: { hideCard?: boolean }) {
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [allTimeScores, setAllTimeScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [scoreView, setScoreView] = useState<"today" | "alltime">("today");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkIn, setCheckIn] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });
  const [advOpen, setAdvOpen] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<{ label: string; pct: number; color: string; subtitle: string; detail: string } | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"overall" | "recovery" | "hydration" | "energy" | "mobility">("overall");

  function loadAndScore() {
    const data = loadScoringData();
    setScores(computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek));
    setAllTimeScores(computeAllTimeScores());
    if (data.checkIn) {
      setCheckIn({ sleep: data.checkIn.sleep, energy: data.checkIn.energy, soreness: data.checkIn.soreness, hydration: data.checkIn.hydration });
      setCheckInDone(true);
    }
  }

  useEffect(() => { loadAndScore(); }, []);

  const logsToday = (() => {
    try {
      const todayYMD = new Date().toISOString().slice(0, 10);
      let count = 0;
      const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      if (ci?.date === todayYMD) count++;
      const hyd = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0];
      if (hyd?.ts?.slice(0, 10) === todayYMD) count++;
      const nut = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0];
      if (nut?.ts?.slice(0, 10) === todayYMD) count++;
      const rev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0];
      if (rev?.ts?.slice(0, 10) === todayYMD) count++;
      return count;
    } catch { return 0; }
  })();

  const active = scoreView === "today" ? scores : allTimeScores;

  // Segment ring logic
  const METRIC_COLORS: Record<string, string> = { overall: "#2653d4", recovery: "#7c3aed", hydration: "#0891b2", energy: "#f59e0b", mobility: "#16a34a" };
  const activeMetricValue = active[selectedMetric] ?? active.overall;
  const activeMetricColor = METRIC_COLORS[selectedMetric];
  const p = activeMetricValue / 100;
  const cx = 50, cy = 50, r = 42, sw = 6;
  const SEGS = 60;
  const pt = (a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  const segColor = (t: number) => {
    if (t < 0.3) { const u = t / 0.3; return `rgb(${lerp(239,249,u)},${lerp(68,115,u)},${lerp(68,22,u)})`; }
    if (t < 0.6) { const u = (t-0.3)/0.3; return `rgb(${lerp(249,163,u)},${lerp(115,230,u)},${lerp(22,0,u)})`; }
    const u = (t-0.6)/0.4; return `rgb(${lerp(163,34,u)},${lerp(230,197,u)},${lerp(0,94,u)})`;
  };
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
        fill="none" stroke={selectedMetric === "overall" ? segColor((t0 + t1) / 2) : activeMetricColor} strokeWidth={sw}
        strokeLinecap={i === 0 || isLast ? "round" : "butt"}
      />
    );
  }

  // Category columns for the metrics section
  const metricActive = scoreView === "today" ? scores : allTimeScores;
  const cols = [
    {
      label: "Recovery", pct: metricActive.recovery, color: "#7c3aed",
      subtitle: "Post-session repair & rest",
      detail: "Recovery reflects how well your body is bouncing back between sessions. It's shaped by your rest days, recent match load, and how you rated your physical feeling after games.\n\nAim for at least one full rest day between intense sessions and prioritise 7–9 hours of sleep. Logging your match reviews regularly helps keep this score accurate.",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
    },
    {
      label: "Hydration", pct: metricActive.hydration, color: "#2653d4",
      subtitle: "Daily water intake",
      detail: "Hydration is based on your most recent intake log. The target is 3.5L on training and match days — more if conditions are hot or sessions are long.\n\nEven mild dehydration (1–2%) measurably reduces reaction time and coordination. Log your intake daily so this score stays current.",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" /></svg>,
    },
    {
      label: "Energy", pct: metricActive.energy, color: "#ea580c",
      subtitle: "Training & match readiness",
      detail: "Energy is derived from how you've rated your energy levels in recent match reviews and your nutrition quality. High energy scores reflect consistent fuelling, good sleep, and manageable training loads.\n\nIf your score is low, check your pre-match meal timing, carbohydrate intake, and whether you're accumulating fatigue across the week.",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2" /></svg>,
    },
    {
      label: "Mobility", pct: metricActive.mobility, color: "#16a34a",
      subtitle: "Flexibility & movement quality",
      detail: "Mobility covers how freely and efficiently you move on court — hip rotation, shoulder range, and ankle stability all feed into padel performance.\n\nSpend 10 minutes after each session on dynamic stretching: hip flexors, thoracic rotation, and calf raises. Regular mobility work reduces injury risk and improves your ability to reach wide balls and change direction quickly.",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2" /><path d="M12 7v6" /><path d="M9 10l-3 5h12l-3-5" /><path d="M9 22v-4" /><path d="M15 22v-4" /></svg>,
    },
  ];
  const circR = 24, sz = 56, circCx = 28;

  return (
    <>
      {/* Daily Readiness ring */}
      <section className="flex flex-col items-center text-center mb-8 mt-4">
        <p className="text-[11px] font-bold tracking-widest uppercase text-[#8a9096] mb-3">Padel Match Readiness</p>
        <div className="relative mb-3" style={{ width: 210, height: 210 }}>
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle cx={cx} cy={cy} r={r} fill="transparent" strokeWidth={sw} stroke="#e2e2e2" />
            {arcs}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span style={{ fontSize: 68, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1c1c" }}>{Math.round(activeMetricValue)}</span>
          </div>
        </div>
        {/* Toggle */}
        <div className="flex items-center bg-[#f0f0f0] rounded-full p-1 mb-3">
          {(["today", "alltime"] as const).map(v => (
            <button
              key={v}
              onClick={() => setScoreView(v)}
              className="px-4 py-1 rounded-full text-[12px] font-semibold transition-all"
              style={{
                background: scoreView === v ? "#fff" : "transparent",
                color: scoreView === v ? "#1a1c1c" : "#747878",
                boxShadow: scoreView === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {v === "today" ? "Today" : "All-time"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-2 mb-3 justify-center rounded-full px-1 py-1 w-full max-w-xs" style={{ background: "rgb(244, 244, 246)" }}>
          {([
            { key: "overall",   label: "Overall",   color: "#2653d4" },
            { key: "recovery",  label: "Recovery",  color: "#7c3aed" },
            { key: "hydration", label: "Hydration", color: "#0891b2" },
            { key: "energy",    label: "Energy",    color: "#f59e0b" },
            { key: "mobility",  label: "Mobility",  color: "#16a34a" },
          ] as { key: typeof selectedMetric; label: string; color: string }[]).map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className="flex-1 rounded-full font-semibold transition-all whitespace-nowrap"
              style={{
                fontSize: 10,
                padding: "5px 2px",
                background: selectedMetric === m.key ? m.color : "transparent",
                color: selectedMetric === m.key ? "#fff" : "rgb(107, 116, 128)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {selectedMetric !== "overall" && (() => {
          const details: Record<string, { color: string; desc: string; drivers: string[]; tip: string }> = {
            recovery:  { color: "#7c3aed", desc: "How well your body has bounced back.", drivers: ["Sleep quality & duration", "Muscle soreness level", "Hydration & injury status", "Recovery habits (foam roll, cold shower, walk)"], tip: "Sleep and foam rolling have the biggest impact here." },
            hydration: { color: "#0891b2", desc: "Your fluid balance and hydration status.", drivers: ["Litres of water logged today", "Urine colour (clear = good)", "Subjective hydration quality", "Check-in self-rating"], tip: "Log your water intake to get an accurate score." },
            energy:    { color: "#f59e0b", desc: "Your fuel and readiness to perform.", drivers: ["Check-in energy level", "Sleep quality (sleep debt tanks energy)", "Nutrition quality & protein intake", "Post-match energy logged in review"], tip: "Protein-rich meals and good sleep move this the most." },
            mobility:  { color: "#16a34a", desc: "Joint freedom and movement quality.", drivers: ["Soreness level (primary driver)", "Injury status", "Game activity this week", "Mobility habits (dynamic warm-up, foam roll, walk)"], tip: "10 min of daily mobility adds up fast over a week." },
          };
          const d = details[selectedMetric];
          if (!d) return null;
          return (
            <div className="mt-1 mb-3 w-full max-w-xs rounded-2xl overflow-hidden text-left" style={{ background: d.color + "0d", border: `1px solid ${d.color}22` }}>
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-[12px] font-bold" style={{ color: d.color }}>{d.desc}</p>
                <span className="text-[18px] font-bold" style={{ color: d.color }}>{Math.round(activeMetricValue)}</span>
              </div>
              <div className="px-4 pb-1">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: d.color + "22" }}>
                  <div className="h-full rounded-full" style={{ width: `${activeMetricValue}%`, background: d.color }} />
                </div>
              </div>
              <div className="px-4 pt-2 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9096] mb-1.5">What drives it</p>
                {d.drivers.map((dr, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <span className="text-[10px] mt-0.5 flex-shrink-0" style={{ color: d.color }}>·</span>
                    <span className="text-[12px] text-[#4a5050] leading-snug">{dr}</span>
                  </div>
                ))}
                <p className="text-[11px] font-semibold mt-2" style={{ color: d.color }}>💡 {d.tip}</p>
              </div>
            </div>
          );
        })()}
        <p className="text-[17px] leading-[26px] text-[#444748] px-4 mb-4">
          {active.overall >= 85
            ? "Optimal recovery achieved. You're primed for high-intensity movement today."
            : active.overall >= 70
            ? "Good base. Address your lowest category to push readiness higher."
            : active.overall >= 55
            ? "Some gaps in recovery or fuel. Log your check-in to get a clearer picture."
            : "Your readiness is low — prioritise sleep, hydration, and recovery today."}
        </p>
        <button onClick={() => setImproveOpen(true)} className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-white border border-[#e2e2e2] active:opacity-70 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          <span className="text-[13px] font-semibold text-[#1a1c1c]">Log your info <span style={{ color: "#ef4444" }}>({logsToday}/4)</span></span>
        </button>
      </section>

      {/* Daily Check-In + Metrics (connected) */}
      {!hideCard && <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 overflow-hidden mb-4">
        {checkInDone ? (
          <button
            onClick={() => setCheckInOpen(true)}
            className="w-full px-6 py-3 flex items-center justify-between active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="8,12 11,15 16,9" />
              </svg>
              <p className="text-[14px] font-semibold text-[#1a1c1c]">Update your stats...</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h1-label-sm text-[#496640] bg-[#caecbc] px-2.5 py-1 rounded-full">Done</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        ) : (
          <button
            onClick={() => setCheckInOpen(true)}
            className="w-full px-6 py-4 flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <div className="text-left">
              <p className="h1-headline-md text-[#1a1c1c]">Update your stats...</p>
              <p className="h1-body-md text-[#444748] mt-0.5">Click to use quick wizard</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#444748" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" />
            </svg>
          </button>
        )}
        <div className="border-t border-[#e2e2e2]" />
        {/* Metrics */}
        <div className="flex">
          {cols.map(({ label, pct, color, icon, subtitle, detail }, i) => {
            const fillH = 2 * circR * pct / 100;
            const fillY = circCx + circR - fillH;
            const rating = pct >= 85 ? "Optimal" : pct >= 65 ? "Good" : pct >= 45 ? "Fair" : "Low";
            const ratingColor = pct >= 85 ? "#16a34a" : pct >= 65 ? "#16a34a" : pct >= 45 ? "#ea580c" : "#dc2626";
            return (
              <button
                key={label}
                onClick={() => setCategoryModal({ label, pct, color, subtitle, detail })}
                className="flex-1 min-w-0 px-2 py-3 flex flex-col items-center gap-1 active:opacity-70 transition-opacity"
                style={{ borderLeft: i > 0 ? "1px solid #e2e2e2" : "none" }}
              >
                <span style={{ color }}>{icon}</span>
                <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
                  <defs>
                    <clipPath id={`rw-${label}`}>
                      <circle cx={circCx} cy={circCx} r={circR} />
                    </clipPath>
                  </defs>
                  <circle cx={circCx} cy={circCx} r={circR} fill="#e8ebee" />
                  <rect x="0" y={fillY} width={sz} height={fillH} fill={color} clipPath={`url(#rw-${label})`} />
                </svg>
                <p className="text-[10px] font-semibold text-[#1a1c1c] leading-tight text-center truncate w-full">{label}</p>
                <p className="text-[13px] font-bold leading-none text-[#1a1c1c]">{pct}%</p>
                <p className="text-[9px] font-semibold tracking-wide uppercase leading-none" style={{ color: ratingColor }}>{rating}</p>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-[#e2e2e2]" />

        {/* Improve */}
        <button onClick={() => setImproveOpen(true)} className="w-full px-5 py-4 relative flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <span className="text-[14px] font-semibold text-[#1a1c1c]">Improve</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>}

      {/* Improve bottom sheet */}
      {improveOpen && (() => {
        const todayYMD = new Date().toISOString().slice(0, 10);
        let ciDone = false;
        try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); ciDone = ci?.date === todayYMD; } catch {}
        let hydroDone = false;
        try { const h = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0]; hydroDone = h?.ts?.slice(0, 10) === todayYMD; } catch {}
        let nutriDone = false;
        try { const n = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0]; nutriDone = n?.ts?.slice(0, 10) === todayYMD; } catch {}
        let revDone = false;
        try { const rv = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0]; revDone = rv?.ts?.slice(0, 10) === todayYMD; } catch {}

        const cats = ["recovery", "hydration", "energy", "mobility"] as const;
        const lowest = cats.slice().sort((a, b) => scores[a] - scores[b])[0];

        const tasks = [
          {
            label: "Log daily check-in", sub: "Sleep, energy, soreness & hydration",
            pts: 12, color: "#4169e1", done: ciDone,
            affects: ["recovery", "energy", "mobility"] as typeof cats[number][],
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4169e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
            action: () => { setImproveOpen(false); setCheckInOpen(true); },
          },
          {
            label: "Log hydration", sub: "Water intake & urine colour",
            pts: 8, color: "#0891b2", done: hydroDone,
            affects: ["hydration", "recovery"] as typeof cats[number][],
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>,
            action: () => { setImproveOpen(false); window.location.href = "/"; },
          },
          {
            label: "Log match review", sub: "Injury status, energy & performance",
            pts: 7, color: "#7c3aed", done: revDone,
            affects: ["recovery", "mobility"] as typeof cats[number][],
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill="#7c3aed" stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill="#7c3aed" stroke="none"/></svg>,
            action: () => { setImproveOpen(false); window.location.href = "/"; },
          },
          {
            label: "Log nutrition", sub: "Protein & meal quality",
            pts: 5, color: "#ea580c", done: nutriDone,
            affects: ["energy"] as typeof cats[number][],
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
            action: () => { setImproveOpen(false); window.location.href = "/"; },
          },
        ].sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          const aRel = a.affects.includes(lowest) ? 1 : 0;
          const bRel = b.affects.includes(lowest) ? 1 : 0;
          if (aRel !== bRel) return bRel - aRel;
          return b.pts - a.pts;
        });

        return (
          <div className="fixed inset-0 z-[60]" onClick={() => setImproveOpen(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="h1-font absolute bottom-0 left-0 right-0 mx-3 bg-white rounded-t-[28px] overflow-y-auto"
              style={{ animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)", maxHeight: "85vh" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1" />
              <div className="px-6 pt-3 pb-4">
                <p className="h1-headline-md text-[#1a1c1c]">How to Improve</p>
                <p className="text-[13px] text-[#747878] mt-0.5">
                  Your weakest area is <span className="font-semibold" style={{ color: lowest === "recovery" ? "#7c3aed" : lowest === "hydration" ? "#0891b2" : lowest === "energy" ? "#ea580c" : "#16a34a" }}>{lowest}</span> — ranked by impact
                </p>
              </div>
              {tasks.map((task) => (
                <button
                  key={task.label}
                  onClick={task.action}
                  className="w-full flex items-center gap-4 px-6 py-4 active:bg-[#f9f9f9] transition-colors"
                  style={{ borderTop: "1px solid #f4f4f4", opacity: task.done ? 0.5 : 1 }}
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: task.color + "18" }}>
                    {task.icon}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15px] font-semibold text-[#1a1c1c]">{task.label}</p>
                    <p className="text-[12px] text-[#747878] mt-0.5">{task.sub}</p>
                  </div>
                  {task.done ? (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#caecbc] text-[#496640] flex-shrink-0">Done</span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: task.color + "15", color: task.color }}>+{task.pts} pts</span>
                  )}
                </button>
              ))}
              <div style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }} />
            </div>
          </div>
        );
      })()}

      {/* Daily Check-In modal */}
      {checkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setCheckInOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="h1-headline-md text-[#1a1c1c]">Update your stats</p>
                <p className="h1-label-sm text-[#747878] mt-0.5">Rate each on a scale of 1–5</p>
              </div>
              <button onClick={() => setCheckInOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Metrics */}
            <div className="px-6 pb-6 space-y-4 overflow-y-auto">
              {([
                { key: "sleep",     label: "Sleep",     sub: "Hours & quality"   },
                { key: "energy",    label: "Energy",    sub: "How alert you feel" },
                { key: "soreness",  label: "Soreness",  sub: "Muscle fatigue"    },
                { key: "hydration", label: "Hydration", sub: "Fluid intake"      },
              ] as { key: keyof typeof checkIn; label: string; sub: string }[]).map(({ key, label, sub }) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[14px] font-semibold text-[#1a1c1c]">{label}</p>
                    <p className="h1-label-sm text-[#747878]">{sub}</p>
                  </div>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => {
                      const selected = checkIn[key] === n;
                      return (
                        <button
                          key={n}
                          onClick={() => setCheckIn(c => ({ ...c, [key]: n }))}
                          className="w-11 h-11 rounded-full text-[13px] font-semibold transition-all active:scale-90 border flex-1"
                          style={{
                            background: selected ? "#4169e1" : "#f9f9f9",
                            color: selected ? "#fff" : "#747878",
                            borderColor: selected ? "#4169e1" : "#e2e2e2",
                            maxWidth: 52,
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Advanced toggle */}
              <div className="border-t border-[#e2e2e2] pt-3">
                <button
                  onClick={() => setAdvOpen(o => !o)}
                  className="flex items-center justify-between w-full active:opacity-70 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#747878]">Adv. Reporting</p>
                    <span className="h1-label-sm text-[#9aabb6] bg-[#f4f4f4] px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: advOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {advOpen && (
                  <div className="mt-3 space-y-3">
                    {(["HRV", "Resting HR", "Body Weight", "Mood"] as const).map(label => (
                      <div key={label} className="flex items-center gap-3">
                        <p className="text-[13px] font-semibold text-[#1a1c1c] w-24 flex-shrink-0">{label}</p>
                        <input
                          type="text"
                          placeholder="—"
                          className="flex-1 h1-field-input text-[13px]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  saveCheckIn(checkIn);
                  setCheckInDone(true);
                  setCheckInOpen(false);
                  loadAndScore();
                }}
                className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ background: "#4169e1" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category detail modal */}
      {categoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setCategoryModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4" style={{ background: categoryModal.color + "18" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: categoryModal.color }} />
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: categoryModal.color }}>{categoryModal.label}</p>
                </div>
                <button onClick={() => setCategoryModal(null)} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "rgba(0,0,0,0.08)" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
              </div>
              <p className="h1-headline-md text-[#1a1c1c]">{categoryModal.label}</p>
              <p className="h1-label-sm text-[#747878] mt-1 leading-snug">{categoryModal.subtitle}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[28px] font-bold leading-none" style={{ color: categoryModal.color }}>{categoryModal.pct}%</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#e2e2e2" }}>
                  <div className="h-full rounded-full" style={{ width: `${categoryModal.pct}%`, background: categoryModal.color, transition: "width 0.4s ease" }} />
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              {categoryModal.detail.split("\n\n").map((para, i) => (
                <p key={i} className={`h1-body-lg text-[#444748] leading-relaxed${i > 0 ? " mt-3" : ""}`}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
