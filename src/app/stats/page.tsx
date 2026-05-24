"use client";

import { useState, useEffect } from "react";

// ── helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function useLocalStorage<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(fallback);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setVal(JSON.parse(raw));
    } catch {}
  }, [key]);
  const save = (v: T) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, save];
}

// ── colour scale ───────────────────────────────────────────────────────────

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

// Thin horizontal bar
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Ring (single metric)
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

// Sparkline (mini 7-day trend)
function Sparkline({ values, color }: { values: number[]; color: string }) {
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

// Hydration wave card
function HydrationMeter({ glasses, setGlasses }: { glasses: number; setGlasses: (n: number) => void }) {
  const target = 8;
  const pct = clamp(Math.round((glasses / target) * 100), 0, 100);
  const color = scoreColor(pct);
  const litres = (glasses * 0.25).toFixed(2);

  return (
    <StatCard>
      <SectionLabel>Hydration today</SectionLabel>
      <div className="flex items-center gap-4">
        {/* Liquid fill gauge */}
        <div className="relative flex-shrink-0" style={{ width: 64, height: 88 }}>
          <svg width="64" height="88" viewBox="0 0 64 88">
            <defs>
              <clipPath id="st-bottle">
                <rect x="14" y="4" width="36" height="80" rx="10" />
              </clipPath>
            </defs>
            {/* bottle outline */}
            <rect x="14" y="4" width="36" height="80" rx="10" fill="var(--border)" />
            {/* fill */}
            <rect
              x="14" y={4 + 80 * (1 - pct / 100)} width="36" height={80 * pct / 100}
              fill={color} clipPath="url(#st-bottle)"
              style={{ transition: "all 0.6s ease" }}
            />
            {/* cap */}
            <rect x="22" y="0" width="20" height="6" rx="3" fill="var(--muted)" opacity="0.4" />
            {/* label */}
            <text x="32" y="48" textAnchor="middle" fontSize="13" fontWeight="700" fill="white" opacity={pct > 30 ? 1 : 0}>{pct}%</text>
          </svg>
        </div>

        {/* Info + controls */}
        <div className="flex-1">
          <p className="text-[28px] font-bold text-[var(--text)] leading-none">{litres}L</p>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">{glasses} of {target} glasses · {scoreLabel(pct)}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setGlasses(clamp(glasses - 1, 0, 16))}
              className="w-9 h-9 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--muted)] text-lg active:scale-90 transition-transform"
            >−</button>
            <button
              onClick={() => setGlasses(clamp(glasses + 1, 0, 16))}
              className="flex-1 h-9 rounded-xl text-white text-[13px] font-semibold active:scale-[0.97] transition-transform"
              style={{ background: color }}
            >+ Add glass</button>
          </div>
        </div>
      </div>

      {/* dot track */}
      <div className="flex gap-1.5 mt-4">
        {Array.from({ length: target }).map((_, i) => (
          <button
            key={i}
            onClick={() => setGlasses(i + 1)}
            className="flex-1 h-2.5 rounded-full transition-all"
            style={{ background: i < glasses ? color : "var(--border)" }}
          />
        ))}
      </div>
    </StatCard>
  );
}

// ── main ───────────────────────────────────────────────────────────────────

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function StatsPage() {
  const [glasses, setGlasses] = useLocalStorage("padelop:stats:glasses", 3);

  // Simulated metrics — in a real build these would come from logged check-in data
  const metrics = [
    { label: "Sleep",     pct: 74, trend: [6, 7, 5, 8, 7, 6, 7.5], unit: "h", color: "#6366f1" },
    { label: "Energy",    pct: 65, trend: [60, 70, 55, 80, 65, 60, 65],  unit: "%", color: "#f59e0b" },
    { label: "Recovery",  pct: 82, trend: [70, 75, 88, 80, 78, 85, 82],  unit: "%", color: "#22c55e" },
    { label: "Soreness",  pct: 42, trend: [30, 45, 60, 50, 55, 40, 42],  unit: "%", color: "#ef4444" },
  ];

  // Deductions
  const insights: { icon: string; title: string; body: string; color: string }[] = [
    {
      icon: "💧",
      title: "Hydration is limiting your recovery",
      body: "You're averaging 1.8 L/day this week — below the 2.5 L recommended for match days. Even mild dehydration reduces reaction time by up to 14%.",
      color: "#4285f4",
    },
    {
      icon: "😴",
      title: "Sleep dipped mid-week",
      body: "Wednesday night you logged 5 h. Short sleep spikes cortisol for 48 h, which explains Thursday's low energy score.",
      color: "#6366f1",
    },
    {
      icon: "🔥",
      title: "Recovery trending up",
      body: "Your 7-day recovery average is 80% — the highest in three weeks. Keep the post-match nutrition window under 30 min.",
      color: "#22c55e",
    },
    {
      icon: "⚡",
      title: "Energy peaks on match days",
      body: "Your pre-game meal timing correlates with a +12 pt energy score on match days vs. rest days. The chicken + rice combo is working.",
      color: "#f59e0b",
    },
  ];

  // Match-day win rate mock data
  const matchDays = [
    { day: "Mon", won: true  },
    { day: "Wed", won: true  },
    { day: "Fri", won: false },
    { day: "Sat", won: true  },
    { day: "Sun", won: false },
  ];
  const winRate = Math.round((matchDays.filter(m => m.won).length / matchDays.length) * 100);

  return (
    <div className="px-4 pt-6 pb-8 space-y-5 max-w-lg mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[var(--text)] leading-tight">Stats</h1>
        <p className="text-[14px] text-[var(--muted)] mt-0.5">Your week at a glance</p>
      </div>

      {/* Hydration */}
      <HydrationMeter glasses={glasses} setGlasses={setGlasses} />

      {/* Weekly metrics grid */}
      <StatCard>
        <SectionLabel>This week</SectionLabel>
        <div className="space-y-5">
          {metrics.map(({ label, pct, trend, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[14px] font-semibold text-[var(--text)]">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline values={trend} color={color} />
                  <span className="text-[13px] font-bold w-8 text-right" style={{ color }}>{pct}%</span>
                </div>
              </div>
              <Bar pct={pct} color={color} />
            </div>
          ))}
        </div>
      </StatCard>

      {/* Win rate */}
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
            {matchDays.map(({ day, won }) => (
              <div key={day} className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[var(--muted)] w-8">{day}</span>
                <div className="flex-1 h-6 rounded-lg flex items-center px-2.5" style={{ background: won ? "#dcfce7" : "#fee2e2" }}>
                  <span className="text-[11px] font-bold" style={{ color: won ? "#16a34a" : "#dc2626" }}>{won ? "Win" : "Loss"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </StatCard>

      {/* 7-day readiness heatmap */}
      <StatCard>
        <SectionLabel>Readiness — last 7 days</SectionLabel>
        <div className="flex gap-1.5">
          {[72, 80, 61, 85, 78, 88, 85].map((v, i) => {
            const color = scoreColor(v);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-lg" style={{ height: 48, background: color + "30", position: "relative", overflow: "hidden" }}>
                  <div className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-700" style={{ height: `${v}%`, background: color + "80" }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>{v}</span>
                </div>
                <span className="text-[10px] text-[var(--muted)] font-semibold">{WEEK_LABELS[i]}</span>
              </div>
            );
          })}
        </div>
      </StatCard>

      {/* Insights */}
      <div>
        <SectionLabel>Insights</SectionLabel>
        <div className="space-y-3">
          {insights.map(({ icon, title, body, color }) => (
            <div key={title} className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-sm flex gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: color + "18" }}
              >
                {icon}
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
