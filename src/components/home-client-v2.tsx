"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import WeekStrip from "./week-strip";
import Recommendations, { getRecommendations, RecCard } from "./recommendations";
import LogSheet from "./log-sheet";
import ScoreRing from "./score-ring";
import { computeScores, loadScoringData, type Scores } from "@/lib/scoring";

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
  if (hydration) {
    recovery += lm[hydration.litres] ?? 0;
    recovery += hydration.quality === "great" ? 8 : hydration.quality === "bad" ? -8 : 0;
  }
  if (review) {
    recovery += review.injury === "no" ? 5 : review.injury === "yes" ? -15 : 0;
  }

  let physicalHealth = 63;
  if (review) {
    physicalHealth += review.energy === "high" ? 10 : review.energy === "low" ? -10 : 0;
    physicalHealth += review.injury === "yes" ? -15 : review.injury === "no" ? 5 : 0;
  }
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
  return {
    performance: clamp(performance),
    recovery: clamp(recovery),
    physicalHealth: clamp(physicalHealth),
    training: clamp(training),
    wellbeing: clamp(wellbeing),
  };
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

function CategoryBar({ score, color, icon, label }: {
  score: number;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1.5">
      <div className="relative flex flex-col items-center" style={{ width: 22, height: 156 }}>
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center z-10"
          style={{ background: color, boxShadow: "0 0 0 2px #fff" }}
        >
          {icon}
        </div>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full overflow-hidden"
          style={{ width: 16, top: 10, background: "var(--border)" }}
        >
          <div
            className="absolute bottom-0 w-full rounded-full"
            style={{ height: `${score}%`, background: `linear-gradient(to top, ${color}99, ${color})` }}
          />
        </div>
      </div>
      <p className="text-[13px] font-extrabold leading-none text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>
        {score}<span className="text-[9px] font-bold text-[var(--muted)]">/100</span>
      </p>
      <p className="text-[8px] font-bold tracking-widest uppercase text-[var(--muted)] text-center leading-tight">{label}</p>
    </div>
  );
}

export default function HomeClientV2() {
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
  const [schedSheetOpen, setSchedSheetOpen] = useState(false);

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
  const [showTasks, setShowTasks] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<{ title: string; subtitle?: string; category: ScheduleBlock["category"]; detail: string } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{ label: string; pct: number; color: string; subtitle: string; detail: string } | null>(null);
  const [gameDetails, setGameDetails] = useState<{ time: string; location: string; court: string; partner: string }>(() => {
    try { const s = localStorage.getItem("padelop:game-details"); if (s) return JSON.parse(s); } catch {}
    return { time: "21:00", location: "Di Cagno Sports Club", court: "6", partner: "Bobby M" };
  });
  const [gameDetailsOpen, setGameDetailsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [heroMetric, setHeroMetric] = useState<string>("overall");
  const [heroCardExpanded, setHeroCardExpanded] = useState(false);
  const [improveScoreOpen, setImproveScoreOpen] = useState(false);
  const [heroScores, setHeroScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const cardTouchX = useRef(0);
  const notifTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Daily Check-in
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkIn, setCheckIn] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });

  // Match Info
  const HOME_FIELD_LABELS: Record<string, string> = { date: "Date", time: "Time", player_1: "Player 1", player_2: "Player 2", player_3: "Player 3", player_4: "Player 4", club: "Club / Venue", court: "Court" };
  const [homeMatchOpen, setHomeMatchOpen] = useState(false);
  const [homeMatchDone, setHomeMatchDone] = useState(false);
  const [homeUploading, setHomeUploading] = useState(false);
  const [homeUploadError, setHomeUploadError] = useState<string | null>(null);
  const [homeExtracted, setHomeExtracted] = useState<Record<string, string | null> | null>(null);
  const [homeEdited, setHomeEdited] = useState<Record<string, string>>({});
  const homeFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("padelop:next-match");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHomeExtracted(parsed);
        setHomeEdited(Object.fromEntries(Object.keys(HOME_FIELD_LABELS).map(k => [k, parsed[k] ?? ""])));
        setHomeMatchDone(true);
      } catch {}
    }
    const openLog = () => setLogOpen(true);
    window.addEventListener("open-log-sheet", openLog);
    return () => window.removeEventListener("open-log-sheet", openLog);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHomeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 4 * 1024 * 1024) { setHomeUploadError("Image too large. Please use a screenshot under 4 MB."); return; }
    setHomeUploadError(null);
    setHomeUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/extract-match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, mediaType: file.type }) });
        const data = await res.json();
        if (data.error) { setHomeUploadError(data.message || "Couldn't read that screenshot."); setHomeUploading(false); return; }
        setHomeExtracted(data);
        setHomeEdited(Object.fromEntries(Object.keys(HOME_FIELD_LABELS).map(k => [k, data[k] ?? ""])));
        setHomeUploading(false);
      } catch { setHomeUploadError("Network error. Please try again."); setHomeUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const confirmHomeMatch = () => {
    localStorage.setItem("padelop:next-match", JSON.stringify(homeEdited));
    setHomeExtracted(homeEdited);
    setHomeMatchDone(true);
    setHomeMatchOpen(false);
  };

  useEffect(() => {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(permission => {
      if (permission !== "granted") return;
      const schedule = getDaySchedule();
      const now = Date.now();
      notifTimeouts.current.forEach(clearTimeout);
      notifTimeouts.current = schedule.flatMap(block => {
        const [h, m] = block.time.split(":").map(Number);
        const fire = new Date();
        fire.setHours(h, m, 0, 0);
        const delay = fire.getTime() - now;
        if (delay <= 0) return [];
        return [setTimeout(() => {
          new Notification(block.title, { body: block.subtitle ?? "", silent: false });
        }, delay)];
      });
    });
    return () => { notifTimeouts.current.forEach(clearTimeout); };
  }, []);

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
        window.dispatchEvent(new CustomEvent("open-week-plan"));
      }

      const scoringData = loadScoringData();
      setHeroScores(computeScores(scoringData.checkIn, scoringData.hydration, scoringData.review, scoringData.nutrition, scoringData.gameDaysThisWeek, scoringData.habits));
    } catch {}

    const handleWeekPlanSaved = () => {
      try {
        const days = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[];
        const times = JSON.parse(localStorage.getItem(GAME_TIMES_KEY) || "{}") as Record<string, TimeSlot>;
        setGameDays(days);
        setGameTimes(times);
      } catch {}
    };
    window.addEventListener("week-plan-saved", handleWeekPlanSaved);
    return () => window.removeEventListener("week-plan-saved", handleWeekPlanSaved);
  }, []);

  function toggleGameDay(ymd: string) {
    setGameDays((prev) => {
      const next = prev.includes(ymd) ? prev.filter((d) => d !== ymd) : [...prev, ymd];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const isSelectedGameDay = gameDays.includes(selectedYMD);

  // TODO: remove hardcode
  const todayDayType = "Game Day";

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
  const scores = calcCategoryScores(lastReview, lastNutrition, lastHydration, gameDays, todayYMD);

  type ScheduleBlock = {
    time: string;
    title: string;
    subtitle?: string;
    category: "wake" | "nutrition" | "training" | "game" | "recovery" | "rest" | "tip";
  };

  const SCHEDULE_COLORS: Record<ScheduleBlock["category"], string> = {
    wake:      "#f59e0b",
    nutrition: "#16a34a",
    training:  "#2653d4",
    game:      "#1e3a1e",
    recovery:  "#7c3aed",
    rest:      "#94a3b8",
    tip:       "#0891b2",
  };

  const SCHEDULE_DETAILS: Record<string, string> = {
    "Wake up & hydrate": "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration. Cold water wakes up your digestive system; warm water is gentler on an empty stomach.",
    "Light breakfast": "A light pre-match breakfast fuels short anaerobic bursts without weighing you down. Banana provides fast-releasing carbs and potassium. Toast offers sustained energy. Coffee raises alertness and delays fatigue — have it 45–60 min before match time.",
    "Breakfast": "Oats are a slow-releasing carbohydrate that keeps blood sugar stable for hours. Eggs deliver complete protein to protect muscle. Fruit provides natural sugars and hydrating water content. This combo sustains energy through to an afternoon or evening match.",
    "Pre-workout breakfast": "Fuelling before a gym or court session prevents muscle breakdown and boosts output by 10–20%. Oats give sustained energy; banana adds fast carbs and potassium to delay cramping; coffee amplifies fat oxidation and delays perceived fatigue.",
    "Morning mobility": "Light mobility work increases range of motion and blood flow without fatiguing your muscles before a match. Foam rolling uses your body weight to apply pressure and release adhesions — roll at 1–2 cm/sec, pausing 20–30 sec on tight spots. Key areas for padel: hip flexors, IT band, calves, thoracic spine.",
    "Foam roll & stretch": "Foam rolling (self-myofascial release) applies sustained pressure to muscle tissue to break up adhesions and knots. Roll slowly — pause on tight spots for 20–30 seconds. Key areas for padel: hip flexors, IT band, calves, thoracic spine. Best done when muscles are warm.",
    "Warmup & activation": "Dynamic warmup primes the neuromuscular system — it signals your fast-twitch fibres that explosive movement is coming. Lateral drills mimic court-side movement patterns. Build from 60% to 80–90% intensity. Cold muscles are slow muscles — never skip this.",
    "Pre-game meal": "A small solid meal 60–90 min before the match tops off energy stores without sitting heavy in your stomach. Eggs provide fast-absorbing protein and fats for sustained energy; toast adds digestible carbs. Keep portions modest — you want fuel, not a full stomach on court.",
    "Pre-match snack": "A light snack 60–90 min before the match avoids blood sugar dips without causing digestive discomfort during play. Banana provides potassium, which reduces cramp risk. Rice cakes are easily digestible fast carbs. Avoid high-fat or high-fibre foods — they slow gastric emptying.",
    "Match": "Match time. Focus on early rhythm — the first few games set the tempo. Communicate constantly with your partner. If losing points from the back, use the lob as a reset rather than going for winners. Stay hydrated between sets.",
    "Post-match cool down": "Cooling down gradually lowers your heart rate, preventing blood from pooling in your legs. Static stretching (30-sec holds) is most effective now — muscles are warm and pliable. Focus on quads, hip flexors, calves, and shoulder external rotators. This is the best time to improve flexibility.",
    "Recovery meal": "The 30-minute post-exercise window has the highest rate of muscle protein synthesis. Aim for 20–40 g protein + 60–80 g carbs. The carbs replenish glycogen; the protein provides amino acids for repair. A protein shake + banana works; so does chicken + rice.",
    "Post-workout fuel": "The anabolic window (first 30 minutes post-workout) is when muscles are most receptive to protein synthesis. 20–30 g of fast-absorbing protein (whey or eggs) maximises muscle repair. Adding carbs (banana, rice) replenishes glycogen faster.",
    "Lunch": "On game days, carbohydrates are your primary fuel. Complex carbs (rice, pasta, sweet potato) convert to glycogen — your muscles' preferred energy source. This meal 3–4 hours before the match gives your body time to digest and store the energy.",
    "Protein-rich lunch": "Post-match recovery demands high protein intake. Chicken, legumes, and fish provide all essential amino acids needed for muscle repair. Pairing protein with vegetables and some carbs optimises absorption and reduces inflammation from the previous day's effort.",
    "Dinner": "Post-training dinner should lean toward protein and vegetables with moderate carbs. Protein at dinner supports overnight muscle protein synthesis — your body repairs muscle during deep sleep. Avoid heavy carbs late unless you have a game the following morning.",
    "Active recovery": "20 minutes of walking or light swimming at low intensity (~50% max heart rate) accelerates lactate clearance — the metabolic byproduct responsible for muscle soreness. Research consistently shows this is more effective than complete rest at reducing next-day stiffness.",
    "Rest": "Active rest lowers cortisol (the stress hormone) while maintaining light blood flow. A 20-minute nap can increase alertness and motor skill retention — keep it under 25 min to avoid deep sleep and waking with grogginess (sleep inertia).",
    "Recovery": "Foam rolling and stretching after a training session reduces delayed-onset muscle soreness (DOMS) by increasing blood flow to worked tissue. Prioritise the hip flexors, quads, and calves — the most loaded muscles in padel court movement.",
    "Strength session": "Padel demands explosive lateral movement, shoulder stability, and rotational power. Lower body work (squats, lunges, lateral hops) builds the foundation for court speed. Rotator cuff exercises protect the shoulder from repetitive overhead and lateral forces of the bandeja and smash.",
    "Light movement": "Easy movement on recovery days maintains circulation without adding training load. A walk at conversation pace keeps your joints mobile, clears metabolic waste from sore muscles, and signals to your nervous system that it's safe to relax — essential for full recovery.",
    "Optional drills": "Light technical drill work on non-game days sharpens patterns without accumulating fatigue. Focus on mechanics: bandeja angle, serve placement, volley touch. Keep intensity at 60–70%. More important than the session: leave the court feeling better than you arrived.",
    "Match review": "Athletes who review and self-reflect improve measurably faster than those who don't. Log while it's fresh — note patterns, not one-off mistakes. What happened more than twice is a system, not an accident. Use it to define your next training focus.",
    "Review & plan": "End-of-day reflection closes the loop on your training. Ask: what worked? What do I want to sharpen? Writing it down converts fleeting thoughts into actionable training cues — and creates a data trail you can look back on.",
    "Prepare for game day": "Visualisation is a proven cognitive rehearsal technique — your nervous system barely distinguishes between vividly imagined and real movement. Spend 5–10 minutes seeing yourself play well: your best shots, your positioning, your communication with your partner. Then set out your gear so morning is frictionless.",
    "Wind down": "Blue light from screens suppresses melatonin production by up to 50%. Melatonin is the hormone that signals sleep onset. In the 60 minutes before bed: dim lights, avoid screens, try light reading or slow breathing. A consistent bedtime (±30 min) stabilises your circadian rhythm.",
    "Sleep": "Deep sleep (slow-wave) is when growth hormone is released and muscle tissue is repaired. Most padel players are under-recovered, not under-trained. 8 hours at a consistent time improves reaction time, shot accuracy, and pain tolerance. Think of sleep as the session after the session.",
  };

  function getDaySchedule(): ScheduleBlock[] {
    const gameTime = gameTimes[todayYMD] as TimeSlot | undefined;

    if (todayDayType === "Game Day") {
      if (gameTime === "morning") return [
        { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
        { time: "07:30", title: "Light breakfast", subtitle: "Toast, banana, black coffee", category: "nutrition" },
        { time: "08:15", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
        { time: "09:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
        { time: "10:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
        { time: "11:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
        { time: "13:00", title: "Lunch", subtitle: "Balanced — stay off heavy carbs", category: "nutrition" },
        { time: "15:00", title: "Rest", subtitle: "20-min nap or feet up", category: "rest" },
        { time: "19:00", title: "Dinner", subtitle: "High protein, vegetables, good fats", category: "nutrition" },
        { time: "22:30", title: "Wind down", subtitle: "No screens — sleep by 23:00", category: "rest" },
      ];
      if (gameTime === "afternoon") return [
        { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
        { time: "08:00", title: "Breakfast", subtitle: "Oats, eggs, fruit", category: "nutrition" },
        { time: "09:30", title: "Morning mobility", subtitle: "Light stretching & foam roll", category: "recovery" },
        { time: "11:00", title: "Pre-match snack", subtitle: "Banana, rice cakes — keep it light", category: "nutrition" },
        { time: "12:00", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
        { time: "13:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
        { time: "14:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
        { time: "15:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
        { time: "19:00", title: "Dinner", subtitle: "High protein, vegetables, good fats", category: "nutrition" },
        { time: "22:30", title: "Wind down", subtitle: "No screens — sleep by 23:00", category: "rest" },
      ];
      if (gameTime === "night") return [
        { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
        { time: "08:00", title: "Breakfast", subtitle: "Oats, eggs, fruit", category: "nutrition" },
        { time: "10:00", title: "Morning mobility", subtitle: "Light stretching & foam roll", category: "recovery" },
        { time: "13:00", title: "Lunch", subtitle: "Carb-heavy: rice, chicken, veg", category: "nutrition" },
        { time: "17:00", title: "Pre-match snack", subtitle: "Banana, rice cakes — keep it light", category: "nutrition" },
        { time: "19:00", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
        { time: "20:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
        { time: "21:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
        { time: "22:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
        { time: "23:30", title: "Wind down", subtitle: "Adrenaline will linger — plan a sleep routine", category: "rest" },
      ];
      // default: evening
      return [
        { time: "06:55", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
        { time: "07:15", title: "Breakfast", subtitle: "Oats, eggs, fruit", category: "nutrition" },
        { time: "09:30", title: "Morning mobility", subtitle: "Light stretching & foam roll", category: "recovery" },
        { time: "14:00", title: "Lunch", subtitle: "Carb-heavy: rice, chicken, veg", category: "nutrition" },
        { time: "17:30", title: "Pre-match snack", subtitle: "Banana, rice cakes — keep it light", category: "nutrition" },
        { time: "19:30", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
        { time: "20:00", title: "Pre-game meal", subtitle: "2 eggs and toast", category: "nutrition" },
        { time: "21:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
        { time: "22:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
        { time: "23:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
        { time: "23:45", title: "Wind down", subtitle: "Adrenaline will linger — plan a sleep routine", category: "rest" },
      ];
    }

    if (todayDayType === "Recovery Day") return [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water, no alarm stress", category: "wake" },
      { time: "08:00", title: "Light breakfast", subtitle: "Eggs, fruit, coffee", category: "nutrition" },
      { time: "09:00", title: "Active recovery", subtitle: "20-min walk or light swim", category: "recovery" },
      { time: "10:30", title: "Foam roll & stretch", subtitle: "Focus on hips, calves, shoulders", category: "recovery" },
      { time: "13:00", title: "Protein-rich lunch", subtitle: "Chicken, legumes, vegetables", category: "nutrition" },
      { time: "15:00", title: "Rest", subtitle: "20-min nap if needed", category: "rest" },
      { time: "17:00", title: "Light movement", subtitle: "Easy walk, no court intensity", category: "recovery" },
      { time: "19:00", title: "Dinner", subtitle: "Balanced: protein, veg, good fats", category: "nutrition" },
      { time: "21:00", title: "Match review", subtitle: "Log your last match while it's fresh", category: "tip" },
      { time: "22:30", title: "Wind down", subtitle: "Aim for 8h sleep tonight", category: "rest" },
    ];

    // Training Day
    const nextGameYMD = (() => { for (let i = 1; i <= 7; i++) { const y = offsetYMD(todayYMD, i); if (gameDays.includes(y)) return y; } return null; })();
    const gameIstomorrow = nextGameYMD === offsetYMD(todayYMD, 1);
    return [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
      { time: "08:00", title: "Pre-workout breakfast", subtitle: "Oats, banana, coffee", category: "nutrition" },
      { time: "09:00", title: "Strength session", subtitle: "Lower body, lateral hops, rotator cuff — 45 min", category: "training" },
      { time: "10:30", title: "Post-workout fuel", subtitle: "Protein shake or eggs within 30 min", category: "nutrition" },
      { time: "13:00", title: "Lunch", subtitle: "Balanced: carbs, protein, veg", category: "nutrition" },
      { time: "15:00", title: "Recovery", subtitle: "Foam roll, stretch, hydrate", category: "recovery" },
      { time: "17:00", title: "Optional drills", subtitle: "Bandeja, serve practice — keep it light", category: "training" },
      { time: "19:00", title: "Dinner", subtitle: gameIstomorrow ? "Carb-up tonight — game tomorrow" : "High protein, vegetables", category: "nutrition" },
      { time: "21:00", title: gameIstomorrow ? "Prepare for game day" : "Review & plan", subtitle: gameIstomorrow ? "Visualise your shots. Sleep by 22:30." : "Log training, plan tomorrow", category: "tip" },
      { time: "23:00", title: "Sleep", subtitle: "Aim for 8 hours", category: "rest" },
    ];
  }

  function renderSummaryGraphic() {
    if (todayDayType === "Game Day") {
      return null;
    }

    if (todayDayType === "Recovery Day") {
      const lastGame = getLastGameDay();
      const nextGame = getNextGameDay();
      return (
        <div className="flex flex-col gap-0.5 mb-2">
          <p>
            <span className="text-xs text-[var(--muted)]">You played </span>
            {lastGame && <span className="text-lg font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>{lastGame}</span>}
          </p>
          <p>
            <span className="text-sm font-bold text-[var(--text)]">Rest</span>
            <span className="text-xs text-[var(--muted)]"> · </span>
            <span className="text-sm font-bold text-[var(--text)]">Hydrate</span>
            <span className="text-xs text-[var(--muted)]"> · </span>
            <span className="text-sm font-bold text-[var(--text)]">Recover</span>
          </p>
          {nextGame && (
            <p className="text-xs text-[var(--muted)]">Next game: <span className="font-bold text-[var(--text)]">{nextGame}</span></p>
          )}
        </div>
      );
    }

    // Training Day
    const nextGameYMD = (() => { for (let i = 1; i <= 7; i++) { const y = offsetYMD(todayYMD, i); if (gameDays.includes(y)) return y; } return null; })();
    const nextGame = getNextGameDay();
    const nextTime = nextGameYMD ? gameTimes[nextGameYMD] as TimeSlot | undefined : undefined;
    const nextTimeLabel = nextTime ? TIME_SLOTS.find(t => t.v === nextTime)?.label : null;
    return (
      <div className="flex flex-col gap-0.5 mb-2">
        {nextGame ? (
          <>
            <p>
              <span className="text-xs text-[var(--muted)]">Next game </span>
              <span className="text-lg font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>{nextGame}</span>
              {nextTimeLabel && <span className="text-xs text-[var(--muted)]"> · {nextTimeLabel}</span>}
            </p>
            <p>
              <span className="text-sm font-bold text-[var(--text)]">Build strength</span>
              <span className="text-xs text-[var(--muted)]"> &amp; </span>
              <span className="text-sm font-bold text-[var(--text)]">sharpen your game</span>
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)]">No upcoming game this week</p>
            <p className="text-sm font-bold text-[var(--text)]">Build your base</p>
          </>
        )}
      </div>
    );
  }

  const matchReadyHeading = pct >= 80 ? "Great Work!" : pct >= 65 ? "Looking Good!" : pct >= 50 ? "Keep Going!" : "Room to Grow";
  const matchReadySubtitle = pct >= 80 ? "You're on track for a strong performance." : pct >= 65 ? "A few tweaks and you'll be match-ready." : pct >= 50 ? "Focus on recovery and nutrition today." : "Build your base — small habits compound fast.";
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className="pb-8">
      <style>{`@keyframes colonBlink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>

      {/* Do This Now */}
      {(() => {
        const schedule = getDaySchedule();
        const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        let autoIdx = 0;
        if (curMins >= toMins(schedule[schedule.length - 1].time)) { autoIdx = schedule.length - 1; }
        else { for (let i = 0; i < schedule.length - 1; i++) { if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { autoIdx = i; break; } } }
        const item = schedule[autoIdx];
        const color = SCHEDULE_COLORS[item.category];
        const detail = SCHEDULE_DETAILS[item.title];
        return (
          <div className="pt-5 px-5 md:px-12 pb-0">
            <button
              className="w-full bg-white rounded-[24px] px-5 py-5 flex items-center gap-4 active:opacity-60 transition-opacity text-left"
              style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: `2px solid ${color}` }}
              onClick={() => detail && setScheduleModal({ title: item.title, subtitle: item.subtitle, category: item.category, detail })}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
                <div className="w-3.5 h-3.5 rounded-full animate-breathe" style={{ background: color, "--glow": color } as React.CSSProperties} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055] mb-1">Do this now</p>
                <p className="text-[20px] font-bold text-[#1a1c1c] leading-tight">{item.title}</p>
                {item.subtitle && <p className="text-[13px] text-[#4a5050] mt-1 leading-snug">{item.subtitle}</p>}
              </div>
              {detail && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              )}
            </button>
          </div>
        );
      })()}

      {/* Next Match card */}
      {(() => {
        let nextYMD: string | null = null;
        for (let i = 0; i <= 30; i++) {
          const ymd = offsetYMD(todayYMD, i);
          if (gameDays.includes(ymd)) { nextYMD = ymd; break; }
        }
        if (!nextYMD) nextYMD = todayYMD;
        const isToday = nextYMD === todayYMD;
        const d = new Date(nextYMD);
        const dateLabel = isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
        return (
          <div className="px-5 md:px-12 pt-4 pb-2 bg-[var(--bg)]">
            <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
            <Link href="/matches" className="w-full px-4 py-6 flex items-center gap-4 relative overflow-hidden active:opacity-70 transition-opacity">
              {/* Greyscale racket + ball background, fading left */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <svg className="absolute right-0 top-0 h-full" style={{ width: "72%" }} viewBox="0 0 200 90" fill="none" preserveAspectRatio="xMaxYMid meet" opacity="0.13">
                  <g transform="rotate(-22, 148, 72)">
                    <rect x="110" y="4" width="76" height="82" rx="20" fill="#111" />
                    <rect x="118" y="12" width="60" height="66" rx="14" fill="white" />
                    <circle cx="131" cy="25" r="4.5" fill="#111" />
                    <circle cx="148" cy="25" r="4.5" fill="#111" />
                    <circle cx="165" cy="25" r="4.5" fill="#111" />
                    <circle cx="131" cy="40" r="4.5" fill="#111" />
                    <circle cx="148" cy="40" r="4.5" fill="#111" />
                    <circle cx="165" cy="40" r="4.5" fill="#111" />
                    <circle cx="131" cy="55" r="4.5" fill="#111" />
                    <circle cx="148" cy="55" r="4.5" fill="#111" />
                    <circle cx="165" cy="55" r="4.5" fill="#111" />
                    <circle cx="131" cy="70" r="4.5" fill="#111" />
                    <circle cx="148" cy="70" r="4.5" fill="#111" />
                    <circle cx="165" cy="70" r="4.5" fill="#111" />
                    <path d="M132 86 Q148 80 164 86 L164 88 Q148 96 132 88 Z" fill="#111" />
                    <rect x="138" y="86" width="20" height="26" rx="5" fill="#111" />
                    <line x1="138" y1="94" x2="158" y2="94" stroke="white" strokeWidth="1.5" />
                    <line x1="138" y1="102" x2="158" y2="102" stroke="white" strokeWidth="1.5" />
                  </g>
                  <circle cx="44" cy="46" r="26" fill="#111" />
                  <path d="M24 32 C32 22, 56 22, 64 32" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <path d="M24 60 C32 70, 56 70, 64 60" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(to right, var(--surface) 28%, transparent 72%)" }} />
              </div>
              <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center relative" style={{ background: "#2653d4" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="2" width="18" height="20" rx="1" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="12" y1="5" x2="12" y2="12" />
                  <line x1="12" y1="12" x2="12" y2="19" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 relative">
                <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--muted)] mb-1">Next Match</p>
                <p className="text-[19px] font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)", lineHeight: 1.1 }}>
                  {dateLabel}{gameDetails.time ? ` · ${gameDetails.time}` : ""}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)] flex-shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <p className="text-[13px] text-[var(--muted)] truncate">{gameDetails.location || "—"}</p>
                </div>
              </div>
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 relative text-[var(--muted)]">
                <polyline points="1,1 6,6 1,11" />
              </svg>
            </Link>
            <div className="border-t border-[var(--border)]" />
            <button
              onClick={() => { setHomeExtracted(null); setHomeUploadError(null); setHomeMatchOpen(true); }}
              className="w-full px-4 py-2.5 flex items-center gap-2 active:opacity-60 transition-opacity"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#9aab96" strokeWidth="1.8" strokeLinecap="round">
                <line x1="5.5" y1="1" x2="5.5" y2="10"/><line x1="1" y1="5.5" x2="10" y2="5.5"/>
              </svg>
              <span className="text-[12px] font-medium text-[#9aab96]">Add a match</span>
            </button>
            </div>
          </div>
        );
      })()}

      {/* Today + Readiness hero card */}
      {(() => {
        const now = new Date();
        const isGameToday = gameDays.includes(todayYMD);
        const isRecoveryToday = !isGameToday && gameDays.includes(offsetYMD(todayYMD, -1));
        const dayType: "match" | "recovery" | "training" | "rest" = isGameToday ? "match" : isRecoveryToday ? "recovery" : "training";
        const dayTypeMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
          match:    { label: "Game Day",     color: "#fff", bg: "#16a34a", border: "#16a34a" },
          recovery: { label: "Recovery Day", color: "#fff", bg: "#7c3aed", border: "#7c3aed" },
          training: { label: "Training Day", color: "#fff", bg: "#2563eb", border: "#2563eb" },
          rest:     { label: "Rest Day",     color: "#fff", bg: "#64748b", border: "#64748b" },
        };
        const meta = dayTypeMeta[dayType];
        const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
        const dateShort = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });
        const todayStr = todayYMD;
        const { logsToday, logLabel } = (() => {
          try {
            let count = 0;
            const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
            if (ci?.date === todayStr) count++;
            const hyd = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0];
            if (hyd?.ts?.slice(0, 10) === todayStr) count++;
            const nut = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0];
            if (nut?.ts?.slice(0, 10) === todayStr) count++;
            const rev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0];
            if (rev?.ts?.slice(0, 10) === todayStr) count++;
            const label = count >= 4 ? "All caught up — great work" : "Improve score";
            return { logsToday: count, logLabel: label };
          } catch { return { logsToday: 0, logLabel: "Improve score" }; }
        })();
        const allLogged = logsToday >= 4;
        const venue = [gameDetails.location, gameDetails.court ? `Court ${gameDetails.court}` : ""].filter(Boolean).join(" · ");
        let ctxMsg = "";
        if (dayType === "match") {
          const [mH, mM] = (gameDetails.time || "18:30").split(":").map(Number);
          const diffMins = mH * 60 + mM - now.getHours() * 60 - now.getMinutes();
          if (diffMins > 180) { const hrs = Math.floor(diffMins / 60); ctxMsg = `Match in ${hrs}h. Stay light, hydrate steadily, and eat your pre-game meal ${hrs > 4 ? "a few hours before" : "soon"}.`; }
          else if (diffMins > 60) ctxMsg = "Time to warm up. Dynamic activation, no heavy food — just sip water and focus.";
          else if (diffMins > 0) ctxMsg = "Almost game time. Breathe, visualise, and trust your prep.";
          else ctxMsg = "Great match today. Prioritise recovery — stretch, eat protein, and rest up.";
        } else if (dayType === "recovery") { ctxMsg = "Recovery day. Keep moving gently, drink plenty of water, and get your protein in.";
        } else { ctxMsg = "Training day. Make sure you're fuelled, warmed up, and ready to work on your patterns."; }
        return (
          <div className="px-5 md:px-12 pt-2 pb-4">
            <div className="rounded-[28px] mb-2 overflow-hidden" style={{ background: "#fff", boxShadow: "0 2px 24px rgba(38,83,212,0.08)", border: "1px solid #e8e8e8" }}>
              {/* Header row */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-[17px] sm:text-[22px] font-bold leading-none text-[#1a1c1c]" style={{ fontFamily: "var(--font-hanken)" }}>{weekday}</p>
                  <p className="text-[12px] sm:text-[15px] text-[#8a9096] font-medium">{dateShort}</p>
                </div>
                {dayType === "match" && gameDetails.time ? (
                  <button
                    className="flex items-center gap-1.5 text-[11px] sm:text-[13px] font-bold px-3 py-1.5 rounded-full tracking-wide active:opacity-70 transition-opacity"
                    style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                    onClick={() => setHeroCardExpanded(e => !e)}
                  >
                    {meta.label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                      style={{ transform: heroCardExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  <span className="text-[11px] sm:text-[13px] font-bold px-3 py-1.5 rounded-full tracking-wide" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>{meta.label}</span>
                )}
              </div>

              {/* Match strip — expands when pill is clicked */}
              {dayType === "match" && gameDetails.time && heroCardExpanded && (
                <button className="mx-4 mb-3 px-4 py-3 rounded-2xl flex items-center gap-3 w-[calc(100%-2rem)] active:opacity-60 transition-opacity text-left" style={{ background: "#f4f4f6", border: "1px solid #e8e8e8" }} onClick={() => { setHomeExtracted(null); setHomeUploadError(null); setHomeMatchOpen(true); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] sm:text-[15px] font-bold text-[#1a1c1c]">{gameDetails.time}</p>
                    {venue && <p className="text-[11px] sm:text-[13px] text-[#6b7480] mt-0.5 truncate">{venue}</p>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: "#f0f0f0" }} />

              {/* Ring section */}
              <div className="flex flex-col items-center pt-4 pb-4 px-5">
                {(() => {
                  let nextYMD: string | null = null;
                  for (let i = 0; i < 60; i++) {
                    const d = new Date(); d.setDate(d.getDate() + i);
                    const ymd = d.toISOString().slice(0, 10);
                    if (gameDays.includes(ymd)) { nextYMD = ymd; break; }
                  }
                  if (!nextYMD) return (
                    <button onClick={() => { setHomeExtracted(null); setHomeUploadError(null); setHomeMatchOpen(true); }} className="text-[12px] sm:text-[14px] font-semibold text-[#2653d4] mb-3 active:opacity-60 px-3 py-1.5 rounded-full" style={{ background: "#eef2ff", border: "1px solid #c5d0ff" }}>
                      + Add next match
                    </button>
                  );
                  const isToday = nextYMD === todayYMD;
                  const d = new Date(nextYMD + "T12:00");
                  const dateLabel = isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <button onClick={() => { setHomeExtracted(null); setHomeUploadError(null); setHomeMatchOpen(true); }} className="w-full mb-3 px-4 py-2.5 rounded-2xl flex items-center gap-3 active:opacity-60 transition-opacity text-left" style={{ background: "#f4f4f6" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#1a1c1c]">Next Match · {dateLabel}{gameDetails.time ? ` · ${gameDetails.time}` : ""}</p>
                        {venue && <p className="text-[11px] text-[#6b7480] mt-0.5 truncate">{venue}</p>}
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  );
                })()}
                <ScoreRing metric={heroMetric} />
                <p className="text-[22px] font-bold text-[#1a1c1c] text-center mt-4 mb-0.5">{matchReadyHeading}</p>
                <p className="text-[14px] leading-tight text-[#6b7480] text-center mb-3 px-2">{matchReadySubtitle}</p>
                <button onClick={() => setImproveScoreOpen(true)} className="flex items-center gap-1.5 px-5 py-2 rounded-full active:opacity-70 transition-opacity mt-2 mb-2" style={{ background: "#f4f4f6" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                  </svg>
                  <span className="text-[13px] font-semibold text-[#4a5050]">Improve score</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Daily Check-in card */}
      <div className="px-5 md:px-12 pb-4 bg-[var(--bg)]">
        {checkInDone ? (
          <button onClick={() => setCheckInOpen(true)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8,12 11,15 16,9"/></svg>
              <span className="text-sm font-bold text-[var(--text)]">Daily Check-in</span>
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">Done</span>
          </button>
        ) : (
          <button onClick={() => setCheckInOpen(true)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm px-4 py-5 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="text-left">
              <p className="text-lg font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>Daily Check-in</p>
              <p className="text-sm text-[var(--muted)] mt-0.5">Rate how you&apos;re feeling today</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}
      </div>

      {/* Schedule trigger row */}
      <div className="px-5 md:px-12 pb-3 bg-[var(--bg)]">
        <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden flex">
          <button
            className="flex-1 px-4 py-4 flex items-center justify-between active:opacity-70 transition-opacity"
            onClick={() => { setActiveTab("today"); setSchedSheetOpen(true); }}
          >
            <span className="text-xl font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>Today</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]"><polyline points="1,1 6,6 1,11"/></svg>
          </button>
          <div className="w-px bg-[var(--border)]" />
          <button
            className="flex-1 px-4 py-4 flex items-center justify-between active:opacity-70 transition-opacity"
            onClick={() => { setActiveTab("week"); setSchedSheetOpen(true); }}
          >
            <span className="text-xl font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>This Week</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]"><polyline points="1,1 6,6 1,11"/></svg>
          </button>
        </div>
      </div>

      {/* Schedule bottom sheet */}
      {schedSheetOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" onClick={() => setSchedSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-[var(--surface)] rounded-t-[28px] max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="px-5 pt-2 pb-3 flex items-center gap-5 flex-shrink-0 border-b border-[var(--border)]">
              <button
                onClick={() => setActiveTab("today")}
                className="text-xl font-extrabold transition-opacity"
                style={{ fontFamily: "var(--font-hanken)", color: activeTab === "today" ? "var(--text)" : "var(--muted)", opacity: activeTab === "today" ? 1 : 0.35 }}
              >Today</button>
              <button
                onClick={() => setActiveTab("week")}
                className="text-xl font-extrabold transition-opacity"
                style={{ fontFamily: "var(--font-hanken)", color: activeTab === "week" ? "var(--text)" : "var(--muted)", opacity: activeTab === "week" ? 1 : 0.35 }}
              >This Week</button>
              <button onClick={() => setSchedSheetOpen(false)} className="ml-auto w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--bg)" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-10">
              {activeTab === "today" && (() => {
                const schedule = getDaySchedule();
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                const parseMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
                return (
                  <div className="mt-4">
                    {schedule.map((block, idx, arr) => {
                      const color = SCHEDULE_COLORS[block.category];
                      const isLast = idx === arr.length - 1;
                      const blockMins = parseMins(block.time);
                      const nextMins = !isLast ? parseMins(arr[idx + 1].time) : 24 * 60;
                      const isCurrentSegment = !isLast && currentMins >= blockMins && currentMins < nextMins;
                      const segmentPct = isCurrentSegment ? ((currentMins - blockMins) / (nextMins - blockMins)) * 100 : 0;
                      const detail = SCHEDULE_DETAILS[block.title];
                      return (
                        <div key={idx} className="flex gap-3">
                          <div className="w-10 flex-shrink-0 pt-0.5">
                            <p className="text-xs font-bold text-[var(--muted)] text-right leading-none">{block.time}</p>
                          </div>
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0" style={{ background: color }} />
                            {!isLast && (
                              <div className="relative mt-1" style={{ width: 1, flex: 1, background: "var(--border)", minHeight: 28, overflow: "visible" }}>
                                {isCurrentSegment && (
                                  <div className="absolute flex items-center" style={{ top: `${segmentPct}%`, right: 0, transform: "translateY(-50%)" }}>
                                    <span className="text-sm font-bold text-white px-2.5 py-1 rounded mr-0.5 whitespace-nowrap" style={{ background: "#2653d4" }}>
                                      {String(now.getHours()).padStart(2, "0")}<span style={{ animation: "colonBlink 1s step-start infinite" }}>:</span>{String(now.getMinutes()).padStart(2, "0")}
                                    </span>
                                    <svg width="8" height="10" viewBox="0 0 8 10"><polygon points="0,0 8,5 0,10" fill="#171c1f" /></svg>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            className="pb-4 flex-1 min-w-0 flex items-start justify-between gap-2 text-left active:opacity-70 transition-opacity"
                            onClick={() => detail && setScheduleModal({ title: block.title, subtitle: block.subtitle, category: block.category, detail })}
                          >
                            <div className="min-w-0">
                              <p className="text-base font-bold text-[var(--text)] leading-tight">{block.title}</p>
                              {block.subtitle && <p className="text-sm text-[var(--muted)] leading-snug mt-0.5">{block.subtitle}</p>}
                            </div>
                            {detail && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-1">
                                <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {activeTab === "week" && (() => {
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
                  return { d, ymd, isToday, isPast, label, labelColor, dayName };
                });
                return (
                  <div className="mt-4">
                    <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                      <div className="grid grid-cols-7">
                        {days.map(({ ymd, isToday, isPast, d, dayName }, idx) => (
                          <div key={ymd} className="flex flex-col items-center justify-center py-2.5 gap-1" style={{ borderLeft: idx > 0 ? "1px solid var(--border)" : "none", boxShadow: isToday ? "inset 0 0 0 2px #2653d4" : "none", opacity: isPast ? 0.25 : 1 }}>
                            <span className="text-[10px] font-bold" style={{ color: isToday ? "#2653d4" : "var(--muted)" }}>{dayName}</span>
                            <span className="text-sm font-bold leading-none" style={{ color: isToday ? "#2653d4" : "var(--text)" }}>{d.getDate()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 border-t border-[var(--border)]">
                        {days.map(({ ymd, isToday, isPast, label, labelColor }, idx) => (
                          <div key={ymd} className="flex items-center justify-center py-2" style={{ borderLeft: idx > 0 ? "1px solid var(--border)" : "none", background: isToday ? "#f9f9f9" : "transparent", opacity: isPast ? 0.25 : 1 }}>
                            <span className="text-base font-extrabold" style={{ color: labelColor, fontFamily: "var(--font-hanken)" }}>{label[0]}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 border-t border-[var(--border)]">
                        <span className="text-[10px] font-bold" style={{ color: "#16a34a" }}>G</span><span className="text-[10px] text-[var(--muted)]">Game day</span>
                        <span className="text-[10px] font-bold ml-2" style={{ color: "#7c3aed" }}>R</span><span className="text-[10px] text-[var(--muted)]">Rest</span>
                        <span className="text-[10px] font-bold ml-2" style={{ color: "#2653d4" }}>T</span><span className="text-[10px] text-[var(--muted)]">Train</span>
                      </div>
                    </div>
                    {digest && (
                      <div className="mt-3 pt-3 border-t border-[var(--border)]">
                        <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Recap</p>
                        {digest.matches > 0 && (
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-0.5"><p className="text-xl font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>{digest.matches}</p><p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Played</p></div>
                            <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-0.5"><p className="text-xl font-extrabold" style={{ fontFamily: "var(--font-hanken)", color: "#16a34a" }}>{digest.wins}</p><p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Wins</p></div>
                            <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-0.5"><p className="text-xl font-extrabold" style={{ fontFamily: "var(--font-hanken)", color: "#dc2626" }}>{digest.losses}</p><p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Losses</p></div>
                            <div className="bg-[var(--bg)] rounded-xl py-2.5 flex flex-col items-center gap-1">{digest.avgEnergy ? <EnergyIcon level={digest.avgEnergy} size={20} color="var(--text)" /> : <span className="text-xl font-extrabold text-[var(--muted)]" style={{ fontFamily: "var(--font-hanken)" }}>—</span>}<p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)]">Energy</p></div>
                          </div>
                        )}
                        {digest.topStrengths.length > 0 && <div className="flex items-start gap-2 mb-2"><span className="text-xs font-bold mt-0.5" style={{ color: "#16a34a" }}>✓</span><p className="text-xs text-[var(--text)] leading-snug"><span className="font-bold">Strengths:</span> {digest.topStrengths.join(", ")}</p></div>}
                        {digest.topWorkOn.length > 0 && <div className="flex items-start gap-2 mb-2"><span className="text-xs font-bold mt-0.5" style={{ color: "#2653d4" }}>↑</span><p className="text-xs text-[var(--text)] leading-snug"><span className="font-bold">Focus on:</span> {digest.topWorkOn.join(", ")}</p></div>}
                        {digest.avgHydrationL !== null && <div className="flex items-center gap-2 mt-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg><p className="text-xs text-[var(--muted)]">Avg hydration: <span className="font-bold text-[var(--text)]">{digest.avgHydrationL}L/day</span></p></div>}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Improve Score modal */}
      {improveScoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setImproveScoreOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <p className="text-[18px] font-bold text-[#1a1c1c] mb-1">Improve Score</p>
              <p className="text-[13px] text-[#6b7480] mb-4">Select a metric to see what drives it and how to improve.</p>
              <div className="flex gap-1 justify-center rounded-full px-1 py-1 w-full mb-4" style={{ background: "#f4f4f6" }}>
                {[
                  { key: "overall",   label: "All",   color: "#2653d4" },
                  { key: "recovery",  label: "Rec",   color: "#7c3aed" },
                  { key: "hydration", label: "Hyd",   color: "#0891b2" },
                  { key: "energy",    label: "Nrg",   color: "#f59e0b" },
                  { key: "mobility",  label: "Mob",   color: "#16a34a" },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setHeroMetric(m.key)}
                    className="flex-1 rounded-full font-semibold transition-all whitespace-nowrap text-[13px]"
                    style={{ padding: "6px 2px", ...(heroMetric === m.key ? { background: m.color, color: "#fff" } : { background: "transparent", color: "#6b7480" }) }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {heroMetric !== "overall" && (() => {
                const details: Record<string, { color: string; desc: string; drivers: string[]; tip: string }> = {
                  recovery:  { color: "#7c3aed", desc: "How well your body has bounced back.", drivers: ["Sleep quality & duration", "Muscle soreness level", "Hydration & injury status", "Recovery habits (foam roll, cold shower, walk)"], tip: "Sleep and foam rolling have the biggest impact here." },
                  hydration: { color: "#0891b2", desc: "Your fluid balance and hydration status.", drivers: ["Litres of water logged today", "Urine colour (clear = good)", "Subjective hydration quality", "Check-in self-rating"], tip: "Log your water intake to get an accurate score." },
                  energy:    { color: "#f59e0b", desc: "Your fuel and readiness to perform.", drivers: ["Check-in energy level", "Sleep quality (sleep debt tanks energy)", "Nutrition quality & protein intake", "Post-match energy logged in review"], tip: "Protein-rich meals and good sleep move this the most." },
                  mobility:  { color: "#16a34a", desc: "Joint freedom and movement quality.", drivers: ["Soreness level (primary driver)", "Injury status", "Game activity this week", "Mobility habits (dynamic warm-up, foam roll, walk)"], tip: "10 min of daily mobility adds up fast over a week." },
                };
                const d = details[heroMetric];
                if (!d) return null;
                const score = heroScores[heroMetric as keyof Scores] ?? 65;
                return (
                  <div className="rounded-2xl overflow-hidden mb-4" style={{ background: d.color + "0d", border: `1px solid ${d.color}22` }}>
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                      <p className="text-[13px] font-bold" style={{ color: d.color }}>{d.desc}</p>
                      <span className="text-[18px] font-bold" style={{ color: d.color }}>{Math.round(score)}</span>
                    </div>
                    <div className="px-4 pb-1">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: d.color + "22" }}>
                        <div className="h-full rounded-full" style={{ width: `${score}%`, background: d.color }} />
                      </div>
                    </div>
                    <div className="px-4 pt-2 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9096] mb-1.5">What drives it</p>
                      {d.drivers.map((dr, i) => (
                        <div key={i} className="flex items-start gap-1.5 mb-1">
                          <span className="text-[10px] mt-0.5 flex-shrink-0" style={{ color: d.color }}>·</span>
                          <span className="text-[13px] text-[#4a5050] leading-snug">{dr}</span>
                        </div>
                      ))}
                      <p className="text-[12px] font-semibold mt-2" style={{ color: d.color }}>💡 {d.tip}</p>
                    </div>
                  </div>
                );
              })()}
              <button onClick={() => { setImproveScoreOpen(false); setLogOpen(true); }} className="w-full py-3 rounded-2xl text-[14px] font-semibold text-white active:opacity-70 transition-opacity" style={{ background: "#2653d4" }}>
                Log data to improve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game details modal */}
      {gameDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setGameDetailsOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4" style={{ background: "#2653d410" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#2653d4" }}>Game Details</p>
                <button onClick={() => setGameDetailsOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "rgba(0,0,0,0.08)" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" /></svg>
                </button>
              </div>
              <p className="text-xl font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>Tonight's Match</p>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {([
                { key: "time",     label: "Time",     placeholder: "e.g. 21:00" },
                { key: "location", label: "Location", placeholder: "e.g. Di Cagno Sports Club" },
                { key: "court",    label: "Court #",  placeholder: "e.g. 3" },
                { key: "partner",  label: "Partner",  placeholder: "e.g. Marco" },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] mb-1">{label}</p>
                  <input
                    type="text"
                    value={gameDetails[key]}
                    placeholder={placeholder}
                    onChange={e => setGameDetails(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full text-sm font-bold text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[#2653d4]"
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  try { localStorage.setItem("padelop:game-details", JSON.stringify(gameDetails)); } catch {}
                  setGameDetailsOpen(false);
                }}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white mt-1 active:scale-95 transition-transform"
                style={{ background: "#2653d4" }}
              >
                Save
              </button>
            </div>
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

      {/* Category metric modal */}
      {categoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setCategoryModal(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4" style={{ background: categoryModal.color + "18" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: categoryModal.color }} />
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: categoryModal.color }}>
                    {categoryModal.label}
                  </p>
                </div>
                <button
                  onClick={() => setCategoryModal(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: "rgba(0,0,0,0.08)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
              </div>
              <p className="text-xl font-extrabold text-[var(--text)] leading-tight" style={{ fontFamily: "var(--font-hanken)" }}>
                {categoryModal.label}
              </p>
              <p className="text-sm text-[var(--muted)] mt-1 leading-snug">{categoryModal.subtitle}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-3xl font-extrabold leading-none" style={{ color: categoryModal.color, fontFamily: "var(--font-hanken)" }}>{categoryModal.pct}%</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${categoryModal.pct}%`, background: categoryModal.color, transition: "width 0.4s ease" }} />
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              {categoryModal.detail.split("\n\n").map((para, i) => (
                <p key={i} className={`text-sm text-[var(--text)] leading-relaxed${i > 0 ? " mt-3" : ""}`}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule item modal */}
      {scheduleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setScheduleModal(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Coloured header strip */}
            <div className="px-6 pt-6 pb-4" style={{ background: SCHEDULE_COLORS[scheduleModal.category] + "18" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: SCHEDULE_COLORS[scheduleModal.category] }} />
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: SCHEDULE_COLORS[scheduleModal.category] }}>
                    {scheduleModal.category}
                  </p>
                </div>
                <button
                  onClick={() => setScheduleModal(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: "rgba(0,0,0,0.08)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
              </div>
              <p className="text-xl font-extrabold text-[var(--text)] leading-tight" style={{ fontFamily: "var(--font-hanken)" }}>
                {scheduleModal.title}
              </p>
              {scheduleModal.subtitle && (
                <p className="text-sm text-[var(--muted)] mt-1 leading-snug">{scheduleModal.subtitle}</p>
              )}
            </div>
            {/* Detail body */}
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--text)] leading-relaxed">{scheduleModal.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Check-in modal */}
      {checkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setCheckInOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[var(--surface)] rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2 bg-green-50">
              <p className="text-base font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>Daily Check-in</p>
              <p className="text-xs text-[var(--muted)] mt-0.5 mb-4">How are you feeling today?</p>
            </div>
            <div className="px-6 py-5 space-y-6">
              {([{ key: "sleep", label: "Sleep" }, { key: "energy", label: "Energy" }, { key: "soreness", label: "Soreness" }, { key: "hydration", label: "Hydration" }] as { key: keyof typeof checkIn; label: string }[]).map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs font-bold text-[var(--text)] mb-2">{label}</p>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => {
                      const sel = checkIn[key] === n;
                      return (
                        <button key={n} onClick={() => setCheckIn(c => ({ ...c, [key]: n }))} className="flex-1 aspect-square rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                          style={{ background: sel ? "var(--green)" : "transparent", color: sel ? "#fff" : "var(--muted)", border: sel ? "2px solid var(--green)" : "2px solid var(--border)" }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button onClick={() => { setCheckInDone(true); setCheckInOpen(false); }} className="w-full py-3 rounded-2xl text-sm font-bold text-white active:scale-[0.98] transition-transform" style={{ background: "var(--green)" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Info modal */}
      {homeMatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => { if (!homeUploading) setHomeMatchOpen(false); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[var(--surface)] rounded-3xl overflow-hidden" style={{ maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 bg-green-50 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>{homeExtracted ? "Confirm Match Info" : "Add Match Info"}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{homeExtracted ? "Check details and edit if needed." : "Upload a screenshot of your booking."}</p>
              </div>
              {!homeUploading && <button onClick={() => setHomeMatchOpen(false)} className="text-[var(--muted)] active:opacity-50"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
            </div>
            <div className="px-6 py-5">
              {homeUploading && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                  <p className="text-sm font-bold text-[var(--muted)]">Analysing screenshot…</p>
                </div>
              )}
              {!homeUploading && !homeExtracted && (
                <div className="space-y-4">
                  <input ref={homeFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleHomeFileChange} />
                  <button onClick={() => homeFileRef.current?.click()} className="w-full border-2 border-dashed border-[var(--border)] rounded-2xl py-10 flex flex-col items-center gap-3 active:bg-[var(--bg)] transition-colors">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                    <div className="text-center">
                      <p className="text-sm font-bold text-[var(--text)]">Choose screenshot</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">Booking confirmation or WhatsApp message</p>
                    </div>
                  </button>
                  {homeUploadError && <p className="text-xs text-red-600 text-center font-medium">{homeUploadError}</p>}
                </div>
              )}
              {!homeUploading && homeExtracted && (
                <div className="space-y-4">
                  {Object.keys(HOME_FIELD_LABELS).map(key => (
                    <div key={key}>
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide mb-1">{HOME_FIELD_LABELS[key]}</p>
                      <input className="w-full px-3 py-2 border border-[var(--border)] rounded-xl text-sm text-[var(--text)] bg-[var(--bg)] outline-none focus:border-[var(--green)]" value={homeEdited[key] ?? ""} placeholder="—" onChange={e => setHomeEdited(d => ({ ...d, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <button onClick={confirmHomeMatch} className="w-full py-3 rounded-2xl text-sm font-bold text-white mt-2 active:scale-[0.98] transition-transform" style={{ background: "var(--green)" }}>Confirm</button>
                  <button onClick={() => { setHomeExtracted(null); setHomeUploadError(null); }} className="w-full py-2 text-xs text-[var(--muted)] active:opacity-50">Upload a different screenshot</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setLogOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{
          bottom: "calc(5rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
          width: 56,
          height: 56,
          borderRadius: 28,
          background: "#2653d4",
          boxShadow: "0 4px 16px rgba(38,83,212,0.35)",
        }}
        aria-label="Log activity"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />

    </div>
  );
}
