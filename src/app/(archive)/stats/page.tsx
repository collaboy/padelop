"use client";

import { useState, useEffect } from "react";
import {
  computeScores, computeAllTimeScores, loadScoringData,
  type Scores, type HydrationEntry, type ReviewEntry, type NutritionEntry,
} from "@/lib/scoring";

// ── helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function useLocalStorage<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(fallback);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setVal(JSON.parse(raw)); } catch {}
  }, [key]);
  const save = (v: T) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, save];
}

function scoreColor(pct: number) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#f59e0b";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}

function scoreLabel(pct: number) {
  if (pct >= 80) return "Optimal";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Fair";
  return "Low";
}

// ── sub-components ─────────────────────────────────────────────────────────

function StatCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--surface)] rounded-2xl p-5 shadow-sm border border-[var(--border)] ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--muted)] mb-3">{children}</p>;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Ring({ pct, color, size = 72, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ width: 80, height: 32 }} />;
  const w = 80, h = 32, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HydrationMeter({ glasses, setGlasses }: { glasses: number; setGlasses: (n: number) => void }) {
  const target = 8;
  const pct = clamp(Math.round((glasses / target) * 100), 0, 100);
  const color = scoreColor(pct);
  const litres = (glasses * 0.25).toFixed(2);
  return (
    <StatCard>
      <SectionLabel>Hydration today</SectionLabel>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 64, height: 88 }}>
          <svg width="64" height="88" viewBox="0 0 64 88">
            <defs><clipPath id="st-bottle"><rect x="14" y="4" width="36" height="80" rx="10" /></clipPath></defs>
            <rect x="14" y="4" width="36" height="80" rx="10" fill="var(--border)" />
            <rect x="14" y={4 + 80 * (1 - pct / 100)} width="36" height={80 * pct / 100}
              fill={color} clipPath="url(#st-bottle)" style={{ transition: "all 0.6s ease" }} />
            <rect x="22" y="0" width="20" height="6" rx="3" fill="var(--muted)" opacity="0.4" />
            <text x="32" y="48" textAnchor="middle" fontSize="13" fontWeight="700" fill="white" opacity={pct > 30 ? 1 : 0}>{pct}%</text>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[28px] font-bold text-[var(--text)] leading-none">{litres}L</p>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">{glasses} of {target} glasses · {scoreLabel(pct)}</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setGlasses(clamp(glasses - 1, 0, 16))}
              className="w-9 h-9 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--muted)] text-lg active:scale-90 transition-transform">−</button>
            <button onClick={() => setGlasses(clamp(glasses + 1, 0, 16))}
              className="flex-1 h-9 rounded-xl text-white text-[13px] font-semibold active:scale-[0.97] transition-transform"
              style={{ background: color }}>+ Add glass</button>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-4">
        {Array.from({ length: target }).map((_, i) => (
          <button key={i} onClick={() => setGlasses(i + 1)}
            className="flex-1 h-2.5 rounded-full transition-all"
            style={{ background: i < glasses ? color : "var(--border)" }} />
        ))}
      </div>
    </StatCard>
  );
}

// ── icons ──────────────────────────────────────────────────────────────────

const ICONS = {
  moon:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  drop:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>,
  bolt:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2"/></svg>,
  activity:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  trending:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  alert:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

// ── main ───────────────────────────────────────────────────────────────────

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const LITRE_MAP: Record<string, number> = { "<1L": 0.75, "1–1.5L": 1.25, "1.5–2L": 1.75, "2–2.5L": 2.25, "2.5–3L": 2.75, "3L+": 3.5 };
const ENERGY_MAP: Record<string, number> = { high: 85, mid: 60, low: 35 };

export default function StatsPage() {
  const [glasses, setGlasses] = useLocalStorage("padelop:stats:glasses", 3);
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [allTime, setAllTime] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [matchRecord, setMatchRecord] = useState<{ label: string; result: string }[]>([]);
  const [weekReadiness, setWeekReadiness] = useState<(number | null)[]>(Array(7).fill(null));
  const [trends, setTrends] = useState<{ recovery: number[]; hydration: number[]; energy: number[]; mobility: number[] }>({
    recovery: [], hydration: [], energy: [], mobility: [],
  });
  const [avgHydLitres, setAvgHydLitres] = useState<number | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const todayYMD = new Date().toISOString().slice(0, 10);

    // Today's scores
    const data = loadScoringData();
    const today = computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek);
    setScores(today);
    setAllTime(computeAllTimeScores());

    // Raw logs
    const hydLogs = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
    const revLogs = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[];
    const nutLogs = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]") as NutritionEntry[];

    const anyData = hydLogs.length > 0 || revLogs.length > 0 || nutLogs.length > 0;
    setHasData(anyData);

    // Match record — last 7 reviews
    setMatchRecord(
      revLogs.slice(0, 7).map(r => ({
        label: new Date(r.ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        result: r.result,
      }))
    );

    // 7-day readiness heatmap
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const readiness = last7.map(day => {
      if (day === todayYMD) return today.overall;
      const hyd = hydLogs.find(h => h.ts.slice(0, 10) === day) ?? null;
      const rev = revLogs.find(r => r.ts.slice(0, 10) === day) ?? null;
      const nut = nutLogs.find(n => n.ts.slice(0, 10) === day) ?? null;
      if (!hyd && !rev && !nut) return null;
      return computeScores(null, hyd, rev, nut, 1).overall;
    });
    setWeekReadiness(readiness);

    // Trends (last 7 scored entries per category)
    const entries = Math.max(hydLogs.length, revLogs.length, nutLogs.length);
    if (entries > 0) {
      const n = Math.min(entries, 7);
      const tRec: number[] = [], tHyd: number[] = [], tEng: number[] = [], tMob: number[] = [];
      for (let i = n - 1; i >= 0; i--) {
        const s = computeScores(null, hydLogs[i] ?? null, revLogs[i] ?? null, nutLogs[i] ?? null, 1);
        tRec.push(s.recovery); tHyd.push(s.hydration); tEng.push(s.energy); tMob.push(s.mobility);
      }
      setTrends({ recovery: tRec, hydration: tHyd, energy: tEng, mobility: tMob });
    }

    // Avg hydration from last 7 logs
    if (hydLogs.length > 0) {
      const slice = hydLogs.slice(0, 7);
      const avg = slice.reduce((s, h) => s + (LITRE_MAP[h.litres] ?? 2), 0) / slice.length;
      setAvgHydLitres(Math.round(avg * 10) / 10);
    }
  }, []);

  const metrics = [
    { label: "Recovery",  pct: scores.recovery,  allTimePct: allTime.recovery,  trend: trends.recovery,  color: "#7c3aed",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
    { label: "Hydration", pct: scores.hydration, allTimePct: allTime.hydration, trend: trends.hydration, color: "#2653d4",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg> },
    { label: "Energy",    pct: scores.energy,    allTimePct: allTime.energy,    trend: trends.energy,    color: "#ea580c",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2"/></svg> },
    { label: "Mobility",  pct: scores.mobility,  allTimePct: allTime.mobility,  trend: trends.mobility,  color: "#16a34a",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6"/><path d="M9 10l-3 5h12l-3-5"/><path d="M9 22v-4"/><path d="M15 22v-4"/></svg> },
  ];

  // Dynamic insights
  const insights: { icon: keyof typeof ICONS; title: string; body: string; color: string }[] = [];
  if (avgHydLitres !== null && avgHydLitres < 2.5) {
    insights.push({ icon: "drop", color: "#2653d4", title: "Hydration is below target", body: `Your average over logged sessions is ${avgHydLitres}L — below the 2.5L recommended for match and training days. Even mild dehydration reduces reaction time by up to 14%.` });
  } else if (avgHydLitres !== null && avgHydLitres >= 2.5) {
    insights.push({ icon: "drop", color: "#22c55e", title: "Hydration is on track", body: `You're averaging ${avgHydLitres}L per logged session — above the 2.5L baseline. Keep it consistent on match days and increase to 3L+ in hot conditions.` });
  }
  if (scores.recovery < 60) {
    insights.push({ icon: "moon", color: "#7c3aed", title: "Recovery needs attention", body: `Your recovery score is ${scores.recovery} — prioritise 7–9h sleep tonight, hit a protein-rich meal, and cut screen time before bed.` });
  } else if (scores.recovery >= 80) {
    insights.push({ icon: "trending", color: "#22c55e", title: "Recovery is strong", body: `Recovery at ${scores.recovery} — your rest and post-match nutrition are paying off. Maintain the post-match 30-min protein window.` });
  }
  if (scores.energy < 55) {
    insights.push({ icon: "bolt", color: "#ea580c", title: "Energy is low", body: `Energy score of ${scores.energy} suggests accumulated fatigue or poor fuelling. Check your pre-session meal timing and ensure you're eating enough carbs.` });
  } else if (scores.energy >= 75) {
    insights.push({ icon: "bolt", color: "#f59e0b", title: "Energy is high", body: `Energy at ${scores.energy} — your fuelling routine is working. The pre-session meal timing and carbohydrate choices are translating directly into readiness.` });
  }
  if (scores.mobility < 55) {
    insights.push({ icon: "activity", color: "#16a34a", title: "Mobility needs work", body: `Mobility at ${scores.mobility}. Spend 10 minutes on hip flexors, thoracic rotation, and calf raises after today's session to start moving this score up.` });
  }
  if (insights.length === 0) {
    insights.push({ icon: "trending", color: "#22c55e", title: "Looking good overall", body: `Readiness is at ${scores.overall}. Keep logging your check-ins and hydration daily to get more personalised insights as your data builds up.` });
  }

  const winCount = matchRecord.filter(m => m.result === "win").length;
  const winRate = matchRecord.length > 0 ? Math.round((winCount / matchRecord.length) * 100) : 0;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5 max-w-lg mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[var(--text)] leading-tight">Stats</h1>
        <p className="text-[14px] text-[var(--muted)] mt-0.5">Your performance at a glance</p>
      </div>

      {/* Hydration */}
      <HydrationMeter glasses={glasses} setGlasses={setGlasses} />

      {/* Weekly metrics */}
      <StatCard>
        <SectionLabel>Today vs all-time</SectionLabel>
        <div className="space-y-5">
          {metrics.map(({ label, pct, allTimePct, trend, color, icon }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span style={{ color }}>{icon}</span>
                  <span className="text-[14px] font-semibold text-[var(--text)]">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {trend.length >= 2 && <Sparkline values={trend} color={color} />}
                  <div className="text-right">
                    <span className="text-[13px] font-bold" style={{ color }}>{pct}%</span>
                    {hasData && <span className="text-[10px] text-[var(--muted)] ml-1">/ {allTimePct}%</span>}
                  </div>
                </div>
              </div>
              <Bar pct={pct} color={color} />
            </div>
          ))}
        </div>
        {hasData && <p className="text-[10px] text-[var(--muted)] mt-4">Today / all-time average</p>}
      </StatCard>

      {/* Match record */}
      {matchRecord.length > 0 ? (
        <StatCard>
          <SectionLabel>Match record</SectionLabel>
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <Ring pct={winRate} color={scoreColor(winRate)} size={80} stroke={8} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-bold text-[var(--text)] leading-none">{winRate}%</span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">wins</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {matchRecord.map(({ label, result }, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[var(--muted)] flex-1 truncate">{label}</span>
                  <div className="h-6 rounded-lg flex items-center px-2.5 flex-shrink-0"
                    style={{ background: result === "win" ? "#dcfce7" : result === "draw" ? "#fef9c3" : "#fee2e2" }}>
                    <span className="text-[11px] font-bold capitalize"
                      style={{ color: result === "win" ? "#16a34a" : result === "draw" ? "#a16207" : "#dc2626" }}>
                      {result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </StatCard>
      ) : (
        <StatCard>
          <SectionLabel>Match record</SectionLabel>
          <div className="flex items-center gap-3 py-2">
            <span className="text-[var(--muted)]">{ICONS.activity}</span>
            <p className="text-[14px] text-[var(--muted)]">No match reviews yet — log a match to see your record here.</p>
          </div>
        </StatCard>
      )}

      {/* 7-day readiness heatmap */}
      <StatCard>
        <SectionLabel>Readiness — last 7 days</SectionLabel>
        <div className="flex gap-1.5">
          {weekReadiness.map((v, i) => {
            const color = v !== null ? scoreColor(v) : "#e2e2e2";
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-lg" style={{ height: 48, background: color + "30", position: "relative", overflow: "hidden" }}>
                  {v !== null && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-700"
                      style={{ height: `${v}%`, background: color + "80" }} />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                    style={{ color: v !== null ? color : "#c4c7c7" }}>
                    {v !== null ? v : "—"}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--muted)] font-semibold">{WEEK_LABELS[i]}</span>
              </div>
            );
          })}
        </div>
        {weekReadiness.every(v => v === null) && (
          <p className="text-[12px] text-[var(--muted)] mt-3">Log check-ins and hydration daily to build your readiness history.</p>
        )}
      </StatCard>

      {/* Insights */}
      <div>
        <SectionLabel>Insights</SectionLabel>
        <div className="space-y-3">
          {insights.map(({ icon, title, body, color }, i) => (
            <div key={i} className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-sm flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: color + "18", color }}>
                {ICONS[icon]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text)] leading-snug">{title}</p>
                <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
