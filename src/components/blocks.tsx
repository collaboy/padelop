"use client";

/**
 * BLOCKS — reusable UI components
 *
 * Available blocks (say "grab the X"):
 *   StatCard          — white rounded card wrapper
 *   SectionLabel      — small caps label above a section
 *   Bar               — thin horizontal progress bar
 *   Ring              — circular progress ring
 *   Sparkline         — 7-point mini trend line
 *   OptimizerCard     — gradient score bar with pointer + tip
 *   MetricRow         — icon + label + progress bar row (optimizer style)
 *   MetricGauges      — row of liquid-fill circle gauges (halt1 style)
 *   CountdownCard     — "Next Match Starts In" HH:MM timer
 *   TimeBlock         — single schedule row (time · dot · title · subtitle)
 *   HydrationMeter    — bottle fill gauge with +/- glass controls
 *   CheckInModal      — 1–5 slider modal for sleep/energy/soreness/hydration
 *   InsightCard       — emoji icon + title + body deduction card
 */

import { useState, useEffect } from "react";

// ── utils ──────────────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function scoreColor(pct: number) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#f59e0b";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}

export function scoreLabel(pct: number) {
  if (pct >= 80) return "Optimal";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Fair";
  return "Low";
}

// ── StatCard ───────────────────────────────────────────────────────────────

export function StatCard({
  children,
  className = "",
  padding = "p-5",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

// ── SectionLabel ───────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--muted)] mb-3">
      {children}
    </p>
  );
}

// ── Bar ───────────────────────────────────────────────────────────────────

export function Bar({
  pct,
  color,
  height = "h-2",
}: {
  pct: number;
  color: string;
  height?: string;
}) {
  return (
    <div className={`${height} bg-[var(--border)] rounded-full overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${clamp(pct, 0, 100)}%`, background: color }}
      />
    </div>
  );
}

// ── Ring ──────────────────────────────────────────────────────────────────

export function Ring({
  pct,
  color,
  size = 72,
  stroke = 7,
}: {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamp(pct, 0, 100) / 100);
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

// ── Sparkline ─────────────────────────────────────────────────────────────

export function Sparkline({
  values,
  color,
  width = 80,
  height = 32,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── OptimizerCard ─────────────────────────────────────────────────────────
// Gradient bar with pointer, score, and a tip row.

export function OptimizerCard({
  score,
  tip,
  tipGain,
  label = "Padel\nOptimization\nScore",
}: {
  score: number;
  tip: string;
  tipGain: number;
  label?: string;
}) {
  return (
    <StatCard padding="px-5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] text-left leading-tight whitespace-pre-line">
          {label}
        </p>
        <span
          className="text-3xl font-extrabold leading-none"
          style={{ color: "var(--green)", fontFamily: "var(--font-hanken)" }}
        >
          {score}
          <span className="text-base font-bold text-[var(--muted)]">/100</span>
        </span>
      </div>
      <div className="w-full mt-1 mb-6 relative">
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)" }}
        />
        <div className="absolute" style={{ left: `calc(${score}% - 5px)`, top: "24px" }}>
          <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
            <polygon points="5,0 0,7 10,7" fill="#171c1f" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-[var(--text)] leading-none">{tip}</p>
        <svg width="14" height="9" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="0" y1="5" x2="13" y2="5" />
          <polyline points="9,1 13,5 9,9" />
        </svg>
        <span className="text-sm font-bold leading-none" style={{ color: "var(--green)" }}>
          +{tipGain}%
        </span>
      </div>
    </StatCard>
  );
}

// ── MetricRow ─────────────────────────────────────────────────────────────
// Blue icon tile + label + subtitle + progress bar. Used in optimizer sections.

export function MetricRow({
  icon,
  label,
  sub,
  value,
  pct,
  color = "#2653d4",
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: string;
  pct: number;
  color?: string;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-4 flex items-center gap-4 shadow-sm">
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-bold text-[var(--text)]">{label}</p>
          <p className="text-xs text-[var(--muted)]">{value}</p>
        </div>
        <p className="text-xs text-[var(--muted)] mb-1.5">{sub}</p>
        <Bar pct={pct} color={color} />
      </div>
      <span className="text-sm font-bold text-[var(--muted)] w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── MetricGauges ──────────────────────────────────────────────────────────
// Row of liquid-fill circle gauges (as seen on halt1).

export type GaugeCol = { label: string; pct: number; color: string };

export function MetricGauges({ cols }: { cols: GaugeCol[] }) {
  const r = 24, sz = 56, cx = 28;
  return (
    <div className="flex">
      {cols.map(({ label, pct, color }, i) => {
        const fillH = (2 * r * pct) / 100;
        const fillY = cx + r - fillH;
        const rating = scoreLabel(pct);
        const ratingColor = scoreColor(pct);
        return (
          <div
            key={label}
            className="flex-1 min-w-0 px-2 py-4 flex flex-col items-center gap-1"
            style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}
          >
            <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
              <defs>
                <clipPath id={`gauge-${label}`}>
                  <circle cx={cx} cy={cx} r={r} />
                </clipPath>
              </defs>
              <circle cx={cx} cy={cx} r={r} fill="#e8ebee" />
              <rect
                x="0" y={fillY} width={sz} height={fillH}
                fill={color} clipPath={`url(#gauge-${label})`}
              />
            </svg>
            <p className="text-[10px] font-semibold text-[var(--text)] leading-tight text-center truncate w-full">
              {label}
            </p>
            <p className="text-[13px] font-bold leading-none text-[var(--text)]">{pct}%</p>
            <p className="text-[9px] font-semibold tracking-wide uppercase leading-none" style={{ color: ratingColor }}>
              {rating}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── CountdownCard ─────────────────────────────────────────────────────────
// Live countdown to a daily match time (HH:MM target).

export function CountdownCard({ targetHour = 18, targetMin = 30 }: { targetHour?: number; targetMin?: number }) {
  const [cd, setCd] = useState({ h: 0, m: 0, past: false });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const match = new Date();
      match.setHours(targetHour, targetMin, 0, 0);
      const diff = match.getTime() - now.getTime();
      if (diff <= 0) { setCd({ h: 0, m: 0, past: true }); return; }
      const total = Math.floor(diff / 60000);
      setCd({ h: Math.floor(total / 60), m: total % 60, past: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetHour, targetMin]);

  return (
    <StatCard padding="px-6 py-5">
      <div className="flex flex-col items-center">
        <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--muted)] mb-1">
          Next Match Starts In
        </p>
        <div className="text-[32px] font-bold text-[var(--text)] leading-none tracking-tight">
          {cd.past ? (
            <span style={{ color: "var(--green)" }}>Now</span>
          ) : (
            <>
              {String(cd.h).padStart(2, "0")}
              <span
                style={{
                  animation: "blink 1s step-start infinite",
                  display: "inline-block",
                }}
              >
                :
              </span>
              {String(cd.m).padStart(2, "0")}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </StatCard>
  );
}

// ── TimeBlock ─────────────────────────────────────────────────────────────
// Single row in a schedule list (time · dot · vertical line · title/subtitle).

export function TimeBlock({
  time,
  title,
  subtitle,
  color,
  isLast = false,
  isPast = false,
  isCurrent = false,
  segPct = 0,
  currentTimeLabel = "",
  onClick,
}: {
  time: string;
  title: string;
  subtitle?: string;
  color: string;
  isLast?: boolean;
  isPast?: boolean;
  isCurrent?: boolean;
  segPct?: number;
  currentTimeLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex gap-3">
      {/* Time */}
      <div className="w-11 flex-shrink-0 pt-0.5">
        <p className="text-[13px] font-semibold text-[var(--muted)] text-right leading-none">{time}</p>
      </div>
      {/* Dot + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0 transition-opacity"
          style={{ background: color, opacity: isPast ? 0.35 : 1 }}
        />
        {!isLast && (
          <div
            className="relative mt-1"
            style={{ width: 1, flex: 1, minHeight: 32, background: "var(--border)", overflow: "visible" }}
          >
            {isCurrent && (
              <div
                className="absolute flex items-center"
                style={{ top: `${segPct}%`, right: 0, transform: "translateY(-50%)" }}
              >
                <span
                  className="text-[13px] font-bold text-white px-2 py-0.5 rounded whitespace-nowrap mr-0.5"
                  style={{ background: "var(--green)" }}
                >
                  {currentTimeLabel}
                </span>
                <svg width="6" height="8" viewBox="0 0 6 8">
                  <polygon points="0,0 6,4 0,8" fill="var(--text)" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Content */}
      <button
        className="pb-4 flex-1 min-w-0 flex items-start justify-between gap-2 text-left active:opacity-60 transition-opacity"
        onClick={onClick}
        disabled={!onClick}
      >
        <div className="min-w-0">
          <p
            className="text-[18px] font-semibold text-[var(--text)] leading-tight"
            style={{ opacity: isPast ? 0.4 : 1 }}
          >
            {title}
          </p>
          {subtitle && (
            <p
              className="text-[14px] text-[var(--muted)] leading-snug mt-0.5"
              style={{ opacity: isPast ? 0.4 : 1 }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {onClick && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#d4d7d9" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0 mt-1.5">
            <line x1="5" y1="1" x2="5" y2="9" />
            <line x1="1" y1="5" x2="9" y2="5" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── HydrationMeter ────────────────────────────────────────────────────────
// Bottle fill gauge with +/- glass controls and dot track.

export function HydrationMeter({
  glasses,
  setGlasses,
  target = 8,
}: {
  glasses: number;
  setGlasses: (n: number) => void;
  target?: number;
}) {
  const pct = clamp(Math.round((glasses / target) * 100), 0, 100);
  const color = scoreColor(pct);
  const litres = (glasses * 0.25).toFixed(2);

  return (
    <StatCard>
      <SectionLabel>Hydration today</SectionLabel>
      <div className="flex items-center gap-4">
        {/* Bottle */}
        <div className="relative flex-shrink-0" style={{ width: 64, height: 88 }}>
          <svg width="64" height="88" viewBox="0 0 64 88">
            <defs>
              <clipPath id="hm-bottle">
                <rect x="14" y="4" width="36" height="80" rx="10" />
              </clipPath>
            </defs>
            <rect x="14" y="4" width="36" height="80" rx="10" fill="var(--border)" />
            <rect
              x="14" y={4 + 80 * (1 - pct / 100)} width="36" height={80 * pct / 100}
              fill={color} clipPath="url(#hm-bottle)"
              style={{ transition: "all 0.6s ease" }}
            />
            <rect x="22" y="0" width="20" height="6" rx="3" fill="var(--muted)" opacity="0.4" />
            <text
              x="32" y="48" textAnchor="middle" fontSize="13" fontWeight="700"
              fill="white" opacity={pct > 30 ? 1 : 0}
            >
              {pct}%
            </text>
          </svg>
        </div>

        {/* Info + controls */}
        <div className="flex-1">
          <p className="text-[28px] font-bold text-[var(--text)] leading-none">{litres}L</p>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">
            {glasses} of {target} glasses · {scoreLabel(pct)}
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setGlasses(clamp(glasses - 1, 0, 16))}
              className="w-9 h-9 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--muted)] text-lg active:scale-90 transition-transform"
            >
              −
            </button>
            <button
              onClick={() => setGlasses(clamp(glasses + 1, 0, 16))}
              className="flex-1 h-9 rounded-xl text-white text-[13px] font-semibold active:scale-[0.97] transition-transform"
              style={{ background: color }}
            >
              + Add glass
            </button>
          </div>
        </div>
      </div>

      {/* Dot track */}
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

// ── CheckInModal ──────────────────────────────────────────────────────────
// 1–5 rating modal for sleep, energy, soreness, hydration.

type CheckInKeys = "sleep" | "energy" | "soreness" | "hydration";
type CheckInState = Record<CheckInKeys, number>;

const CHECK_IN_FIELDS: { key: CheckInKeys; label: string }[] = [
  { key: "sleep",     label: "Sleep"     },
  { key: "energy",    label: "Energy"    },
  { key: "soreness",  label: "Soreness"  },
  { key: "hydration", label: "Hydration" },
];

export function CheckInModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: CheckInState) => void;
}) {
  const [checkIn, setCheckIn] = useState<CheckInState>({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2" style={{ background: "var(--green-light)" }}>
          <p className="text-[18px] font-semibold text-[var(--text)]">How do you feel?</p>
          <p className="text-[14px] text-[var(--muted)] mt-0.5 mb-4">Rate each area from 1 to 5.</p>
        </div>
        <div className="px-6 py-5 space-y-6">
          {CHECK_IN_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <p className="text-[14px] font-semibold text-[var(--text)] mb-2">{label}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const selected = checkIn[key] === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setCheckIn((c) => ({ ...c, [key]: n }))}
                      className="flex-1 aspect-square rounded-full flex items-center justify-center text-[14px] font-bold transition-all active:scale-90"
                      style={{
                        background: selected ? "var(--green)" : "transparent",
                        color: selected ? "#fff" : "var(--muted)",
                        border: selected ? "2px solid var(--green)" : "2px solid var(--border)",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={() => { onSave(checkIn); onClose(); }}
            className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
            style={{ background: "var(--green)" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── InsightCard ───────────────────────────────────────────────────────────
// Emoji icon + title + body deduction card.

export function InsightCard({
  icon,
  title,
  body,
  color,
}: {
  icon: string;
  title: string;
  body: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)] shadow-sm flex gap-3">
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
  );
}
