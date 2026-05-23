"use client";

import { useState, useEffect } from "react";

type ReviewEntry = { feeling: string; result: string; energy: string; injury: string; mentalBefore: string; mentalDuring: string; mentalAfter: string; ts: string; };
type NutritionEntry = { proteinRating: string; postMatch: string; quality: string; ts: string; };
type HydrationEntry = { litres: string; quality: string; ts: string; };

function offsetYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calcCategoryScores(
  review: ReviewEntry | null,
  nutrition: NutritionEntry | null,
  hydration: HydrationEntry | null,
  gameDays: string[],
  todayYMD: string
) {
  const lm: Record<string, number> = { "<1L": -12, "1–1.5L": -7, "1.5–2L": -3, "2–2.5L": 2, "2.5–3L": 8, "3L+": 12 };
  let performance = 60;
  if (review) {
    performance += review.result === "win" ? 12 : review.result === "loss" ? -5 : 0;
    performance += review.feeling === "great" ? 8 : review.feeling === "bad" ? -8 : 0;
    performance += review.energy === "high" ? 5 : review.energy === "low" ? -5 : 0;
  }
  let recovery = 60;
  if (hydration) { recovery += lm[hydration.litres] ?? 0; recovery += hydration.quality === "great" ? 8 : hydration.quality === "bad" ? -8 : 0; }
  if (review) { recovery += review.injury === "no" ? 5 : review.injury === "yes" ? -15 : 0; }
  let physicalHealth = 63;
  if (review) { physicalHealth += review.energy === "high" ? 10 : review.energy === "low" ? -10 : 0; physicalHealth += review.injury === "yes" ? -15 : review.injury === "no" ? 5 : 0; }
  if (hydration) physicalHealth += Math.round((lm[hydration.litres] ?? 0) / 2);
  let training = 50;
  const dow = (new Date().getDay() + 6) % 7;
  const weekStart = offsetYMD(todayYMD, -dow);
  training += gameDays.filter(d => d >= weekStart && d <= todayYMD).length * 14;
  if (nutrition) training += nutrition.quality === "great" ? 6 : nutrition.quality === "bad" ? -4 : 0;
  let wellbeing = 63;
  if (review) {
    const ms = (v: string) => v === "great" ? 5 : v === "bad" ? -5 : 0;
    wellbeing += ms(review.mentalBefore) + ms(review.mentalDuring) + ms(review.mentalAfter);
    wellbeing += review.feeling === "great" ? 4 : review.feeling === "bad" ? -4 : 0;
  }
  if (nutrition) wellbeing += nutrition.quality === "great" ? 5 : nutrition.quality === "bad" ? -5 : 0;
  const clamp = (n: number) => Math.max(10, Math.min(99, Math.round(n)));
  return { performance: clamp(performance), recovery: clamp(recovery), physicalHealth: clamp(physicalHealth), training: clamp(training), wellbeing: clamp(wellbeing) };
}

function CategoryBar({ score, color, icon, label }: { score: number; color: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1.5">
      <div className="relative flex flex-col items-center" style={{ width: 22, height: 156 }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center z-10" style={{ background: color, boxShadow: "0 0 0 2px #fff" }}>
          {icon}
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full overflow-hidden" style={{ width: 16, top: 10, background: "var(--border)" }}>
          <div className="absolute bottom-0 w-full rounded-full" style={{ height: `${score}%`, background: `linear-gradient(to top, ${color}99, ${color})` }} />
        </div>
      </div>
      <p className="text-[13px] font-extrabold leading-none text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>
        {score}<span className="text-[9px] font-bold text-[var(--muted)]">/100</span>
      </p>
      <p className="text-[8px] font-bold tracking-widest uppercase text-[var(--muted)] text-center leading-tight">{label}</p>
    </div>
  );
}

export default function CategoryScoresCard() {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const [scores, setScores] = useState({ performance: 60, recovery: 60, physicalHealth: 63, training: 50, wellbeing: 63 });

  useEffect(() => {
    try {
      const review = (JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[])[0] ?? null;
      const nutrition = (JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]") as NutritionEntry[])[0] ?? null;
      const hydration = (JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[])[0] ?? null;
      const gameDays = JSON.parse(localStorage.getItem("padelop:game-days") || "[]") as string[];
      setScores(calcCategoryScores(review, nutrition, hydration, gameDays, todayYMD));
    } catch {}
  }, []);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm px-4 py-5 mb-6">
      <div className="flex gap-1 justify-between">
        <CategoryBar score={scores.performance} color="#2653d4" label="Performance"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>}
        />
        <CategoryBar score={scores.recovery} color="#7c3aed" label="Recovery"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}
        />
        <CategoryBar score={scores.physicalHealth} color="#dc2626" label="Physical"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>}
        />
        <CategoryBar score={scores.training} color="#ea580c" label="Training"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2" /></svg>}
        />
        <CategoryBar score={scores.wellbeing} color="#16a34a" label="Wellbeing"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>}
        />
      </div>
    </div>
  );
}
