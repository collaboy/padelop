"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import WeekStrip from "./week-strip";
import Recommendations, { getRecommendations, RecCard } from "./recommendations";

const STORAGE_KEY = "padelop:game-days";
const GAME_TIMES_KEY = "padelop:game-times";
const REVIEWS_KEY = "padelop:match-reviews";
const WEEK_PLAN_PREFIX = "padelop:week-plan:";

const TIME_SLOTS = [
  { v: "morning",   label: "Morning",   hint: "Before 12" },
  { v: "afternoon", label: "Afternoon", hint: "12 – 17h" },
  { v: "evening",   label: "Evening",   hint: "17 – 20h" },
  { v: "night",     label: "Night",     hint: "After 20h" },
] as const;
type TimeSlot = typeof TIME_SLOTS[number]["v"];

type ReviewEntry = {
  ts: string;
  feeling: string; result: string; opponent: string; energy: string; injury: string;
  wellDone: string[]; improved: string[];
  mentalBefore: string; mentalDuring: string; mentalAfter: string;
};

type NutritionEntry = { ts: string; proteinRating: string; foods: string[]; postMatch: string; quality: string; };
type HydrationEntry = { ts: string; litres: string; timing: string[]; quality: string; urine: string; };

function FaceIcon({ mood, size = 28, color = "currentColor" }: { mood: "bad" | "ok" | "great"; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      {mood === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
      {mood === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
      {mood === "great" && <path d="M8 14c1 2 6 2 8 0" />}
      <circle cx="9" cy="9.5" r="0.8" fill={color} stroke="none" />
      <circle cx="15" cy="9.5" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

function EnergyIcon({ level, size = 28, color = "currentColor" }: { level: "low" | "mid" | "high"; size?: number; color?: string }) {
  if (level === "low") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="1.5" />
      <path d="M20 11v2" />
    </svg>
  );
  if (level === "mid") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2" />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C10 6 7 9 7 13a5 5 0 0 0 10 0c0-2-1-3.5-2-5 0 2-1 3-2 3-1.5 0-2.5-1.5-1-3z" />
    </svg>
  );
}

function ThumbsUpIcon({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function calcScore(review: ReviewEntry | null, nutrition: NutritionEntry | null, hydration: HydrationEntry | null): number {
  let s = 65;
  if (review) {
    s += review.feeling === "great" ? 4 : review.feeling === "bad" ? -4 : 0;
    s += review.energy === "high" ? 3 : review.energy === "low" ? -4 : 0;
    s += review.injury === "yes" ? -8 : review.injury === "no" ? 2 : 0;
  }
  if (nutrition) {
    s += nutrition.quality === "great" ? 4 : nutrition.quality === "bad" ? -4 : 0;
    s += nutrition.proteinRating === "high" ? 2 : nutrition.proteinRating === "low" ? -2 : 0;
    s += nutrition.postMatch === "yes" ? 2 : nutrition.postMatch === "no" ? -1 : 0;
  }
  if (hydration) {
    const lm: Record<string, number> = { "<1L": -6, "1–1.5L": -3, "1.5–2L": -1, "2–2.5L": 1, "2.5–3L": 3, "3L+": 5 };
    s += lm[hydration.litres] ?? 0;
    s += hydration.quality === "great" ? 2 : hydration.quality === "bad" ? -2 : 0;
  }
  return Math.max(10, Math.min(99, s));
}

function getBestTip(review: ReviewEntry | null, nutrition: NutritionEntry | null, hydration: HydrationEntry | null): { title: string; gain: number } {
  const options: { title: string; gain: number; skip: boolean }[] = [
    { title: "Sleep 8h tonight", gain: 7, skip: false },
    { title: "Reach 3L of water", gain: 5, skip: !!(hydration?.litres === "3L+" || hydration?.litres === "2.5–3L") },
    { title: "Eat protein post-match", gain: 4, skip: nutrition?.postMatch === "yes" },
    { title: "Log your nutrition", gain: 3, skip: !!nutrition },
    { title: "Log your hydration", gain: 3, skip: !!hydration },
    { title: "Review your last match", gain: 3, skip: !!review },
  ];
  return options.find((o) => !o.skip) ?? options[0];
}

function offsetYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type WeekDigest = {
  matches: number; wins: number; losses: number;
  topStrengths: string[]; topWorkOn: string[];
  avgHydrationL: number | null;
  avgEnergy: "low" | "mid" | "high" | null;
  weekLabel: string;
};

function buildWeeklyDigest(todayYMD: string): WeekDigest | null {
  try {
    const weekStart = offsetYMD(todayYMD, -6);
    const reviews = (JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[])
      .filter(r => r.ts.slice(0, 10) >= weekStart);
    const hydrations = (JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[])
      .filter(h => h.ts.slice(0, 10) >= weekStart);

    if (reviews.length === 0 && hydrations.length === 0) return null;

    const wins = reviews.filter(r => r.result === "win").length;
    const losses = reviews.filter(r => r.result === "loss").length;

    const wellCount: Record<string, number> = {};
    const workCount: Record<string, number> = {};
    reviews.forEach(r => {
      r.wellDone.forEach(t => { wellCount[t] = (wellCount[t] || 0) + 1; });
      r.improved.forEach(t => { workCount[t] = (workCount[t] || 0) + 1; });
    });
    const topStrengths = Object.entries(wellCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const topWorkOn = Object.entries(workCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

    const litreMap: Record<string, number> = { "<1L": 0.7, "1–1.5L": 1.25, "1.5–2L": 1.75, "2–2.5L": 2.25, "2.5–3L": 2.75, "3L+": 3.2 };
    const avgHydrationL = hydrations.length > 0
      ? Math.round((hydrations.reduce((s, h) => s + (litreMap[h.litres] ?? 0), 0) / hydrations.length) * 10) / 10
      : null;

    const energyScore = reviews.reduce((s, r) => s + (r.energy === "high" ? 3 : r.energy === "low" ? 1 : 2), 0);
    const avgE = reviews.length > 0 ? energyScore / reviews.length : null;
    const avgEnergy = avgE === null ? null : avgE >= 2.5 ? "high" : avgE >= 1.5 ? "mid" : "low";

    const fmtDay = (ymd: string) => new Date(ymd).getDate();
    const fmtMonth = (ymd: string) => new Date(ymd).toLocaleDateString("en-US", { month: "short" });
    const weekLabel = `${fmtMonth(weekStart)} ${fmtDay(weekStart)}–${fmtDay(todayYMD)}`;

    return { matches: reviews.length, wins, losses, topStrengths, topWorkOn, avgHydrationL, avgEnergy, weekLabel };
  } catch { return null; }
}

function StatCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] p-5 rounded-xl flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between mb-4">
        {icon}
        <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">{label}</span>
      </div>
      {children}
    </div>
  );
}

function GameDaySection() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Hydration" icon={<span className="text-xl">💧</span>}>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Drink 3.5 Liters of water</p>
            <div className="flex justify-between items-end mt-2 mb-2">
              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-hanken)" }}>2.1L</p>
              <p className="text-xs text-[var(--muted)]">of 3.5L</p>
            </div>
            <div className="w-full bg-[var(--border)] h-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "60%", background: "var(--green-mid)" }} />
            </div>
          </div>
        </StatCard>

        <StatCard label="Match Nutrition" icon={<span className="text-xl">🥗</span>}>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Pre-Match (Evening)</p>
            <p className="text-sm text-[var(--muted)] mt-1">High-carb fuel at 18:00. Brown rice &amp; salmon.</p>
          </div>
        </StatCard>

        <StatCard label="Pre-Match Drills" icon={<span className="text-xl">🎾</span>}>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Pre-Match Warm-up</p>
            <p className="text-sm text-[var(--muted)] mt-1">Dynamic mobility &amp; bandeja rhythm groove.</p>
          </div>
        </StatCard>
      </div>

      {/* Match card */}
      <div className="mt-4 rounded-xl overflow-hidden flex flex-col md:flex-row" style={{ background: "var(--green)" }}>
        <div className="md:w-1/2 p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest"
                style={{ background: "var(--lime)", color: "var(--green)" }}
              >
                MATCH DAY
              </span>
              <span className="text-xs text-white/50 font-mono">19:00 · Club Padel</span>
            </div>
            <h3 className="text-2xl font-bold text-white leading-snug" style={{ fontFamily: "var(--font-hanken)" }}>
              Tonight's Match
            </h3>
          </div>
          <div className="mt-8 flex gap-3">
            <button
              className="px-5 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase transition-colors"
              style={{ background: "var(--lime)", color: "var(--green)" }}
            >
              RSVP Confirmed
            </button>
            <button className="px-5 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase border border-white/30 text-white hover:bg-white/10 transition-colors">
              Details
            </button>
          </div>
        </div>
        <div
          className="h-48 md:h-auto md:w-1/2 bg-cover bg-center"
          style={{ background: "linear-gradient(135deg, #2d6b2d 0%, #3a8a3a 100%)" }}
        >
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1">
              <ellipse cx="8" cy="16" rx="3" ry="3" /><line x1="11" y1="13" x2="20" y2="4" /><path d="M18 2l4 4-2 2-4-4z" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}

function getWeekGameDays(): string[] {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  return [monday, thursday].map((d) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

const OPTIMIZATION_TIPS = [
  { title: "Sleep 8h tonight", detail: "Optimization rises to 76%" },
  { title: "Hydrate 3.5L today", detail: "Boosts recovery and court speed" },
  { title: "10-min mobility warmup", detail: "Reduces injury risk by 40%" },
  { title: "Eat complex carbs pre-game", detail: "Sustains energy through 3 sets" },
];


function TipSlider({ onOptimize }: { onOptimize: () => void }) {
  const [slide, setSlide] = useState(0);
  const touchStart = useRef(0);

  function onTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStart.current;
    if (delta < -40) setSlide((s) => Math.min(s + 1, 1));
    else if (delta > 40) setSlide((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="w-1/2 pt-1 pb-1 flex flex-col items-center" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex-1 flex items-center justify-center px-5">
        {slide === 0
          ? <p className="text-xs text-[var(--text)] leading-tight text-center">If you sleep 8h tonight:<br /><span className="font-bold">Optimization rises to 76%</span></p>
          : <div className="flex flex-col items-center gap-0.5">
              <p className="text-[10px] text-[var(--muted)] text-center">More ways to</p>
              <button
                onClick={onOptimize}
                className="text-[10px] font-bold tracking-wide text-center px-3 py-1.5 rounded-full border border-[var(--border)] shadow-sm active:scale-95 transition-transform"
                style={{ background: "#fff", color: "var(--text)" }}
              >
                Optimize
              </button>
            </div>
        }
      </div>
      <div className="flex gap-1 pb-1">
        {[0, 1].map((i) => (
          <div key={i} className="w-1 h-1 rounded-full" style={{ background: i === slide ? "var(--text)" : "var(--border)" }} />
        ))}
      </div>
    </div>
  );
}

export default function HomeClient() {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const mondayYMD = offsetYMD(todayYMD, -((new Date().getDay() + 6) % 7));
  const [gameDays, setGameDays] = useState<string[]>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
    return getWeekGameDays();
  });
  const [gameTimes, setGameTimes] = useState<Record<string, TimeSlot>>(() => {
    try { const s = localStorage.getItem(GAME_TIMES_KEY); if (s) return JSON.parse(s); } catch {}
    return {};
  });
  const [selectedYMD, setSelectedYMD] = useState(todayYMD);
  const [planOpen, setPlanOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "week">("today");
  const [weekPlanOpen, setWeekPlanOpen] = useState(false);
  const [weekPlanDays, setWeekPlanDays] = useState<string[]>([]);
  const [weekPlanTimes, setWeekPlanTimes] = useState<Record<string, TimeSlot>>({});
  const [matchReviewOpen, setMatchReviewOpen] = useState(false);
  const [matchReview, setMatchReview] = useState({ feeling: "", result: "", opponent: "", energy: "", injury: "", wellDone: [] as string[], improved: [] as string[], mentalBefore: "", mentalDuring: "", mentalAfter: "" });
  const [lastReview, setLastReview] = useState<ReviewEntry | null>(null);
  const [lastNutrition, setLastNutrition] = useState<NutritionEntry | null>(null);
  const [lastHydration, setLastHydration] = useState<HydrationEntry | null>(null);
  const [doneRecs, setDoneRecs] = useState<Set<number>>(new Set());
  function toggleRec(i: number) {
    setDoneRecs((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  }
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [nutritionLog, setNutritionLog] = useState({ proteinRating: "", foods: [] as string[], postMatch: "", quality: "" });
  const [hydrationOpen, setHydrationOpen] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  const [hydrationLog, setHydrationLog] = useState({ litres: "", timing: [] as string[], quality: "", urine: "" });

  useEffect(() => {
    try {
      const reviews = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]") as ReviewEntry[];
      if (reviews.length > 0) setLastReview(reviews[0]);
      const nuts = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]") as NutritionEntry[];
      if (nuts.length > 0) setLastNutrition(nuts[0]);
      const hyds = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
      if (hyds.length > 0) setLastHydration(hyds[0]);

      const isMonday = new Date().getDay() === 1;
      const alreadyPlanned = !!localStorage.getItem(WEEK_PLAN_PREFIX + mondayYMD);
      if (isMonday && !alreadyPlanned) {
        setWeekPlanDays(gameDays);
        setWeekPlanTimes(gameTimes);
        setWeekPlanOpen(true);
      }
    } catch {}

    const handleOpenWeekPlan = () => {
      setWeekPlanDays(gameDays);
      setWeekPlanTimes(gameTimes);
      setWeekPlanOpen(true);
    };
    window.addEventListener("open-week-plan", handleOpenWeekPlan);
    return () => window.removeEventListener("open-week-plan", handleOpenWeekPlan);
  }, []);

  function toggleGameDay(ymd: string) {
    setGameDays((prev) => {
      const next = prev.includes(ymd) ? prev.filter((d) => d !== ymd) : [...prev, ymd];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const isSelectedGameDay = gameDays.includes(selectedYMD);

  const todayDayType = gameDays.includes(todayYMD)
    ? "Game Day"
    : gameDays.includes(offsetYMD(todayYMD, -1))
    ? "Recovery Day"
    : "Training Day";

  function getNextGameDay(): string | null {
    for (let i = 1; i <= 7; i++) {
      const ymd = offsetYMD(todayYMD, i);
      if (gameDays.includes(ymd)) {
        const d = new Date(ymd);
        return d.toLocaleDateString("en-US", { weekday: "long" });
      }
    }
    return null;
  }

  function getLastGameDay(): string | null {
    for (let i = 1; i <= 7; i++) {
      const ymd = offsetYMD(todayYMD, -i);
      if (gameDays.includes(ymd)) {
        const d = new Date(ymd);
        return d.toLocaleDateString("en-US", { weekday: "long" });
      }
    }
    return null;
  }

  function getSummary(): string {
    const nextGame = getNextGameDay();
    const lastGame = getLastGameDay();
    const todayTime = gameTimes[todayYMD] as TimeSlot | undefined;
    const timeHint: Record<TimeSlot, string> = {
      morning:   "Eat a light breakfast 1.5h before. Aim for 8h sleep tonight.",
      afternoon: "Have a balanced lunch 2h before. Stay hydrated through the morning.",
      evening:   "Eat your main meal by 4pm. Keep it light after 5pm to avoid sluggishness.",
      night:     "Expect adrenaline after — plan a wind-down routine so it doesn't wreck your sleep.",
    };
    if (todayDayType === "Game Day") {
      const timeLine = todayTime ? ` ${timeHint[todayTime]}` : " Stay focused, warm up well, and follow your pre-game routine.";
      return `You have a match today.${timeLine}`;
    }
    if (todayDayType === "Recovery Day") {
      return `You played ${lastGame ? `on ${lastGame}` : "recently"}. Today is a recovery day — rest, hydrate, and follow your recovery checklist.${nextGame ? ` Your next game is ${nextGame}.` : ""}`;
    }
    // Training day — check if next game has a time set
    const nextGameYMD = (() => { for (let i = 1; i <= 7; i++) { const y = offsetYMD(todayYMD, i); if (gameDays.includes(y)) return y; } return null; })();
    const nextTime = nextGameYMD ? gameTimes[nextGameYMD] as TimeSlot | undefined : undefined;
    const nextTimeLabel = nextTime ? ` (${TIME_SLOTS.find(t => t.v === nextTime)?.label.toLowerCase()})` : "";
    return `Today is a training day.${nextGame ? ` You have a game ${nextGame}${nextTimeLabel} — use today to build strength and sharpen your game.` : " No upcoming game this week, so focus on building your base."}`;
  }

  const pct = calcScore(lastReview, lastNutrition, lastHydration);
  const tip = getBestTip(lastReview, lastNutrition, lastHydration);
  const digest = buildWeeklyDigest(todayYMD);

  return (
    <div className="pb-8">
      {/* Optimization score card */}
      <div className="pt-[80px] px-5 md:px-12 pb-4 bg-[var(--bg)]">
      <div className="w-full bg-[var(--surface)] flex flex-col border border-[var(--border)] rounded-2xl shadow-sm px-5 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] text-left leading-tight">Padel<br />Optimization<br />Score</p>
          <span className="text-3xl font-extrabold leading-none" style={{ color: "var(--green)", fontFamily: "var(--font-hanken)" }}>{pct}<span className="text-base font-bold text-[var(--muted)]">/100</span></span>
        </div>
        <div className="w-full mt-1 mb-6 relative">
          <div className="w-full h-6 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)" }} />
          <div className="absolute" style={{ left: `calc(${pct}% - 5px)`, top: "24px" }}>
            <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
              <polygon points="5,0 0,7 10,7" fill="#171c1f" />
            </svg>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[var(--text)] leading-none">{tip.title}</p>
            <svg width="14" height="9" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="0" y1="5" x2="13" y2="5" /><polyline points="9,1 13,5 9,9" />
            </svg>
            <span className="text-sm font-bold leading-none" style={{ color: "var(--green)" }}>+{tip.gain}%</span>
          </div>
          <Link href="/optimizer" className="px-4 py-1.5 rounded-full border border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--text)] bg-white shadow-sm active:scale-95 transition-transform flex items-center gap-1.5">
            Improve
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,1 8,5 3,9" />
            </svg>
          </Link>
        </div>
      </div>
      </div>

      {/* Today / This Week toggle card */}
      <div className="px-5 md:px-12 pb-3 bg-[var(--bg)]">
        <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-2">
            <button onClick={() => setActiveTab("today")} className="py-3 text-sm font-bold text-center border-r border-[var(--border)] active:opacity-70 transition-opacity" style={{ color: activeTab === "today" ? "var(--text)" : "var(--muted)" }}>Today</button>
            <button onClick={() => setActiveTab("week")} className="py-3 text-sm font-bold text-center active:opacity-70 transition-opacity" style={{ color: activeTab === "week" ? "var(--text)" : "var(--muted)" }}>This Week</button>
          </div>
          <div className="border-t border-[var(--border)] px-4 py-4">
            {activeTab === "today" && (
              <>
                {/* Today summary */}
                <p className="text-4xl font-extrabold text-[var(--text)] leading-none mb-2" style={{ fontFamily: "var(--font-hanken)" }}>{todayDayType}</p>
                {gameTimes[todayYMD] && (
                  <div className="flex mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[var(--border)] text-[var(--muted)]">
                      {TIME_SLOTS.find(t => t.v === gameTimes[todayYMD])?.label}
                    </span>
                  </div>
                )}
                <p className="text-sm text-[var(--muted)] leading-snug">{getSummary()}</p>
                <button onClick={() => setShowTasks(o => !o)} className="flex items-center gap-1 mt-2 active:opacity-70 transition-opacity">
                  <p className="text-sm font-bold" style={{ color: "#2653d4" }}>{showTasks ? "Hide Today's Schedule" : "Show Today's Schedule"}</p>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showTasks ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <polyline points="2,4 6,8 10,4" />
                  </svg>
                </button>

                {showTasks && (
                  <div className="mt-4 flex flex-col gap-3">
                    {/* Hydration */}
                    <button onClick={() => setHydrationOpen(true)} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-4 py-4 text-left active:opacity-80 transition-opacity">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-0.5">Hydration</p>
                          <p className="text-base font-bold text-[var(--text)]">1.8L <span className="text-sm font-normal text-[var(--muted)]">/ 3.5L</span></p>
                        </div>
                        <span className="text-2xl font-extrabold" style={{ color: "#2653d4", fontFamily: "var(--font-hanken)" }}>51%</span>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: "51%", background: "#2653d4" }} />
                      </div>
                      <div className="flex justify-between mt-2">
                        <p className="text-xs text-[var(--muted)]">Target: 3.5L today</p>
                        <p className="text-xs font-bold" style={{ color: "#2653d4" }}>+1.7L to go</p>
                      </div>
                    </button>

                    {/* Checklist */}
                    {(() => {
                      const reviewedToday = lastReview?.ts.slice(0, 10) === todayYMD;
                      const recs = getRecommendations(selectedYMD, gameDays);
                      const doneRecsList = recs.map((rec, i) => ({ rec, i })).filter(({ i }) => doneRecs.has(i));
                      const hasDone = reviewedToday || doneRecsList.length > 0;
                      const reviewCard = (done: boolean) => (
                        <button onClick={() => setMatchReviewOpen(true)} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-4 py-4 flex items-center gap-4 active:opacity-70 transition-opacity text-left" style={{ opacity: done ? 0.55 : 1 }}>
                          <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: done ? "#16a34a" : "#2653d4" }}>
                            {done ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
                              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold leading-snug" style={{ color: done ? "var(--muted)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>Review Your Last Match</p>
                            <p className="text-xs text-[var(--muted)] leading-snug mt-0.5">{done ? "Tap to update" : "Rate performance while it's still fresh"}</p>
                          </div>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="3,1 8,5 3,9" /></svg>
                        </button>
                      );
                      const allDone = reviewedToday && doneRecs.size >= recs.length;
                      return (
                        <>
                          {allDone ? (
                            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-4 py-8 flex flex-col items-center justify-center gap-2">
                              <ThumbsUpIcon size={40} color="var(--text)" />
                              <p className="text-base font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>All done for today</p>
                              <p className="text-xs text-[var(--muted)]">Great work — rest up and come back tomorrow</p>
                              <button onClick={() => setDoneRecs(new Set())} className="mt-2 px-4 py-1.5 rounded-full border border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] bg-[var(--surface)] active:scale-95 transition-transform">Edit</button>
                            </div>
                          ) : (
                            <>
                              {!reviewedToday && reviewCard(false)}
                              <Recommendations selectedYMD={selectedYMD} gameDays={gameDays} doneItems={doneRecs} onToggle={toggleRec} cardTaps={{ "Protein Recovery": () => setNutritionOpen(true) }} />
                            </>
                          )}
                          {hasDone && !allDone && (
                            <div className="mt-1">
                              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-2">Done</p>
                              <div className="flex flex-col gap-3">
                                {doneRecsList.map(({ rec, i }) => <RecCard key={i} rec={rec} isDone onToggle={() => toggleRec(i)} />)}
                                {reviewedToday && reviewCard(true)}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {activeTab === "week" && (
              <>
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-4xl font-extrabold text-[var(--text)] leading-none" style={{ fontFamily: "var(--font-hanken)" }}>Your Week</p>
                  {digest && <p className="text-xs text-[var(--muted)]">({digest.weekLabel})</p>}
                </div>
                <p className="text-sm text-[var(--muted)] leading-snug mb-2">
                  {(() => {
                    const gameCount = gameDays.filter(ymd => {
                      const today = new Date();
                      const dow = (today.getDay() + 6) % 7;
                      const monday = new Date(today);
                      monday.setDate(today.getDate() - dow);
                      const sunday = new Date(monday);
                      sunday.setDate(monday.getDate() + 6);
                      const mondayYMD = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;
                      const sundayYMD = `${sunday.getFullYear()}-${String(sunday.getMonth()+1).padStart(2,"0")}-${String(sunday.getDate()).padStart(2,"0")}`;
                      return ymd >= mondayYMD && ymd <= sundayYMD;
                    }).length;
                    const nextGame = getNextGameDay();
                    const parts = [];
                    if (gameCount > 0) parts.push(`${gameCount} game${gameCount > 1 ? "s" : ""} this week`);
                    if (nextGame) parts.push(`next game ${nextGame}`);
                    else parts.push("no upcoming games");
                    return parts.join(" · ");
                  })()}
                </p>
                <button onClick={() => setShowWeekDetails(o => !o)} className="flex items-center gap-1 mb-3 active:opacity-70 transition-opacity">
                  <p className="text-sm font-bold" style={{ color: "#2653d4" }}>{showWeekDetails ? "Hide Details" : "Show Details"}</p>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showWeekDetails ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <polyline points="2,4 6,8 10,4" />
                  </svg>
                </button>
                {showWeekDetails && <>
                {/* Horizontal grid */}
                {(() => {
                  const today = new Date();
                  const dow = (today.getDay() + 6) % 7;
                  const monday = new Date(today);
                  monday.setDate(today.getDate() - dow);
                  const days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + i);
                    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                    const isToday = ymd === todayYMD;
                    const isGame = gameDays.includes(ymd);
                    const isRecovery = !isGame && gameDays.includes(offsetYMD(ymd, -1));
                    const isPast = ymd < todayYMD;
                    const label = isGame ? "Game" : isRecovery ? "Rest" : "Train";
                    const labelColor = isGame ? "#16a34a" : isRecovery ? "#7c3aed" : "#2653d4";
                    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
                    const dayName = dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1];
                    return { d, ymd, isToday, isGame, isRecovery, isPast, label, labelColor, dayName };
                  });
                  return (
                    <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                      {/* Row 1: day name + date */}
                      <div className="grid grid-cols-7">
                        {days.map(({ ymd, isToday, isPast, d, dayName }, idx) => (
                          <div
                            key={ymd}
                            className="flex flex-col items-center justify-center py-2.5 gap-1"
                            style={{
                              borderLeft: idx > 0 ? "1px solid var(--border)" : "none",
                              boxShadow: isToday ? "inset 0 0 0 2px #2653d4" : "none",
                              opacity: isPast ? 0.25 : 1,
                            }}
                          >
                            <span className="text-[10px] font-bold" style={{ color: isToday ? "#2653d4" : "var(--muted)" }}>{dayName}</span>
                            <span className="text-sm font-bold leading-none" style={{ color: isToday ? "#2653d4" : "var(--text)" }}>{d.getDate()}</span>
                          </div>
                        ))}
                      </div>
                      {/* Row 2: type of day */}
                      <div className="grid grid-cols-7 border-t border-[var(--border)]">
                        {days.map(({ ymd, isToday, isPast, label, labelColor }, idx) => (
                          <div
                            key={ymd}
                            className="flex items-center justify-center py-2"
                            style={{
                              borderLeft: idx > 0 ? "1px solid var(--border)" : "none",
                              background: isToday ? "#f9f9f9" : "transparent",
                              opacity: isPast ? 0.25 : 1,
                            }}
                          >
                            <span className="text-base font-extrabold" style={{ color: labelColor, fontFamily: "var(--font-hanken)" }}>{label[0]}</span>
                          </div>
                        ))}
                      </div>
                      {/* Key */}
                      <div className="flex items-center gap-3 px-3 py-2 border-t border-[var(--border)]">
                        <span className="text-[10px] font-bold" style={{ color: "#16a34a" }}>G</span>
                        <span className="text-[10px] text-[var(--muted)]">Game day</span>
                        <span className="text-[10px] font-bold ml-2" style={{ color: "#7c3aed" }}>R</span>
                        <span className="text-[10px] text-[var(--muted)]">Rest</span>
                        <span className="text-[10px] font-bold ml-2" style={{ color: "#2653d4" }}>T</span>
                        <span className="text-[10px] text-[var(--muted)]">Train</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Weekly digest inline */}
                {digest && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Recap</p>
                    {digest.matches > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-0.5">
                          <p className="text-xl font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>{digest.matches}</p>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Played</p>
                        </div>
                        <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-0.5">
                          <p className="text-xl font-extrabold" style={{ fontFamily: "var(--font-hanken)", color: "#16a34a" }}>{digest.wins}</p>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Wins</p>
                        </div>
                        <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-0.5">
                          <p className="text-xl font-extrabold" style={{ fontFamily: "var(--font-hanken)", color: "#dc2626" }}>{digest.losses}</p>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Losses</p>
                        </div>
                        <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-1">
                          {digest.avgEnergy
                            ? <EnergyIcon level={digest.avgEnergy} size={20} color="var(--text)" />
                            : <span className="text-xl font-extrabold text-[var(--muted)]" style={{ fontFamily: "var(--font-hanken)" }}>—</span>
                          }
                          <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Energy</p>
                        </div>
                      </div>
                    )}
                    {digest.topStrengths.length > 0 && (
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs font-bold mt-0.5" style={{ color: "#16a34a" }}>✓</span>
                        <p className="text-xs text-[var(--text)] leading-snug"><span className="font-bold">Strengths:</span> {digest.topStrengths.join(", ")}</p>
                      </div>
                    )}
                    {digest.topWorkOn.length > 0 && (
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs font-bold mt-0.5" style={{ color: "#2653d4" }}>↑</span>
                        <p className="text-xs text-[var(--text)] leading-snug"><span className="font-bold">Focus on:</span> {digest.topWorkOn.join(", ")}</p>
                      </div>
                    )}
                    {digest.avgHydrationL !== null && (
                      <div className="flex items-center gap-2 mt-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" />
                        </svg>
                        <p className="text-xs text-[var(--muted)]">Avg hydration: <span className="font-bold text-[var(--text)]">{digest.avgHydrationL}L/day</span></p>
                      </div>
                    )}
                  </div>
                )}
                </>}
              </>
            )}
          </div>
        </div>
      </div>



      {/* Week Plan Modal */}
      {weekPlanOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="w-full max-w-[640px] bg-white rounded-t-3xl shadow-2xl px-6 pt-5 pb-10">
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5" />
            <p className="text-lg font-extrabold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-hanken)" }}>Good morning 👋</p>
            <p className="text-sm text-[var(--muted)] mb-6">When are you playing this week? Tap the days.</p>

            {/* Day tiles */}
            <div className="grid grid-cols-7 gap-2 mb-5">
              {Array.from({ length: 7 }, (_, i) => {
                const ymd = offsetYMD(mondayYMD, i);
                const d = new Date(ymd);
                const selected = weekPlanDays.includes(ymd);
                const dayLetter = ["M","T","W","T","F","S","S"][i];
                return (
                  <button
                    key={ymd}
                    onClick={() => setWeekPlanDays((prev) => prev.includes(ymd) ? prev.filter((x) => x !== ymd) : [...prev, ymd])}
                    className="flex flex-col items-center rounded-xl py-3 gap-1 border-2 transition-all active:scale-95"
                    style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#2653d4" : "var(--bg)" }}
                  >
                    <span className="text-[9px] font-bold uppercase" style={{ color: selected ? "rgba(255,255,255,0.7)" : "var(--muted)" }}>{dayLetter}</span>
                    <span className="text-sm font-bold" style={{ color: selected ? "#ffffff" : "var(--text)" }}>{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            {/* Time pickers for selected days */}
            {weekPlanDays.length > 0 && (
              <div className="flex flex-col gap-4 mb-8">
                {weekPlanDays.slice().sort().map((ymd) => {
                  const d = new Date(ymd);
                  const dayName = d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" });
                  const selected = weekPlanTimes[ymd];
                  return (
                    <div key={ymd}>
                      <p className="text-xs font-bold text-[var(--text)] mb-2">{dayName}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {TIME_SLOTS.map(({ v, label, hint }) => (
                          <button
                            key={v}
                            onClick={() => setWeekPlanTimes((prev) => ({ ...prev, [ymd]: v }))}
                            className="flex flex-col items-center py-2.5 rounded-xl border-2 transition-all active:scale-95"
                            style={{ borderColor: selected === v ? "#2653d4" : "var(--border)", background: selected === v ? "#eef2ff" : "var(--bg)" }}
                          >
                            <span className="text-[11px] font-bold" style={{ color: selected === v ? "#2653d4" : "var(--text)" }}>{label}</span>
                            <span className="text-[9px] text-[var(--muted)]">{hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {weekPlanDays.length === 0 && <div className="mb-8" />}

            {(() => {
              const missingTimes = weekPlanDays.filter(ymd => !weekPlanTimes[ymd]);
              const canSave = missingTimes.length === 0;
              return (
                <>
                  {!canSave && (
                    <p className="text-xs text-center text-[var(--muted)] mb-3">
                      Pick a time for {missingTimes.map(ymd => new Date(ymd).toLocaleDateString("en-US", { weekday: "long" })).join(", ")}
                    </p>
                  )}
                  <button
                    disabled={!canSave}
                    onClick={() => {
                      setGameDays(weekPlanDays);
                      setGameTimes(weekPlanTimes);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(weekPlanDays));
                      localStorage.setItem(GAME_TIMES_KEY, JSON.stringify(weekPlanTimes));
                      localStorage.setItem(WEEK_PLAN_PREFIX + mondayYMD, "1");
                      setWeekPlanOpen(false);
                    }}
                    className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-white transition-all"
                    style={{ background: canSave ? "#2653d4" : "var(--border)", color: canSave ? "#ffffff" : "var(--muted)", cursor: canSave ? "pointer" : "default" }}
                  >
                    Set my week
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Hydration Modal */}
      {hydrationOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setHydrationOpen(false)}>
          <div className="w-full max-w-[640px] bg-white rounded-t-3xl shadow-2xl px-6 pt-5 pb-10 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5" />
            <p className="text-lg font-extrabold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-hanken)" }}>Hydration Check</p>
            <p className="text-xs text-[var(--muted)] mb-6">Log your water intake today</p>

            {/* Litres consumed */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">How much have you drunk today?</p>
              <div className="flex gap-3">
                {["<1L", "1–1.5L", "1.5–2L", "2–2.5L", "2.5–3L", "3L+"].map((n) => {
                  const selected = hydrationLog.litres === n;
                  return (
                    <button key={n} onClick={() => setHydrationLog((l) => ({ ...l, litres: n }))}
                      className="flex-1 py-2.5 rounded-2xl border-2 text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)", color: selected ? "#2653d4" : "var(--muted)" }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What did you drink? */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">What did you drink?</p>
              <div className="flex flex-wrap gap-2">
                {["Water", "Sparkling water", "Sports drink", "Coconut water", "Tea / Coffee", "Juice", "Milk", "Protein shake"].map((drink) => {
                  const selected = hydrationLog.timing.includes(drink);
                  return (
                    <button key={drink}
                      onClick={() => setHydrationLog((l) => ({ ...l, timing: selected ? l.timing.filter((d) => d !== drink) : [...l.timing, drink] }))}
                      className="px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)", color: selected ? "#2653d4" : "var(--muted)" }}>
                      {drink}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Urine colour proxy */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-1">Urine colour check</p>
              <p className="text-[10px] text-[var(--muted)] mb-3">Best proxy for hydration status</p>
              <div className="flex gap-2">
                {[
                  { v: "clear", label: "Clear", bg: "#f0f9ff", border: "#bae6fd" },
                  { v: "pale", label: "Pale yellow", bg: "#fefce8", border: "#fde047" },
                  { v: "yellow", label: "Yellow", bg: "#fef9c3", border: "#facc15" },
                  { v: "dark", label: "Dark", bg: "#fef3c7", border: "#f59e0b" },
                  { v: "brown", label: "Brown", bg: "#fdf4dc", border: "#b45309" },
                ].map(({ v, label, bg, border }) => {
                  const selected = hydrationLog.urine === v;
                  return (
                    <button key={v} onClick={() => setHydrationLog((l) => ({ ...l, urine: v }))}
                      className="flex-1 py-2.5 rounded-2xl border-2 text-[10px] font-bold transition-all active:scale-95 text-center"
                      style={{ borderColor: selected ? border : "var(--border)", background: selected ? bg : "var(--bg)", color: "var(--muted)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Overall hydration feel */}
            <div className="mb-8">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">How do you feel?</p>
              <div className="flex gap-3">
                {([["bad", "Thirsty"], ["ok", "OK"], ["great", "Hydrated"]] as const).map(([v, label]) => {
                  const selected = hydrationLog.quality === v;
                  return (
                    <button key={v} onClick={() => setHydrationLog((l) => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)" }}>
                      <FaceIcon mood={v} color={selected ? "#2653d4" : "var(--muted)"} />
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: selected ? "#2653d4" : "var(--muted)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                const entry: HydrationEntry = { ...hydrationLog, ts: new Date().toISOString() };
                try {
                  const prev = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
                  localStorage.setItem("padelop:hydration-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                } catch {}
                setLastHydration(entry);
                setHydrationOpen(false);
              }}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-white active:scale-95 transition-transform"
              style={{ background: "#2653d4" }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Nutrition Modal */}
      {nutritionOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setNutritionOpen(false)}>
          <div className="w-full max-w-[640px] bg-white rounded-t-3xl shadow-2xl px-6 pt-5 pb-10 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5" />
            <p className="text-lg font-extrabold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-hanken)" }}>Protein Recovery</p>
            <p className="text-xs text-[var(--muted)] mb-6">Log what you ate today to track your recovery nutrition</p>

            {/* Protein rating */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">How was your protein intake today?</p>
              <div className="flex gap-3">
                {([["low", "Not enough"], ["mid", "Getting there"], ["high", "Nailed it"]] as const).map(([v, label]) => {
                  const selected = nutritionLog.proteinRating === v;
                  const icon = v === "high"
                    ? <ThumbsUpIcon size={28} color={selected ? "#2653d4" : "var(--muted)"} />
                    : <FaceIcon mood={v === "low" ? "bad" : "ok"} size={28} color={selected ? "#2653d4" : "var(--muted)"} />;
                  return (
                    <button key={v} onClick={() => setNutritionLog((l) => ({ ...l, proteinRating: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)" }}>
                      {icon}
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: selected ? "#2653d4" : "var(--muted)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Foods eaten */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">What protein sources did you have?</p>
              <div className="flex flex-wrap gap-2">
                {["Eggs", "Chicken", "Fish", "Red meat", "Greek yogurt", "Protein shake", "Legumes", "Tofu / Tempeh", "Cottage cheese", "Nuts & seeds"].map((food) => {
                  const selected = nutritionLog.foods.includes(food);
                  return (
                    <button key={food}
                      onClick={() => setNutritionLog((l) => ({ ...l, foods: selected ? l.foods.filter((f) => f !== food) : [...l.foods, food] }))}
                      className="px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)", color: selected ? "#2653d4" : "var(--muted)" }}>
                      {food}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Post-match meal */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Did you eat within 30 min post-match?</p>
              <div className="flex gap-3">
                {[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }].map(({ v, label }) => {
                  const selected = nutritionLog.postMatch === v;
                  return (
                    <button key={v} onClick={() => setNutritionLog((l) => ({ ...l, postMatch: v }))}
                      className="flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? (v === "yes" ? "#16a34a" : "#dc2626") : "var(--border)", background: selected ? (v === "yes" ? "#f0fdf4" : "#fef2f2") : "var(--bg)", color: selected ? (v === "yes" ? "#16a34a" : "#dc2626") : "var(--muted)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Overall quality */}
            <div className="mb-8">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Overall nutrition quality today?</p>
              <div className="flex gap-3">
                {([["bad", "Poor"], ["ok", "Decent"], ["great", "Great"]] as const).map(([v, label]) => {
                  const selected = nutritionLog.quality === v;
                  return (
                    <button key={v} onClick={() => setNutritionLog((l) => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)" }}>
                      <FaceIcon mood={v} color={selected ? "#2653d4" : "var(--muted)"} />
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: selected ? "#2653d4" : "var(--muted)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                const entry: NutritionEntry = { ...nutritionLog, ts: new Date().toISOString() };
                try {
                  const prev = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]");
                  localStorage.setItem("padelop:nutrition-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                } catch {}
                setLastNutrition(entry);
                const recs = getRecommendations(selectedYMD, gameDays);
                const idx = recs.findIndex((r) => r.title === "Protein Recovery");
                if (idx !== -1) toggleRec(idx);
                setNutritionOpen(false);
              }}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-white active:scale-95 transition-transform"
              style={{ background: "#2653d4" }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Match Review Modal */}
      {matchReviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setMatchReviewOpen(false)}>
          <div className="w-full max-w-[640px] bg-white rounded-t-3xl shadow-2xl px-6 pt-5 pb-10 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5" />
            <p className="text-lg font-extrabold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-hanken)" }}>Last Match Review</p>
            <p className="text-xs text-[var(--muted)] mb-6">Quick check-in while it's fresh</p>

            {/* How did it go? */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">How did the match feel?</p>
              <div className="flex gap-3">
                {([["bad", "Rough"], ["ok", "Decent"], ["great", "Great"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setMatchReview((r) => ({ ...r, feeling: v }))}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                    style={{ borderColor: matchReview.feeling === v ? "#2653d4" : "var(--border)", background: matchReview.feeling === v ? "#eef2ff" : "var(--bg)" }}
                  >
                    <FaceIcon mood={v} color={matchReview.feeling === v ? "#2653d4" : "var(--muted)"} />
                    <span className="text-[10px] font-bold tracking-wide" style={{ color: matchReview.feeling === v ? "#2653d4" : "var(--muted)" }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Result?</p>
              <div className="flex gap-3">
                {[{ v: "win", label: "Win", color: "#16a34a" }, { v: "loss", label: "Loss", color: "#dc2626" }].map(({ v, label, color }) => (
                  <button
                    key={v}
                    onClick={() => setMatchReview((r) => ({ ...r, result: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95"
                    style={{
                      borderColor: matchReview.result === v ? color : "var(--border)",
                      background: matchReview.result === v ? (v === "win" ? "#f0fdf4" : "#fef2f2") : "var(--bg)",
                      color: matchReview.result === v ? color : "var(--muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent level */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Opponent level?</p>
              <div className="flex gap-3">
                {[{ v: "easy", label: "Easier" }, { v: "equal", label: "Equal" }, { v: "tough", label: "Tougher" }].map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setMatchReview((r) => ({ ...r, opponent: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95"
                    style={{
                      borderColor: matchReview.opponent === v ? "#2653d4" : "var(--border)",
                      background: matchReview.opponent === v ? "#eef2ff" : "var(--bg)",
                      color: matchReview.opponent === v ? "#2653d4" : "var(--muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Energy level */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Your energy on court?</p>
              <div className="flex gap-3">
                {([["low", "Low"], ["mid", "Mid"], ["high", "High"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setMatchReview((r) => ({ ...r, energy: v }))}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                    style={{ borderColor: matchReview.energy === v ? "#2653d4" : "var(--border)", background: matchReview.energy === v ? "#eef2ff" : "var(--bg)" }}
                  >
                    <EnergyIcon level={v} color={matchReview.energy === v ? "#2653d4" : "var(--muted)"} />
                    <span className="text-[10px] font-bold tracking-wide" style={{ color: matchReview.energy === v ? "#2653d4" : "var(--muted)" }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Injury flags */}
            <div className="mb-8">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Any injuries or niggles?</p>
              <div className="flex gap-3">
                {[{ v: "yes", label: "Yes" }, { v: "no", label: "All good" }].map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setMatchReview((r) => ({ ...r, injury: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95"
                    style={{
                      borderColor: matchReview.injury === v ? (v === "yes" ? "#dc2626" : "#16a34a") : "var(--border)",
                      background: matchReview.injury === v ? (v === "yes" ? "#fef2f2" : "#f0fdf4") : "var(--bg)",
                      color: matchReview.injury === v ? (v === "yes" ? "#dc2626" : "#16a34a") : "var(--muted)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* What did you do well? */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">What did you do well?</p>
              <div className="flex flex-wrap gap-2">
                {["Serve", "Bandeja", "Smash", "Volleys", "Defense", "Attack", "Positioning", "Communication", "Movement", "Mental strength"].map((tag) => {
                  const selected = matchReview.wellDone.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => setMatchReview((r) => ({ ...r, wellDone: selected ? r.wellDone.filter((t) => t !== tag) : [...r.wellDone, tag] }))}
                      className="px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#16a34a" : "var(--border)", background: selected ? "#f0fdf4" : "var(--bg)", color: selected ? "#16a34a" : "var(--muted)" }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What needs improvement? */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">What needs work?</p>
              <div className="flex flex-wrap gap-2">
                {["Serve", "Bandeja", "Smash", "Volleys", "Defense", "Attack", "Positioning", "Communication", "Movement", "Mental strength"].map((tag) => {
                  const selected = matchReview.improved.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => setMatchReview((r) => ({ ...r, improved: selected ? r.improved.filter((t) => t !== tag) : [...r.improved, tag] }))}
                      className="px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#dc2626" : "var(--border)", background: selected ? "#fef2f2" : "var(--bg)", color: selected ? "#dc2626" : "var(--muted)" }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mental state */}
            <div className="mb-8">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Mental state</p>
              <div className="flex flex-col gap-3">
                {([["Before", "mentalBefore"], ["During", "mentalDuring"], ["After", "mentalAfter"]] as const).map(([phase, key]) => (
                  <div key={phase} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[var(--muted)] w-12 shrink-0">{phase}</span>
                    <div className="flex gap-2 flex-1">
                      {(["bad", "ok", "great"] as const).map((v) => {
                        const selected = matchReview[key] === v;
                        return (
                          <button
                            key={v}
                            onClick={() => setMatchReview((r) => ({ ...r, [key]: v }))}
                            className="flex-1 py-2 rounded-xl border-2 flex items-center justify-center transition-all active:scale-95"
                            style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)" }}
                          >
                            <FaceIcon mood={v} size={22} color={selected ? "#2653d4" : "var(--muted)"} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Done */}
            <button
              onClick={() => {
                const entry: ReviewEntry = { ...matchReview, ts: new Date().toISOString() };
                try {
                  const prev = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]") as ReviewEntry[];
                  localStorage.setItem(REVIEWS_KEY, JSON.stringify([entry, ...prev].slice(0, 50)));
                } catch {}
                setLastReview(entry);
                setMatchReviewOpen(false);
              }}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-white active:scale-95 transition-transform"
              style={{ background: "#2653d4" }}
            >
              Save Review
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
