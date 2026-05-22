"use client";

import type { Recommendation } from "@/lib/types";

function offsetYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getRecommendations(selectedYMD: string, gameDays: string[]): Recommendation[] {
  const isGameToday = gameDays.includes(selectedYMD);
  const isGameTomorrow = gameDays.includes(offsetYMD(selectedYMD, 1));
  const isGameYesterday = gameDays.includes(offsetYMD(selectedYMD, -1));

  if (isGameToday) {
    return [
      { category: "training", title: "Warmup & Activation", subtitle: "Dynamic stretches + lateral drills", detail: "20 min • Pre-match prep" },
      { category: "game", title: "Padel / Game Day", subtitle: "Match Play", detail: "90 min • Focus on strategy & intensity", badge: "GAME DAY" },
      { category: "nutrition", title: "Light Pre-Match Fuel", subtitle: "Rice, chicken & banana", detail: "2–3 hrs before match" },
      { category: "recovery", title: "Post-Match Cool Down", subtitle: "Mobility & stretch", detail: "15 min • Reduce soreness" },
      { category: "tip", title: "Tip of the Day", subtitle: "Stay hydrated throughout the day. Aim for 2.5L of water." },
    ];
  }

  if (isGameTomorrow) {
    return [
      { category: "training", title: "Lower Body Strength", subtitle: "Lunges, squats, lateral hops", detail: "45 min • Build power & endurance" },
      { category: "nutrition", title: "Carb-Focused Fuel", subtitle: "Rice bowl with chicken, veggies & avocado", detail: "Load up tonight" },
      { category: "recovery", title: "Early Rest", subtitle: "Aim for 8 hrs tonight", detail: "Game tomorrow — protect your sleep" },
      { category: "tip", title: "Tip of the Day", subtitle: "Visualize your best shots before sleeping. Mental prep is real prep." },
    ];
  }

  if (isGameYesterday) {
    return [
      { category: "recovery", title: "Active Recovery", subtitle: "20-min walk or light swim", detail: "Flush out lactate" },
      { category: "nutrition", title: "Protein Recovery", subtitle: "Eggs, lean meat or legumes", detail: "Rebuild muscle from yesterday" },
      { category: "training", title: "Rest or Light Movement", subtitle: "No padel today", detail: "Let your body repair" },
      { category: "tip", title: "Tip of the Day", subtitle: "Rate yesterday's match performance while it's still fresh." },
    ];
  }

  return [
    { category: "training", title: "Lower Body Strength", subtitle: "Lateral lunges, single-leg RDLs, rotator cuff", detail: "45 min • Build court movement" },
    { category: "nutrition", title: "Balanced Baseline", subtitle: "2L water, vegetables with every meal", detail: "Daily foundation" },
    { category: "tip", title: "Tip of the Day", subtitle: "Book your next session. Two padel sessions a week is where improvement compounds." },
  ];
}

export const categoryConfig: Record<Recommendation["category"], { label: string; icon: React.ReactNode }> = {
  training: {
    label: "Training",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="4" height="4" rx="1" />
        <rect x="18" y="10" width="4" height="4" rx="1" />
        <line x1="6" y1="12" x2="18" y2="12" />
        <line x1="8" y1="8" x2="8" y2="16" />
        <line x1="16" y1="8" x2="16" y2="16" />
      </svg>
    ),
  },
  game: {
    label: "Game",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="8" cy="16" rx="2.5" ry="2.5" />
        <line x1="10" y1="14" x2="19" y2="5" />
        <path d="M17 3l4 4-2 2-4-4z" />
      </svg>
    ),
  },
  nutrition: {
    label: "Nutrition",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9H4v8z" />
        <path d="M4 9c0-2 1.5-3.5 4-4 1-.2 2-.3 4-.3s3 .1 4 .3c2.5.5 4 2 4 4" />
        <path d="M8 9V7" /><path d="M12 9V6" /><path d="M16 9V7" />
      </svg>
    ),
  },
  recovery: {
    label: "Recovery",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="2" />
        <path d="M9 22V12l3-3 3 3v10" />
        <path d="M6 17l3-3" /><path d="M18 17l-3-3" />
      </svg>
    ),
  },
  tip: {
    label: "Tip",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="#ffffff" />
      </svg>
    ),
  },
};

type RecCardProps = { rec: Recommendation; isDone: boolean; onToggle: () => void; onTap?: () => void };

export function RecCard({ rec, isDone, onToggle, onTap }: RecCardProps) {
  const cfg = categoryConfig[rec.category];
  return (
    <button
      onClick={onTap ?? onToggle}
      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-4 flex items-center gap-4 active:opacity-70 transition-opacity text-left"
      style={{ opacity: isDone ? 0.55 : 1 }}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: isDone ? "#16a34a" : "#2653d4" }}>
        {isDone
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
          : cfg.icon
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug" style={{ color: isDone ? "var(--muted)" : "var(--text)", textDecoration: isDone ? "line-through" : "none" }}>{rec.title}</p>
        <p className="text-xs text-[var(--muted)] leading-snug mt-0.5">{rec.subtitle}</p>
        {rec.detail && !isDone && <p className="text-xs text-[var(--muted)] mt-0.5">{rec.detail}</p>}
        {rec.badge && !isDone && (
          <span className="inline-block mt-2 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full text-white" style={{ background: "var(--green)" }}>
            {rec.badge}
          </span>
        )}
      </div>
      {onTap && !isDone && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <polyline points="3,1 8,5 3,9" />
        </svg>
      )}
    </button>
  );
}

type Props = { selectedYMD: string; gameDays: string[]; doneItems: Set<number>; onToggle: (i: number) => void; cardTaps?: Record<string, () => void> };

export default function Recommendations({ selectedYMD, gameDays, doneItems, onToggle, cardTaps }: Props) {
  const recs = getRecommendations(selectedYMD, gameDays);
  const pending = recs.map((rec, i) => ({ rec, i })).filter(({ i }) => !doneItems.has(i));
  return (
    <div className="flex flex-col gap-3">
      {pending.map(({ rec, i }) => (
        <RecCard key={i} rec={rec} isDone={false} onToggle={() => onToggle(i)} onTap={cardTaps?.[rec.title]} />
      ))}
    </div>
  );
}
