"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { startNavLoad, startPlusOne } from "@/lib/nav-events";
import LogSheet from "@/components/log-sheet";
import ReadinessSheet from "@/components/readiness-sheet";
import PushPrompt from "@/components/push-prompt";

const ScheduleSheet = dynamic(() => import("@/components/sheets/schedule-sheet"));
const StatsSheet = dynamic(() => import("@/components/sheets/stats-sheet"));
import ScheduleItemModal from "@/components/sheets/schedule-item-modal";
import { computeFormScore, loadScoringData, computePillarStates, loadScoreHistory, computeMatchReadiness, loadMorningLog, improveTips, type MatchReadinessResult, type PillarStates, type DailyCheckIn, type HydrationEntry, type NutritionEntry, type TrainingEntry } from "@/lib/scoring";
import { pad, addMins, toMins, DRILL_LIBRARY, DEFAULT_DRILL, getTopNeedsWorkTag, getDayType, ITEM_COLORS, type ScheduleItem, type DayType, getScheduleData } from "@/lib/schedule-data";
import { saveUpcomingMatch, saveNutritionToDb, saveHydrationToDb, saveNoteToDb, saveMatchReview, saveGearToDb, saveScheduleDoneToDb, saveTrainingToDb, deleteUpcomingMatchFromDb } from "@/lib/db";
import { hydrateFromSupabase } from "@/lib/sync";
import { downloadSnapshot } from "@/lib/storage";

// ── Warmup audio captions (from 0723.srt) ────────────────────────────
const WARMUP_CUES: { from: number; text: string }[] = [
  { from: 0.0,      text: "take a breath if you're listening to this" },
  { from: 3.07,     text: "chances are your match is about 10 or 15 minutes away" },
  { from: 7.1,      text: "and right now whether you realize it or not" },
  { from: 10.43,    text: "your brain is already playing padel" },
  { from: 12.97,    text: "it's thinking about opponents" },
  { from: 15.1,     text: "it's remembering the last match" },
  { from: 17.23,    text: "it's replaying mistakes" },
  { from: 18.87,    text: "it's imagining great points that haven't happened yet" },
  { from: 22.4,     text: "the funny thing is" },
  { from: 23.47,    text: "that the actual match hasn't even started" },
  { from: 26.57,    text: "you're still in the car and that's where we'll begin" },
  { from: 30.03,    text: "because one of the most useful skills in padel" },
  { from: 32.8,     text: "has nothing to do with technique" },
  { from: 35.03,    text: "it's the ability to arrive mentally" },
  { from: 37.3,     text: "where your feet already are" },
  { from: 39.2,     text: "right now you're not playing a match" },
  { from: 41.5,     text: "you're driving to one" },
  { from: 43.07,    text: "so let the future stay in the future" },
  { from: 45.37,    text: "for a few more minutes let's do a quick check" },
  { from: 48.57,    text: "how's your hydration nothing fancy here" },
  { from: 51.83,    text: "if you've brought water good" },
  { from: 54.17,    text: "if you have electrolytes that you normally use fine" },
  { from: 57.7,     text: "if not that's fine too" },
  { from: 59.5,     text: "the goal isn't perfection" },
  { from: 61.5,     text: "the goal is simply not showing up dehydrated" },
  { from: 64.67,    text: "hydration isn't about gaining an advantage" },
  { from: 67.73,    text: "it's about avoiding an unnecessary disadvantage simple" },
  { from: 71.97,    text: "now let's talk about expectations" },
  { from: 74.23,    text: "many players arrive at the court" },
  { from: 75.77,    text: "carrying invisible luggage" },
  { from: 77.57,    text: "maybe it's their ranking maybe it's their partner" },
  { from: 80.23,    text: "maybe it's a previous loss" },
  { from: 81.8,     text: "maybe it's the belief that they should win" },
  { from: 83.77,    text: "but Padel doesn't care the court doesn't care" },
  { from: 86.43,    text: "the glass doesn't care the ball certainly doesn't care" },
  { from: 89.67,    text: "the match begins at 0 zero" },
  { from: 91.5,     text: "every single time" },
  { from: 92.87,    text: "and that's one of the most beautiful things about sport" },
  { from: 95.7,     text: "nobody owes you anything everything starts fresh" },
  { from: 98.23,    text: "now let's talk tactics not complicated tactics" },
  { from: 101.1,    text: "just useful reminders first" },
  { from: 103.47,   text: "respect the net at most club levels" },
  { from: 105.4,    text: "the team controlling the net usually controls the match" },
  { from: 108.1,    text: "that doesn't mean rushing the net recklessly" },
  { from: 110.67,   text: "it means understanding its value" },
  { from: 112.43,   text: "if you're at the back" },
  { from: 113.43,   text: "and your opponents are comfortable at the net" },
  { from: 115.8,    text: "your mission isn't necessarily to hit a winner" },
  { from: 118.4,    text: "your mission is often much simpler" },
  { from: 120.3,    text: "create an opportunity to move forward" },
  { from: 122.57,   text: "maybe that's a lob maybe it's a deep ball" },
  { from: 125.07,   text: "maybe it's patience the point isn't the shot" },
  { from: 127.77,   text: "the point is improving your position" },
  { from: 129.87,   text: "second make your opponents earn points" },
  { from: 132.57,   text: "this sounds obvious" },
  { from: 133.63,   text: "but many matches are lost because players donate points" },
  { from: 136.8,    text: "unforced errors low percentage winners" },
  { from: 139.2,    text: "hero shots the kind of shot that looks amazing once" },
  { from: 141.9,    text: "and fails four times today" },
  { from: 144.07,   text: "see what happens if you make your opponents hit" },
  { from: 146.37,   text: "one more ball then one more" },
  { from: 148.57,   text: "then one more third" },
  { from: 150.47,   text: "watch the feet if you get a comfortable ball at the net" },
  { from: 153.7,    text: "remember that the feet" },
  { from: 154.5,    text: "are often a better target than the corners" },
  { from: 156.8,    text: "a difficult volley at someone's shoes" },
  { from: 158.77,   text: "can create more problems" },
  { from: 160.3,    text: "than a spectacular shot aimed at the fence" },
  { from: 163.03,   text: "simple beats flashy" },
  { from: 164.2,    text: "more often than most players realize" },
  { from: 166.3,    text: "now let's talk about the first few games" },
  { from: 168.3,    text: "the beginning of a match tells a story" },
  { from: 170.37,   text: "and many players try to write the ending in Chapter 1" },
  { from: 173.2,    text: "don't use the first few games to gather information" },
  { from: 176.3,    text: "who likes to lob who gets nervous under pressure" },
  { from: 179.07,   text: "who serves well who rushes" },
  { from: 180.97,   text: "who stays calm think like an observer" },
  { from: 183.5,    text: "the player who learns fastest often wins" },
  { from: 185.9,    text: "and finally a reminder" },
  { from: 187.47,   text: "you're going to miss shots today" },
  { from: 189.2,    text: "everybody does professionals do" },
  { from: 191.6,    text: "beginners do everyone in between does" },
  { from: 194.4,    text: "the difference isn't who misses" },
  { from: 196.27,   text: "the difference is who recovers" },
  { from: 198.07,   text: "can you let one bad point stay one bad point" },
  { from: 200.57,   text: "can you avoid turning one mistake into three" },
  { from: 202.97,   text: "can you reset" },
  { from: 204.07,   text: "because matches are rarely decided by a single error" },
  { from: 207.03,   text: "they're often decided" },
  { from: 208.17,   text: "by the emotional reaction that follows it" },
  { from: 210.47,   text: "so as you arrive at the club" },
  { from: 212.3,    text: "leave a little room for curiosity" },
  { from: 214.4,    text: "see what kind of match this becomes" },
  { from: 216.4,    text: "compete communicate" },
  { from: 218.07,   text: "move your feet stay present" },
  { from: 220.1,    text: "and when the first point begins" },
  { from: 221.83,   text: "remember you don't need to play perfect padel" },
  { from: 224.8,    text: "you just need to make the next good decision" },
  { from: 226.9,    text: "good luck see you on court" },
];

// Local (device) calendar date as YYYY-MM-DD — NOT toISOString(), which is UTC and
// drifts a day off from the local date for several hours around local midnight
// in timezones ahead of UTC.
function localISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Tag cloud (mirrors matches4) ──────────────────────────────────────────
type ReviewEntry = { ts: string; feeling: string; result: string; opponent: string; energy: string; wellDone: string[]; improved: string[] };
type TagEntry    = { text: string; count: number; type: "good" | "bad" };

function buildTagCloud(reviews: ReviewEntry[]): TagEntry[] {
  const good: Record<string, number> = {};
  const bad:  Record<string, number> = {};
  for (const r of reviews) {
    for (const t of r.wellDone) good[t] = (good[t] ?? 0) + 1;
    for (const t of r.improved) bad[t]  = (bad[t]  ?? 0) + 1;
  }
  return [
    ...Object.entries(good).map(([text, count]) => ({ text, count, type: "good" as const })),
    ...Object.entries(bad) .map(([text, count]) => ({ text, count, type: "bad"  as const })),
  ].sort((a, b) => b.count - a.count);
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// ─────────────────────────────────────────────────────────────────────────────



const S: React.CSSProperties = { fontFamily: "Inter, sans-serif", fontSize: "clamp(17px, 4.4vw, 21px)", fontWeight: 400, color: "#111", lineHeight: 1.6 };

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DOW = ["M","T","W","T","F","S","S"];
function buildMonthCells(year: number, month: number): (number | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function getDayMsg(dayType: DayType, match: { date: string; time: string } | null, now: Date): string {
  if (dayType === "match" && match) {
    const [mH, mM] = match.time.split(":").map(Number);
    const diffMins = mH * 60 + mM - now.getHours() * 60 - now.getMinutes();
    if (diffMins > 180) { const hrs = Math.floor(diffMins / 60); return `Match in ${hrs}h — hydrate and eat your pre-match meal ${hrs > 4 ? "a few hours before" : "soon"}.`; }
    if (diffMins > 60) return "Time to warm up. Sip water and focus.";
    if (diffMins > 0) return "Almost game time. Breathe and trust your prep.";
    return "Great match today. Stretch, eat protein, and rest up.";
  }
  if (dayType === "pre-match") return "Match tomorrow — carb up tonight, get to bed early.";
  if (dayType === "recovery") return "Recovery day. Drink plenty of water and get your protein in.";
  if (dayType === "maintenance") return "Maintenance day. Hydrate, eat well, and let the body absorb the work.";
  if (dayType === "training") return "Training day — small habits compound into big results.";
  return "Hydrate, eat well, and stay consistent.";
}

function getMatchTips(
  match: { date: string; time: string } | null,
  now: Date,
  limiterTip: string | null,
): string[] {
  if (!match) return [];
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 864e5).toISOString().slice(0, 10);
  const isToday = match.date === today;
  const isTomorrow = match.date === tomorrow;
  const extra = limiterTip ? [limiterTip] : [];

  if (isToday) {
    const [mH, mM] = match.time.split(":").map(Number);
    const diffMins = mH * 60 + mM - now.getHours() * 60 - now.getMinutes();
    if (diffMins <= 0) return [
      "Stretch now while muscles are still warm.",
      "Eat protein within 45 min — eggs, chicken, or Greek yoghurt.",
      "Rehydrate: 500ml water in the next hour.",
    ];
    if (diffMins < 45) return [
      "Breathe. Trust your prep.",
      "Sip water, but don't overdrink now.",
      "Focus on your first two shots, not the whole match.",
    ];
    if (diffMins < 90) return [
      "Start your warm-up — 10 min mobility then hitting.",
      "Sip 200–300ml water in this window.",
      ...extra.slice(0, 1),
    ];
    if (diffMins < 180) return [
      `${Math.round(diffMins / 60)}h to go — light snack now if hungry: banana or toast.`,
      "Drink 400–500ml water and sip steadily until warm-up.",
      ...extra.slice(0, 1),
    ];
    if (diffMins < 360) {
      const hrs = Math.floor(diffMins / 60);
      return [
        `Pre-match meal window — eat within the next hour (${hrs}h before play).`,
        "Hydrate steadily: 500–750ml between now and warm-up.",
        ...extra.slice(0, 1),
      ];
    }
    return [
      "Main fuelling window — eat a proper meal with carbs and protein.",
      "Hit your hydration target before evening.",
      ...extra.slice(0, 1),
    ];
  }

  if (isTomorrow) return [
    "Carb-rich dinner tonight — pasta, rice, or potatoes.",
    "Aim for 8h sleep — it's your biggest performance lever.",
    ...extra.slice(0, 1),
  ];

  const diffDays = Math.round((new Date(match.date + "T12:00").getTime() - new Date(today + "T12:00").getTime()) / 86400000);
  if (diffDays <= 3) return [
    `${diffDays} days out — sharpening window. Keep sessions short and sharp.`,
    "Consistent sleep and hydration matter more than extra training.",
    ...extra.slice(0, 1),
  ];
  return [
    `${diffDays} days to go — maintain normal training load.`,
    "Sleep and hydration are the biggest levers right now.",
    ...extra.slice(0, 1),
  ];
}

export default function Home8() {
  const router = useRouter();
  const [doModalOpen, setDoModalOpen] = useState(false);
  const [schedModalIdx, setSchedModalIdx] = useState<number | null>(null);
  const [modalDetailOpen, setModalDetailOpen] = useState(false);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [readinessSheetOpen, setReadinessSheetOpen] = useState(false);
  const [logTab, setLogTab] = useState<"checkin" | "wellbeing" | "matchreview" | "hydration" | "nutrition" | "training" | null>(null);
  const [logWizard, setLogWizard] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchModalTab, setMatchModalTab] = useState<'pick' | 'confirm' | 'manual'>('pick');
  const [matchForm, setMatchForm] = useState({ date: '', time: '', club: '', court: '', p1: '', p2: '', p3: '', p4: '' });
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pastReviews, setPastReviews] = useState<{ ts: string; result: string; opponentNames: string; wellDone: string[]; improved: string[] }[]>([]);
  const [matchActionOpen, setMatchActionOpen] = useState(false);
  const [matchInfoOpen, setMatchInfoOpen] = useState(false);
  const [matchInfoTipsOpen, setMatchInfoTipsOpen] = useState(false);
  const [matchInfoMode, setMatchInfoMode] = useState<null | 'edit' | 'add'>(null);
  const [matchInfoAddTab, setMatchInfoAddTab] = useState<null | 'upload' | 'manual'>(null);
  const [editingMatchKey, setEditingMatchKey] = useState<{ date: string; time: string } | null>(null);
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; court?: string; players?: string[] } | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [matchActionMode, setMatchActionMode] = useState<null | 'edit' | 'add'>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [now, setNow] = useState(new Date());
  const lastDateRef = useRef(new Date().toISOString().slice(0, 10));
  const doneAtRef = useRef<Map<string, number>>(new Map());
  const [doIdx, setDoIdx] = useState(0); // -1 = top holder, 0 = do-this-now, 1 = see schedule
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [readiness, setReadiness] = useState(65);
  const [readinessDone, setReadinessDone] = useState(0);
  const [readinessItems, setReadinessItems] = useState([false, false, false, false]);
  const [matchReadiness, setMatchReadiness] = useState<MatchReadinessResult | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [checkInData, setCheckInData]     = useState<DailyCheckIn | null>(null);
  const [hydrationData, setHydrationData] = useState<HydrationEntry | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionEntry | null>(null);
  const [trainingData, setTrainingData]   = useState<TrainingEntry | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [mealsToday, setMealsToday] = useState<{ id: string; time: string; description: string }[]>([]);
  const [mealTime, setMealTime] = useState("");
  const [mealText, setMealText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [preMatchChecked, setPreMatchChecked] = useState<string[]>([]);
  const [preMatchDuration, setPreMatchDuration] = useState("");
  const [morningDone, setMorningDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [profile, setProfile] = useState<{ name: string; level: string }>({ name: "", level: "Recreational" });
  const [matchCount, setMatchCount] = useState(0);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [pillarStates, setPillarStates] = useState<PillarStates>({
    recovery:  { status: "not_logged", reason: "" },
    nutrition: { status: "not_logged", reason: "" },
    training:  { status: "not_logged", reason: "" },
    wellbeing: { status: "not_logged", reason: "" },
  });
  const [schedDetailOpen, setSchedDetailOpen] = useState<{ title: string; subtitle?: string; color: string; detail: string; isDrill?: boolean } | null>(null);
  const [openPanel, setOpenPanel] = useState<null | "schedule" | "stats">(null);
  const [postMatchOpen, setPostMatchOpen] = useState(false);
  const [postMatchDate, setPostMatchDate] = useState<string | null>(null);
  const [checkinNudgeOpen, setCheckinNudgeOpen] = useState(false);
  const [yesterdayWasMatch, setYesterdayWasMatch] = useState(false);
  const [gameDays, setGameDays] = useState<string[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<{ date: string; time: string }[]>([]);
  const [dayType, setDayType] = useState<DayType>("baseline");
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);

  // Seed cache-backed state synchronously on client before first paint (avoids SSR mismatch + flash)
  useLayoutEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let dt: DayType = "baseline";
    // Try day-type cache first (fastest — no derivation needed)
    try {
      const cached = JSON.parse(localStorage.getItem("padelop:day-type-cache") || "null");
      if (cached?.date === today && cached?.type) dt = cached.type as DayType;
    } catch {}
    // Seed gameDays; if no cache, derive dayType from them right here
    let gd: string[] = [];
    try { gd = JSON.parse(localStorage.getItem("padelop:game-days") || "[]"); setGameDays(gd); } catch {}
    if (dt === "baseline" && gd.length > 0) {
      dt = getDayType(gd, null, []);
      try { localStorage.setItem("padelop:day-type-cache", JSON.stringify({ date: today, type: dt })); } catch {}
    }
    setDayType(dt);
    try { const t = getTopNeedsWorkTag(); if (t) setDrillTag(t); } catch {}
    // Seed completed set before first paint — title-based so immune to schedule reordering
    try {
      const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
      const doneTitles = sd[today] ?? [];
      if (doneTitles.length > 0) setCompleted(new Set(doneTitles));
    } catch {}
    try {
      const dat: Record<string, Record<string, number>> = JSON.parse(localStorage.getItem("padelop:done-at") || "{}");
      const todayDat = dat[today] ?? {};
      Object.entries(todayDat).forEach(([title, ts]) => doneAtRef.current.set(title, ts));
    } catch {}
    setClientReady(true);
  }, []);

  // Recompute + re-cache when Supabase data arrives (match schedule may have changed)
  useEffect(() => {
    const computed = getDayType(gameDays, match, upcomingMatches);
    setDayType(computed);
    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem("padelop:day-type-cache", JSON.stringify({ date: today, type: computed }));
    } catch {}
  }, [gameDays, match, upcomingMatches]);

  const [logHydrationMl, setLogHydrationMl] = useState(0);
  const [hydrationToastOn, setHydrationToastOn] = useState(false);
  const hydrationToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logGaugeRef    = useRef<HTMLDivElement>(null);
  const logDragStartX  = useRef(0);
  const logDragStartMl = useRef(0);
  const LOG_GOAL_ML = 2500;
  const LOG_MAX_ML  = 3000;


  const [warmupPlaying, setWarmupPlaying] = useState(false);
  const [warmupCurrentTime, setWarmupCurrentTime] = useState(0);
  const [warmupDuration, setWarmupDuration] = useState(0);
  const [warmupStarted, setWarmupStarted] = useState(false);
  const warmupAudioRef = useRef<HTMLAudioElement | null>(null);
  const warmupAudioCtxRef = useRef<AudioContext | null>(null);
  const warmupAnalyserRef = useRef<AnalyserNode | null>(null);
  const warmupSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const warmupVizRef = useRef<HTMLCanvasElement | null>(null);
  const warmupRafRef = useRef<number | null>(null);
  const warmupCurrentTimeRef = useRef(0);
  const warmupDurationRef = useRef(0);
  const isScrubbing = useRef(false);

  useEffect(() => {
    const resumeWarmupAudio = () => {
      if (document.visibilityState === "visible") {
        warmupAudioCtxRef.current?.resume();
        if (warmupPlaying && warmupAudioRef.current?.paused) warmupAudioRef.current.play();
      }
    };
    document.addEventListener("visibilitychange", resumeWarmupAudio);
    window.addEventListener("pageshow", resumeWarmupAudio);
    return () => {
      document.removeEventListener("visibilitychange", resumeWarmupAudio);
      window.removeEventListener("pageshow", resumeWarmupAudio);
    };
  }, [warmupPlaying]);

  const matchUploadRef = useRef<HTMLInputElement>(null);
  const actionUploadRef = useRef<HTMLInputElement>(null);
  const [drumIdx, setDrumIdx] = useState(0);
  const drumDragRef = useRef<{ startY: number; startIdx: number } | null>(null);
  const [drumLiveOffset, setDrumLiveOffset] = useState(0);
  const outerRef = useRef<HTMLDivElement>(null);
  const doIdxRef = useRef(doIdx);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const hitTopYRef = useRef<number | null>(null); // Y when scroll first reached 0
  const handleDragStartY = useRef(0);
  const swipeDirRef = useRef<'h' | 'v' | null>(null);
  const dayTypeRef = useRef<DayType>("baseline");
  const drillTagRef = useRef<string | null>(null);
  // Keep refs current so stale-closure callbacks (loadReadiness) always use latest values
  dayTypeRef.current = dayType;
  drillTagRef.current = drillTag;
  const settlingRef = useRef(false);
  const checkinNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPostMatchOpenRef = useRef(false);
  const postMatchOpenRef = useRef(false);
  postMatchOpenRef.current = postMatchOpen;
  const [cardSnap, setCardSnap] = useState<'none' | 'left' | 'right'>('none');
  const [liveX, setLiveX] = useState(0);
  const [liveY, setLiveY] = useState(0);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathPhaseProgress, setBreathPhaseProgress] = useState(0);
  const breathStartRef = useRef(Date.now());

  useEffect(() => {
    // Redirect incomplete profiles to onboarding
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.from("profiles").select("display_name").single().then(({ data }) => {
        if (data && !data.display_name) router.push("/onboarding");
      });
    });
    hydrateFromSupabase().then(result => {
      if (result) {
        setGameDays(result.gameDays);
        setUpcomingMatches(result.upcoming);
      }
    });
    // Seal yesterday's schedule completion into padelop:schedule-history
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const history: { date: string; dayType: string; total: number; completed: number; pct: number; titles: string[] }[] =
        JSON.parse(localStorage.getItem("padelop:schedule-history") || "[]");
      const alreadySealed = history.some(h => h.date === yesterday);
      if (!alreadySealed) {
        const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
        const doneTitles = sd[yesterday] ?? [];
        let yDayType: DayType = "baseline";
        try {
          const nm = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
          const twoDaysAgo = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
          const revs: { ts?: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
          if (nm?.date === yesterday) {
            yDayType = "match";
          } else if (nm?.date === today) {
            yDayType = "pre-match";
          } else {
            const matchDates = revs
              .map(r => r.ts?.slice(0, 10))
              .filter((d): d is string => !!d && d <= yesterday)
              .sort().reverse();
            if (matchDates.length === 0) { yDayType = "baseline"; }
            else {
              const daysSince = Math.round((new Date(yesterday + "T12:00").getTime() - new Date(matchDates[0] + "T12:00").getTime()) / 86400000);
              if (daysSince === 0) yDayType = "match";
              else if (daysSince === 1) yDayType = "recovery";
              else yDayType = (daysSince - 2) % 2 === 0 ? "maintenance" : "training";
            }
          }
          void twoDaysAgo;
        } catch {}
        const ySched = getScheduleData(yDayType, null, getTopNeedsWorkTag()).schedule;
        const total = ySched.length;
        const completed = ySched.filter(s => doneTitles.includes(s.title)).length;
        const pct = total ? Math.round((completed / total) * 100) : 0;
        history.unshift({ date: yesterday, dayType: yDayType, total, completed, pct, titles: doneTitles });
        localStorage.setItem("padelop:schedule-history", JSON.stringify(history.slice(0, 90)));
      }
      void todayStr;
    } catch {}
    // Seal yesterday's water meter into hydration-logs and reset the meter
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
      if (hq?.date && hq.date < todayStr && hq.ml > 0) {
        const logs: { ts: string; litres: string; urine: string; quality: string; timing: string[] }[] =
          JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
        const alreadySealed = logs.some(l => l.ts?.startsWith(hq.date));
        if (!alreadySealed) {
          const mlToLitres = (ml: number) => {
            if (ml < 1000) return "<1L";
            if (ml < 1500) return "1–1.5L";
            if (ml < 2000) return "1.5–2L";
            if (ml < 2500) return "2–2.5L";
            if (ml < 3000) return "2.5–3L";
            return "3L+";
          };
          logs.unshift({ ts: `${hq.date}T23:59:00.000Z`, litres: mlToLitres(hq.ml), urine: "", quality: "ok", timing: [] });
          localStorage.setItem("padelop:hydration-logs", JSON.stringify(logs.slice(0, 90)));
        }
        localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayStr, ml: 0 }));
      }
      void yesterday;
    } catch {}
    // Re-sync when user switches back to this tab/app
    let lastSync = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 5_000) {
        lastSync = Date.now();
        hydrateFromSupabase().then(result => {
          if (result) { setGameDays(result.gameDays); setUpcomingMatches(result.upcoming); }
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    function loadReadiness() {
      const d = loadScoringData();
      const morningLog = loadMorningLog();
      setReadiness(computeFormScore().score);
      setMatchReadiness(computeMatchReadiness(d.checkIn, morningLog, false, d.review));
      setCheckInData(d.checkIn);
      setHydrationData(d.hydration);
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
        const hasQuickToday = hq?.date === todayKey;
        let hml = hasQuickToday ? (hq.ml ?? 0) : 0;
        // Fall back to hydration-logs if no quick entry today
        if (!hasQuickToday) {
          const logEntry = (JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as Array<{ ts: string; litres: string }>)[0];
          if (logEntry?.ts?.slice(0, 10) === todayKey) {
            const litreMap: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
            hml = litreMap[logEntry.litres] ?? 0;
          }
        }
        // Final fallback: morning check-in water on waking = at least 500ml
        if (hml === 0) {
          const morningLog = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
          if (morningLog?.date === todayKey && morningLog?.waterOnWaking === true) hml = 500;
        }
        setLogHydrationMl(hml);
        const ri = [!!d.checkIn, hml >= 2500, !!d.nutrition, !!d.training];
        setReadinessDone(ri.filter(Boolean).length);
        setReadinessItems(ri);
      } catch {
        setLogHydrationMl(0);
        const ri = [!!d.checkIn, false, !!d.nutrition, !!d.training];
        setReadinessDone(ri.filter(Boolean).length);
        setReadinessItems(ri);
      }
      setNutritionData(d.nutrition);
      setTrainingData(d.training);
      try {
        const todayKey2 = new Date().toISOString().slice(0, 10);
        const mealLog = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
        setMealsToday(mealLog.filter((m: { date: string }) => m.date === todayKey2));
      } catch { setMealsToday([]); }
      try {
        const raw = localStorage.getItem("padelop:match-reviews");
        setReviews(raw ? (JSON.parse(raw) as ReviewEntry[]) : []);
      } catch { setReviews([]); }
      const todayStr = new Date().toISOString().slice(0, 10);
      // Compute streak — union of check-in history + score snapshots, 1-day grace for sync gaps
      const ciHistory: { date: string }[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:checkin-history") || "[]"); } catch { return []; } })();
      const scoreHistory = loadScoreHistory();
      const dateset = new Set([...ciHistory.map(c => c.date), ...scoreHistory.map(s => s.date)]);
      let s = 0;
      const cur = new Date();
      if (!dateset.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
      let graceUsed = false;
      while (true) {
        const d = cur.toISOString().slice(0, 10);
        if (dateset.has(d)) { s++; graceUsed = false; }
        else if (!graceUsed) { graceUsed = true; }
        else break;
        cur.setDate(cur.getDate() - 1);
      }
      setStreak(s);
      try {
        const p = JSON.parse(localStorage.getItem("padelop:profile") || "null");
        if (p) setProfile(p);
      } catch {}
      try {
        const reviews: { result: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
        setMatchCount(reviews.length);
        const decided = reviews.filter(r => r.result === "win" || r.result === "loss");
        setWinRate(decided.length > 0 ? Math.round((decided.filter(r => r.result === "win").length / decided.length) * 100) : null);
      } catch {}
      let m: { date: string; time: string } | null = null;
      try { m = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
      const matchToday = m?.date === todayStr;
      setPillarStates(computePillarStates(d.checkIn, d.hydration, d.nutrition, d.habits, d.training, matchToday));
      try {
        const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
        const done = ml?.date === todayStr;
        setMorningDone(done);
        const hour = new Date().getHours();
        const nudgeDismissed = localStorage.getItem("padelop:checkin-nudge-dismissed") === todayStr;
        if (done) {
          setCheckinNudgeOpen(false);
        }
      } catch { setMorningDone(false); }
      // Seed completed Set from padelop:schedule-done + waterOnWaking (title-based)
      try {
        const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
        const doneTitles = new Set(sd[todayStr] ?? []);
        try {
          const dat: Record<string, Record<string, number>> = JSON.parse(localStorage.getItem("padelop:done-at") || "{}");
          const todayDat = dat[todayStr] ?? {};
          Object.entries(todayDat).forEach(([title, ts]) => doneAtRef.current.set(title, ts));
        } catch {}
        // Merge waterOnWaking
        try {
          const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
          if (ml?.date === todayStr && ml?.waterOnWaking === true) {
            if (!doneTitles.has("Wake up")) {
              doneTitles.add("Wake up");
              const updated = [...doneTitles];
              sd[todayStr] = updated;
              localStorage.setItem("padelop:schedule-done", JSON.stringify(sd));
              saveScheduleDoneToDb(todayStr, updated);
            }
          }
        } catch {}
        setCompleted(doneTitles);
      } catch {}
    }
    function loadMatch() {
      const todayD = localISODate(new Date());
      const yesterday = localISODate(new Date(Date.now() - 864e5));
      try {
        const listRaw = localStorage.getItem("padelop:upcoming-matches");
        const list: StoredMatch[] = listRaw ? JSON.parse(listRaw) : [];
        // Persist past match dates before filtering them out
        const past = list.filter(m => m.date && m.date < todayD);
        if (past.length > 0) {
          try {
            const existing: string[] = JSON.parse(localStorage.getItem("padelop:past-match-dates") || "[]");
            const merged = [...new Set([...existing, ...past.map(m => m.date!)])].sort();
            localStorage.setItem("padelop:past-match-dates", JSON.stringify(merged));
          } catch {}
        }
        const future = list.filter(m => m.date >= todayD).sort((a, b) => a.date.localeCompare(b.date));
        setUpcomingCount(future.length);
        // Sync next-match from list, merging to preserve any fields not in the list entry
        if (future.length > 0) {
          try {
            const existing = JSON.parse(localStorage.getItem("padelop:next-match") || "null") || {};
            const base = future[0];
            const merged: StoredMatch = {
              ...base,
              court:    base.court    || existing.court    || "",
              club:     base.club     || existing.club     || "",
              player_1: base.player_1 || existing.player_1 || "",
              player_2: base.player_2 || existing.player_2 || "",
              player_3: base.player_3 || existing.player_3 || "",
              player_4: base.player_4 || existing.player_4 || "",
            };
            localStorage.setItem("padelop:next-match", JSON.stringify(merged));
          } catch {
            localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
          }
        }
      } catch {}
      let wasYesterday = false;
      try {
        const raw = localStorage.getItem("padelop:next-match");
        if (raw) {
          const m = JSON.parse(raw);
          if (m.date && m.time) {
            const nowD = new Date();
            let matchEnded = m.date < todayD;
            if (!matchEnded && m.date === todayD && m.time) {
              const [mH, mM] = (m.time as string).split(":").map(Number);
              matchEnded = nowD.getHours() * 60 + nowD.getMinutes() >= mH * 60 + mM + 90;
            }
            if (!matchEnded) {
              setMatch({ date: m.date, time: m.time, club: m.club || undefined, court: m.court || undefined, players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean) });
            } else {
              setMatch(null);
              const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
              const alreadyReviewed = reviews.some((r: { ts?: string }) => r.ts?.slice(0, 10) === m.date);
              const dismissed = localStorage.getItem("padelop:post-match-dismissed") === m.date;
              if (!alreadyReviewed && !dismissed) {
                try { localStorage.setItem("padelop:post-match-dismissed", m.date); } catch {}
                setPostMatchDate(m.date);
                setPostMatchOpen(true);
              }
            }
          } else {
            setMatch(null);
          }
          if (m.date === yesterday) wasYesterday = true;
        } else {
          setMatch(null);
        }
      } catch {}
      try {
        const rawReviews = localStorage.getItem("padelop:match-reviews");
        if (rawReviews) {
          const reviews = JSON.parse(rawReviews);
          if (reviews.some((r: { ts?: string }) => r.ts && r.ts.slice(0, 10) === yesterday)) wasYesterday = true;
        }
      } catch {}
      setYesterdayWasMatch(wasYesterday);
    }
    loadReadiness();
    loadMatch();
    function handleStorage() { loadReadiness(); loadMatch(); }
    window.addEventListener("storage", handleStorage);
    function handleMatchAdded(e: Event) {
      const m = (e as CustomEvent<{ date: string; time: string; club?: string; court?: string; player_1?: string; player_2?: string; player_3?: string; player_4?: string }>).detail;
      if (m?.date && m?.time) {
        setMatch({ date: m.date, time: m.time, club: m.club || undefined, court: m.court || undefined, players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean) as string[] });
        setDoIdx(-1);
      }
    }
    window.addEventListener("padelop:match-added", handleMatchAdded);
    function handleOpenLogSheet() { setLogSheetOpen(true); }
    function handleToggleLogSheet() { setLogSheetOpen(v => !v); }
    function handleOpenCheckin() { setLogWizard(false); setLogTab("checkin"); setLogSheetOpen(true); }
    function handleOpenMatchReview() { setLogTab("matchreview"); setLogSheetOpen(true); }
    window.addEventListener("padelop:open-log-sheet", handleOpenLogSheet);
    window.addEventListener("padelop:toggle-log-sheet", handleToggleLogSheet);
    window.addEventListener("padelop:open-checkin", handleOpenCheckin);
    window.addEventListener("padelop:open-matchreview", handleOpenMatchReview);
    // Only show the morning nudge AFTER sync finishes — avoids false positives when sync hasn't loaded yet
    function handleSyncDone() {
      loadReadiness();
      // Pre-check BEFORE loadMatch() because loadMatch sets padelop:post-match-dismissed
      // atomically when it opens the popup — reading after would always see dismissed=true.
      const willShowPostMatch = (() => {
        try {
          const nm = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
          if (!nm?.date) return false;
          const nowD = new Date();
          const todayD = localISODate(nowD);
          let ended = nm.date < todayD;
          if (!ended && nm.date === todayD && nm.time) {
            const [h, m] = (nm.time as string).split(":").map(Number);
            ended = nowD.getHours() * 60 + nowD.getMinutes() >= h * 60 + m + 90;
          }
          if (!ended) return false;
          const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
          const alreadyReviewed = reviews.some((r: { ts?: string }) => r.ts?.slice(0, 10) === nm.date);
          const dismissed = localStorage.getItem("padelop:post-match-dismissed") === nm.date;
          return !alreadyReviewed && !dismissed;
        } catch { return false; }
      })();
      loadMatch();
      const todayStr = new Date().toISOString().slice(0, 10);
      const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      const done = ml?.date === todayStr;
      const nudgeDismissed = localStorage.getItem("padelop:checkin-nudge-dismissed") === todayStr;
      const hour = new Date().getHours();
      // Also check postMatchOpenRef in case mount's loadMatch already opened the popup
      // (dismissed key would already be set, so willShowPostMatch would miss it)
      if (!done && !nudgeDismissed && hour < 13 && !willShowPostMatch && !postMatchOpenRef.current) {
        setCheckinNudgeOpen(true);
      }
    }
    window.addEventListener("padelop:sync-done", handleSyncDone);
    setDrillTag(getTopNeedsWorkTag());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => { clearInterval(id); window.removeEventListener("storage", handleStorage); window.removeEventListener("padelop:match-added", handleMatchAdded); window.removeEventListener("padelop:open-log-sheet", handleOpenLogSheet); window.removeEventListener("padelop:toggle-log-sheet", handleToggleLogSheet); window.removeEventListener("padelop:open-checkin", handleOpenCheckin); window.removeEventListener("padelop:open-matchreview", handleOpenMatchReview); window.removeEventListener("padelop:sync-done", handleSyncDone); };
  }, []);

  // Reset hydration counter when date rolls over midnight
  useEffect(() => {
    const today = now.toISOString().slice(0, 10);
    if (today !== lastDateRef.current) {
      lastDateRef.current = today;
      setLogHydrationMl(0);
    }
  }, [now]);

  type StoredMatch = { date: string; time: string; club: string; court: string; player_1: string; player_2: string; player_3: string; player_4: string };

  function getMatchList(): StoredMatch[] {
    try {
      const raw = localStorage.getItem("padelop:upcoming-matches");
      if (raw) return JSON.parse(raw);
      const single = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
      if (single?.date) return [single];
    } catch {}
    return [];
  }

  function saveMatchList(list: StoredMatch[]) {
    const today = new Date().toISOString().slice(0, 10);
    const future = list.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    try {
      localStorage.setItem("padelop:upcoming-matches", JSON.stringify(future));
      if (future.length > 0) localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
      else localStorage.removeItem("padelop:next-match");
      window.dispatchEvent(new Event("storage"));
    } catch {}
    setUpcomingCount(future.length);
    return future;
  }

  function saveMealEntry(time: string, description: string) {
    if (!description.trim()) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const entry = { id: Date.now().toString(), date: todayKey, time, description: description.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
      localStorage.setItem("padelop:meal-log", JSON.stringify([...existing, entry]));
    } catch {}
    saveNutritionToDb({ date: todayKey, meal_type: time, description: description.trim() });
    setMealsToday(prev => [...prev, entry]);
    setMealText("");
  }

  function saveNote(text: string) {
    if (!text.trim()) return;
    const date = new Date().toISOString().slice(0, 10);
    const entry = { id: Date.now().toString(), date, ts: new Date().toISOString(), text: text.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:notes") || "[]");
      localStorage.setItem("padelop:notes", JSON.stringify([entry, ...existing].slice(0, 200)));
    } catch {}
    saveNoteToDb({ date, body: text.trim() });
    setNoteText("");
  }

  function nowTimeStr() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  }

  function saveLogHydration(ml: number) {
    const todayKey = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayKey, ml })); } catch {}
    saveHydrationToDb(todayKey, ml);
    // Keep hydration-logs in sync so the scoring engine picks up the quick counter
    try {
      const litres =
        ml < 1000  ? "<1L"    :
        ml < 1500  ? "1–1.5L" :
        ml < 2000  ? "1.5–2L" :
        ml < 2500  ? "2–2.5L" :
        ml < 3000  ? "2.5–3L" : "3L+";
      const quality = ml >= 2500 ? "great" : ml >= 1500 ? "ok" : "bad";
      const entry = { ts: new Date().toISOString(), litres, quality, urine: "", timing: [] };
      const prev: typeof entry[] = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
      // Replace today's entry if it exists, otherwise prepend
      const todayIdx = prev.findIndex(e => e.ts.slice(0, 10) === todayKey);
      if (todayIdx >= 0) prev[todayIdx] = entry; else prev.unshift(entry);
      localStorage.setItem("padelop:hydration-logs", JSON.stringify(prev.slice(0, 50)));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }
  function onLogDotTouchStart(e: React.TouchEvent) {
    logDragStartX.current  = e.touches[0].clientX;
    logDragStartMl.current = logHydrationMl;
  }
  function onLogDotTouchMove(e: React.TouchEvent) {
    e.stopPropagation();
    const dx      = e.touches[0].clientX - logDragStartX.current;
    const barW    = logGaugeRef.current?.offsetWidth ?? 1;
    const deltaMl = (dx / barW) * LOG_MAX_ML;
    const snapped = Math.round((logDragStartMl.current + deltaMl) / 250) * 250;
    const clamped = Math.max(0, Math.min(LOG_MAX_ML, snapped));
    setLogHydrationMl(clamped);
    saveLogHydration(clamped);
  }

  useEffect(() => {
    setCardSnap('none'); setLiveX(0); setLiveY(0);
    settlingRef.current = true;
    const t = setTimeout(() => { settlingRef.current = false; }, 350);
    return () => clearTimeout(t);
  }, [doIdx]);
  useEffect(() => { doIdxRef.current = doIdx; }, [doIdx]);
  useEffect(() => {
    if (checkinNudgeOpen) {
      setDoIdx(0); setLiveX(0); setLiveY(0); setCardSnap('none');
      swipeDirRef.current = null;
    }
  }, [checkinNudgeOpen]);

  useEffect(() => {
    if (prevPostMatchOpenRef.current && !postMatchOpen) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      const done = ml?.date === todayStr;
      const nudgeDismissed = localStorage.getItem("padelop:checkin-nudge-dismissed") === todayStr;
      const hour = new Date().getHours();
      if (!done && !nudgeDismissed && hour < 13) setCheckinNudgeOpen(true);
    }
    prevPostMatchOpenRef.current = postMatchOpen;
  }, [postMatchOpen]);

  useEffect(() => {
    if (doIdx === 0) setDrumIdx(currentIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doIdx]);


  // Detect when a match has ended (same day or previous day) and prompt review
  useEffect(() => {
    if (!match || postMatchOpen) return;
    const matchDay = match.date;
    const todayDay = localISODate(now);

    // Check if match has ended: either on a previous day, or today past match time + 90 min
    let matchEnded = matchDay < todayDay;
    if (!matchEnded && matchDay === todayDay && match.time) {
      const [mH, mM] = match.time.split(":").map(Number);
      const matchEndMins = mH * 60 + mM + 90;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      matchEnded = nowMins >= matchEndMins;
    }
    if (!matchEnded) return;

    try {
      const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
      const alreadyReviewed = reviews.some((r: { ts?: string }) => r.ts?.slice(0, 10) === match.date);
      const dismissed = localStorage.getItem("padelop:post-match-dismissed") === match.date;
      if (!alreadyReviewed && !dismissed) {
        try { localStorage.setItem("padelop:post-match-dismissed", match.date); } catch {}
        setPostMatchDate(match.date);
        setPostMatchOpen(true);
      }
    } catch {}
  }, [now]);

  useEffect(() => {
    if (!matchInfoOpen) return;
    const d = loadScoringData();
    const morningLog = loadMorningLog();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYMD = yesterday.toISOString().slice(0, 10);
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().from("matches").select("date").eq("date", yesterdayYMD).limit(1).maybeSingle().then(({ data }) => {
        setMatchReadiness(computeMatchReadiness(d.checkIn, morningLog, !!data, d.review));
      });
    });
  }, [matchInfoOpen]);

  useEffect(() => {
    if (!matchModalOpen) return;
    setLiveX(0);
    setLiveY(0);
    setCardSnap('none');
    try {
      const raw = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
      setPastReviews(raw.map((r: Record<string, unknown>) => ({
        ts: String(r.ts ?? ""),
        result: String(r.result ?? ""),
        opponentNames: typeof r.opponentNames === "string" ? r.opponentNames : "",
        wellDone: Array.isArray(r.wellDone) ? r.wellDone as string[] : [],
        improved: Array.isArray(r.improved) ? r.improved as string[] : [],
      })).filter((r: { opponentNames: string }) => r.opponentNames));
    } catch {}
  }, [matchModalOpen]);

  useEffect(() => {
    if (cardSnap !== 'right') {
      setBreathPhase(0);
      setBreathPhaseProgress(0);
      return;
    }
    breathStartRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - breathStartRef.current) % 16000;
      setBreathPhase(Math.floor(elapsed / 4000));
      setBreathPhaseProgress((elapsed % 4000) / 4000);
    }, 50);
    return () => clearInterval(id);
  }, [cardSnap]);

  const today = new Date().toISOString().slice(0, 10);
  const dayColor = dayType === "match" ? "#2653d4" : dayType === "pre-match" ? "#d97706" : dayType === "recovery" ? "#7c3aed" : dayType === "maintenance" ? "#0e7490" : "#16a34a";
  const dayLabel = dayType === "match" ? "Match Day" : dayType === "pre-match" ? "Pre-Match Day" : dayType === "recovery" ? "Recovery Day" : dayType === "maintenance" ? "Maintenance Day" : dayType === "training" ? "Training Day" : "Today";
  const { schedule, currentIdx } = getScheduleData(dayType, match?.time ?? null, drillTag);
  const doItem = schedule[currentIdx];
  const modalIdx = schedModalIdx ?? currentIdx;
  const modalItem = schedule[modalIdx] ?? doItem;
  const modalEndTime = schedule[modalIdx + 1]?.time;
  const curMins = now.getHours() * 60 + now.getMinutes();

  const goNext = () => setDoIdx(i => Math.min(i + 1, 1));
  const goPrev = () => setDoIdx(i => Math.max(i - 1, -1));

  function handleModalComplete() {
    const item = modalItem;
    const wasComplete = completed.has(item.title);
    if (!wasComplete && item.isDrill) {
      try {
        const entry = { ts: new Date().toISOString(), sessionType: ["Drills"], drillFocus: drillTag ? [drillTag] : [], duration: "6", intensity: "moderate" };
        const prev2 = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]");
        localStorage.setItem("padelop:training-logs", JSON.stringify([entry, ...prev2].slice(0, 50)));
        window.dispatchEvent(new Event("storage"));
      } catch {}
      saveTrainingToDb({ date: new Date().toISOString().slice(0, 10), drill_focus: drillTag ?? undefined, duration_mins: 6 });
    }
    setCompleted(prev => {
      const n = new Set(prev);
      if (!wasComplete) {
        n.add(item.title);
        doneAtRef.current.set(item.title, Date.now());
      } else {
        n.delete(item.title);
      }
      return n;
    });
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
      const titles = sd[todayKey] ?? [];
      sd[todayKey] = wasComplete
        ? titles.filter(t => t !== item.title)
        : [...titles.filter(t => t !== item.title), item.title];
      localStorage.setItem("padelop:schedule-done", JSON.stringify(sd));
      saveScheduleDoneToDb(todayKey, sd[todayKey]);
      try {
        const dat: Record<string, Record<string, number>> = JSON.parse(localStorage.getItem("padelop:done-at") || "{}");
        if (!dat[todayKey]) dat[todayKey] = {};
        if (wasComplete) { delete dat[todayKey][item.title]; } else { dat[todayKey][item.title] = Date.now(); }
        localStorage.setItem("padelop:done-at", JSON.stringify(dat));
      } catch {}
      window.dispatchEvent(new Event("storage"));
    } catch {}
    if (!wasComplete) startPlusOne();
  }

  return (
    <>
      <main style={{ ...S, position: "fixed", inset: 0, paddingTop: 0, paddingLeft: 10, paddingRight: 10, paddingBottom: 0, overflow: "hidden", background: "#fff", zIndex: 60 }}>

        {/* Horizontal strip: [readiness | carousel | log] */}
        <div
          ref={outerRef}
          style={{
            display: "flex", width: "300%", marginLeft: "-100%",
            height: "100dvh", touchAction: "manipulation",
            transform: cardSnap === 'right' ? `translateX(calc(33.333% - 50px + ${liveX}px))` : cardSnap === 'left' ? `translateX(calc(-33.333% + 50px + ${liveX}px))` : `translateX(${liveX}px)`,
            transition: liveX !== 0 ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
          onTouchStart={e => {
            touchStartYRef.current = e.touches[0].clientY;
            touchStartXRef.current = e.touches[0].clientX;
            lastTouchYRef.current = e.touches[0].clientY;
            hitTopYRef.current = null;
            swipeDirRef.current = null;
          }}
          onTouchMove={e => {
            const y = e.touches[0].clientY;
            lastTouchYRef.current = y;
            const dx = e.touches[0].clientX - touchStartXRef.current;
            const dy = e.touches[0].clientY - touchStartYRef.current;
            if (!swipeDirRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
              swipeDirRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (doIdx >= 1) return;
            if (swipeDirRef.current === 'h' && doIdx === 0) setLiveX(dx);
            if (swipeDirRef.current === 'v' && cardSnap === 'none' && doIdx < 1 && !settlingRef.current) setLiveY(dy);
          }}
          onTouchEnd={e => {
            const endY = e.changedTouches[0].clientY;
            const dx = e.changedTouches[0].clientX - touchStartXRef.current;
            const dy = endY - touchStartYRef.current;
            if (doIdx >= 1) {
              if (swipeDirRef.current === 'v' && dy > 20) goPrev();
              swipeDirRef.current = null;
              return;
            }
            if (swipeDirRef.current === 'h' && doIdx === 0) {
              setLiveX(0);
              if (cardSnap === 'none') {
                if (dx < -60) setCardSnap('left');
                else if (dx > 60) setCardSnap('right');
              } else if (cardSnap === 'left' && dx > 60) setCardSnap('none');
              else if (cardSnap === 'right' && dx < -60) setCardSnap('none');
            } else if (swipeDirRef.current === 'v' && cardSnap === 'none') {
              setLiveY(0);
              if (!settlingRef.current) {
                if (dy < -40 && doIdx < 1) goNext();
                else if (dy > 40) goPrev();
              }
            }
            swipeDirRef.current = null;
          }}
          onTouchCancel={() => {
            setLiveX(0);
            setLiveY(0);
            swipeDirRef.current = null;
          }}
        >
          {/* Log panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingRight: 20, paddingLeft: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, transform: `translateX(${cardSnap === 'right' ? 50 : 0}px) translateY(calc(45dvh - 3 * (100vw - 40px) / 2 - 10px))`, transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
              {/* Placeholder above */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "#fff", opacity: 0 }} />
              {/* Main card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", background: "#fff", borderRadius: 24, marginRight: cardSnap === 'right' ? 0 : -40, opacity: cardSnap === 'right' ? 1 : 0, transition: "margin 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  {(() => {
                    let scale = 1;
                    if (breathPhase === 0) scale = 1 + 0.18 * breathPhaseProgress; // Inhale: grows to +18%
                    else if (breathPhase === 1) scale = 1.18; // Hold: stays at +18%
                    else if (breathPhase === 2) scale = 1.18 - 0.18 * breathPhaseProgress; // Exhale: shrinks back to baseline
                    else scale = 1; // Hold: stays at baseline
                    return (
                      <div style={{ position: "relative", width: "60%", aspectRatio: "1 / 1" }}>
                        <svg width="100%" height="100%" viewBox="0 0 160 160" style={{ display: "block", overflow: "visible", transform: `scale(${scale})`, transformOrigin: "80px 80px" }}>
                          <circle cx="80" cy="80" r="70" fill="none" stroke="#dce8f8" strokeWidth="5" />
                          {[
                            "M 80,150 A 70,70 0 0,1 10,80",
                            "M 10,80 A 70,70 0 0,1 80,10",
                            "M 80,10 A 70,70 0 0,1 150,80",
                            "M 150,80 A 70,70 0 0,1 80,150",
                          ].map((d, i) => (
                            <path
                              key={i}
                              d={d}
                              fill="none"
                              stroke={i < breathPhase ? "#1d4ed8" : "#3b9eff"}
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray="110"
                              strokeDashoffset={i < breathPhase ? 0 : i === breathPhase ? 110 - breathPhaseProgress * 110 : 110}
                            />
                          ))}
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                          <p style={{ fontSize: "clamp(16px, 5.25vw, 22px)", fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1 }}>Breathe</p>
                        </div>
                        <div style={{ position: "absolute", left: 0, right: 0, top: "58%", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                          {(() => {
                            const phases = [
                              { label: "In" },
                              { label: "Hold" },
                              { label: "Out" },
                              { label: "Hold" },
                            ];
                            const p = phases[breathPhase];
                            return (
                              <p key={breathPhase} style={{ fontSize: "clamp(12px, 3.8vw, 16px)", color: "#3b9eff", margin: 0, lineHeight: 1, fontWeight: 600 }}>
                                {p.label}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* Placeholder below */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "#fff", opacity: 0 }} />
            </div>
          </div>

          {/* Carousel center — all schedule cards, doIdx in transform */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingLeft: 10, paddingRight: 10, position: "relative", zIndex: 2, overflow: "hidden" }}>
            <div style={{
              display: "flex", flexDirection: "column", gap: 10,
              transform: doIdx === 1
                ? `translateY(calc(270px - 200vw - 100dvh))`
                : doIdx === -1
                  ? `translateY(calc(60px - 100vw + ${liveY}px))`
                  : `translateY(calc(160px - 150vw - 55dvh + ${liveY}px))`,
              transition: liveY !== 0 ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}>
              {/* Structural spacer — keeps transform geometry intact */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", pointerEvents: "none" }} />

              {/* Card 0: Next Match (reinstated at top; encouragement card kept below, unused, for later) */}
              {(() => {
                const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                return (
                  <div style={{ width: "100%", flexShrink: 0, height: "calc(100dvh - 120px)", borderRadius: 24, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", zIndex: doIdx === -1 ? 2 : 1, pointerEvents: doIdx === -1 ? "auto" : "none", opacity: doIdx === -1 ? 1 : 0, transition: "opacity 0.3s" }}>
                    {match ? (() => {
                      const matchDate = new Date(match.date + "T12:00");
                      const todayDate = new Date(today + "T12:00");
                      const diffDays = Math.round((matchDate.getTime() - todayDate.getTime()) / 86400000);
                      const countdownLabel = diffDays === 0 ? "TODAY" : diffDays === 1 ? "TOMORROW" : `IN ${diffDays} DAYS`;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                          <div style={{ position: "relative", width: "calc((100vw - 40px) * 0.65)", height: "calc((100vw - 40px) * 0.65)", flexShrink: 0 }}>
                            <button onClick={() => setMatchInfoOpen(true)} style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#2653d4", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, boxShadow: "0 4px 20px #2653d455" }}>
                              <span style={{ fontSize: "clamp(17px, 4.4vw, 21px)", fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>{countdownLabel}</span>
                              <span style={{ fontSize: "clamp(30px, 7.7vw, 37px)", fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: "-0.02em" }}>{match.time}</span>
                            </button>
                            <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                              <defs>
                                <path id="matchArc" d="M 12 50 A 38 38 0 0 1 88 50" />
                              </defs>
                              <text fill="rgba(255,255,255,0.7)" fontSize="9.5" fontWeight="700" letterSpacing="2.5" fontFamily="inherit">
                                <textPath href="#matchArc" startOffset="50%" textAnchor="middle">NEXT MATCH</textPath>
                              </text>
                            </svg>
                          </div>
                        </div>
                      );
                    })() : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                        <div style={{ position: "relative", width: "calc((100vw - 40px) * 0.65)", height: "calc((100vw - 40px) * 0.65)", flexShrink: 0 }}>
                          <button
                            onClick={() => { setIsAddMode(true); setMatchForm({ date: '', time: '', club: '', court: '', p1: '', p2: '', p3: '', p4: '' }); setMatchModalTab('pick'); setMatchModalOpen(true); }}
                            style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#2653d4", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px #2653d455" }}
                          >
                            <svg width="18%" height="18%" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </button>
                          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                            <defs>
                              <path id="noMatchArc" d="M 12 50 A 38 38 0 0 1 88 50" />
                            </defs>
                            <text fill="rgba(255,255,255,0.7)" fontSize="9.5" fontWeight="700" letterSpacing="2.5" fontFamily="inherit">
                              <textPath href="#noMatchArc" startOffset="50%" textAnchor="middle">NEXT MATCH</textPath>
                            </text>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Encouragement card — unused for now, kept here in case we want it again later.
              {(() => {
                const title =
                  dayType === "match"     ? "Game on." :
                  dayType === "pre-match" ? "Tomorrow is match day." :
                  dayType === "recovery"  ? "Well played." :
                  "Keep going.";
                const sub =
                  dayType === "match"
                    ? "Trust your game and enjoy every point."
                    : dayType === "pre-match"
                    ? "Rest up, carb load, and get to bed early. The prep is done."
                    : dayType === "recovery"
                    ? "Rest is part of training. Let your body recover and come back stronger."
                    : drillTag
                    ? `Today focus on ${drillTag}. Small improvements compound into big gains.`
                    : "Every session counts. Show up, put in the work, and trust the process.";
                return (
                  <div style={{ width: "100%", flexShrink: 0, height: "calc(100dvh - 120px)", borderRadius: 24, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", gap: 2, zIndex: doIdx === -1 ? 2 : 1, pointerEvents: doIdx === -1 ? "auto" : "none", opacity: doIdx === -1 ? 1 : 0, transition: "opacity 0.3s" }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2653d4", textAlign: "center" }}>
                      {dayLabel}
                    </p>
                    <p style={{ margin: 0, fontSize: "clamp(36px, 9vw, 48px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.1, textAlign: "center" }}>{title}</p>
                    <p style={{ margin: 0, fontSize: "clamp(15px, 3.8vw, 18px)", color: "#6b7480", lineHeight: 1.6, textAlign: "center" }}>{sub}</p>
                  </div>
                );
              })()}
              */}

              {/* Card 1: do-this-now */}
              {(() => {
                const s = doItem;
                const isDone = completed.has(s.title);
                const isReady = curMins >= toMins(s.time);
                const nextSlide = schedule[currentIdx + 1];
                const secsUntilNext = nextSlide ? toMins(nextSlide.time) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) : 0;
                const fmtTime = (s: number) => { if (s <= 0) return "a moment"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`; return m > 0 ? `${m}m` : "a moment"; };
                const cardStyle: React.CSSProperties = { position: "relative", width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: "50%", overflow: "hidden", background: "#00D455", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", zIndex: 3, boxShadow: "none" };
                if (!clientReady) return (
                  <div key="active" style={{ ...cardStyle, background: "#fff" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(0,160,60,0.2)", borderTopColor: "#00A83C", animation: "spin 0.8s linear infinite" }} />
                  </div>
                );
                const textureOverlay = <div style={{ position: "absolute", inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E")`, backgroundSize: "200px 200px", pointerEvents: "none", mixBlendMode: "overlay" as React.CSSProperties["mixBlendMode"] }} />;
                const isSleepytime = now.getHours() < 7 || curMins >= toMins(schedule[schedule.length - 1].time);
                const contentOpacity = doIdx === 0 ? 1 : 0.2;

                if (isSleepytime) return (
                  <div key="active" className="animate-bounce-in" style={{ ...cardStyle }}>
                    <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,30,0.65)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c9d6ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                      <p style={{ fontSize: "clamp(22px, 7vw, 30px)", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Sleepytime</p>
                      <p style={{ fontSize: "clamp(13px, 4vw, 17px)", fontWeight: 500, color: "rgba(200,210,255,0.75)", margin: 0 }}>See you at 7am</p>
                    </div>
                  </div>
                );

                if (isDone) {
                  if (!nextSlide) return null;
                  const doneAt = doneAtRef.current.get(s.title);
                  const justDone = doneAt && (Date.now() - doneAt < 2000);
                  const showNiceWork = doneAt && (Date.now() - doneAt < 5000);
                  const completedTitle = s.title;
                  const nextTitle = nextSlide.title;

                  return (
                    <div key="done-card" style={{ ...cardStyle, background: "#E5E7EB", animation: "ball-drop 0.9s 0.1s both" }} onClick={() => { setSchedModalIdx(currentIdx); setDoModalOpen(true); setModalDetailOpen(false); }}>
                      {textureOverlay}

                      {/* Timer layer */}
                      <div style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, padding: "0 12px" }}>
                        <p style={{ position: "relative", color: "#000", fontWeight: 800, fontSize: !nextTitle.includes(" & ") && nextTitle.length > 14 ? "clamp(18px, 5.8vw, 26px)" : "clamp(24px, 7.5vw, 34px)", lineHeight: 1.2, display: "inline-block", textAlign: "center", margin: 0 }}>
                          <span style={{ position: "absolute", left: 0, right: 0, bottom: "100%", fontSize: 13, fontWeight: 700, color: showNiceWork ? "#16a34a" : "#000", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1 }}>{showNiceWork ? "Nice work!" : "Next"}</span>
                          {nextTitle.includes(" & ")
                            ? <>{nextTitle.split(" & ")[0]}<br />{"& " + nextTitle.split(" & ").slice(1).join(" & ")}</>
                            : nextTitle}
                        </p>
                        <p style={{ margin: "6px 0 0", fontSize: "clamp(13px, 3.8vw, 16px)", fontWeight: 500, color: "rgba(0,0,0,0.55)", textAlign: "center", lineHeight: 1.1 }}>in {fmtTime(secsUntilNext)}</p>
                      </div>

                      {/* Done flash — on top, cross-fades out into timer */}
                      <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "#00D455", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: justDone ? undefined : 0, animation: justDone ? "done-flash-out 2s ease-in forwards" : undefined }}>
                        {textureOverlay}
                        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: justDone ? "draw-check 0.5s ease-out 0.1s forwards" : undefined }}/>
                        </svg>
                        <p style={{ fontSize: "clamp(22px, 7vw, 30px)", fontWeight: 800, color: "#1a1c1c", margin: 0, letterSpacing: "-0.02em", background: "#fff", padding: "3px 8px", borderRadius: 4 }}>{completedTitle}</p>
                        <p style={{ fontSize: "clamp(13px, 4vw, 17px)", fontWeight: 700, color: "#1a1c1c", margin: 0, letterSpacing: "0.04em" }}>Done</p>
                      </div>
                    </div>
                  );
                }
                const isAudioAvailable = dayType === "match" && match && (() => { const [mH, mM] = match.time.split(":").map(Number); return now.getHours() * 60 + now.getMinutes() >= mH * 60 + mM - 60; })();
                const warmupSeek = (deltaSecs: number) => {
                  const a = warmupAudioRef.current;
                  if (!a) return;
                  const t = Math.max(0, Math.min(warmupDurationRef.current, a.currentTime + deltaSecs));
                  a.currentTime = t;
                  setWarmupCurrentTime(t); warmupCurrentTimeRef.current = t;
                };
                const warmupToggleCore = () => {
                  if (!warmupAudioRef.current) {
                    const a = new Audio("/warmup.mp3");
                    warmupAudioRef.current = a;
                    a.onended = () => { setWarmupPlaying(false); setWarmupCurrentTime(0); warmupCurrentTimeRef.current = 0; if (warmupRafRef.current) cancelAnimationFrame(warmupRafRef.current); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none"; };
                    a.ontimeupdate = () => {
                      setWarmupCurrentTime(a.currentTime); warmupCurrentTimeRef.current = a.currentTime;
                      if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession && a.duration) {
                        navigator.mediaSession.setPositionState({ duration: a.duration, playbackRate: a.playbackRate, position: a.currentTime });
                      }
                    };
                    a.onloadedmetadata = () => { setWarmupDuration(a.duration); warmupDurationRef.current = a.duration; };
                    if ("mediaSession" in navigator) {
                      navigator.mediaSession.metadata = new MediaMetadata({ title: "Warmup", artist: "padla" });
                      navigator.mediaSession.setActionHandler("play", warmupToggleCore);
                      navigator.mediaSession.setActionHandler("pause", warmupToggleCore);
                      navigator.mediaSession.setActionHandler("seekbackward", () => warmupSeek(-10));
                      navigator.mediaSession.setActionHandler("seekforward", () => warmupSeek(10));
                    }
                  }
                  if (warmupPlaying) {
                    warmupAudioRef.current.pause();
                    setWarmupPlaying(false);
                    if (warmupRafRef.current) cancelAnimationFrame(warmupRafRef.current);
                    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
                  } else {
                    if (!warmupAudioCtxRef.current) {
                      const ctx = new AudioContext();
                      warmupAudioCtxRef.current = ctx;
                      const analyser = ctx.createAnalyser();
                      analyser.fftSize = 64;
                      analyser.smoothingTimeConstant = 0.85;
                      warmupAnalyserRef.current = analyser;
                      const source = ctx.createMediaElementSource(warmupAudioRef.current!);
                      warmupSourceRef.current = source;
                      source.connect(analyser);
                      analyser.connect(ctx.destination);
                    }
                    warmupAudioCtxRef.current?.resume();
                    warmupAudioRef.current.play();
                    setWarmupPlaying(true);
                    setWarmupStarted(true);
                    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
                    const draw = () => {
                      const canvas = warmupVizRef.current;
                      const analyser = warmupAnalyserRef.current;
                      if (!canvas || !analyser) { warmupRafRef.current = requestAnimationFrame(draw); return; }
                      const ctx2d = canvas.getContext("2d");
                      if (!ctx2d) { warmupRafRef.current = requestAnimationFrame(draw); return; }
                      const W = canvas.offsetWidth || 300;
                      const H = canvas.offsetHeight || 300;
                      if (canvas.width !== W) canvas.width = W;
                      if (canvas.height !== H) canvas.height = H;
                      const bins = analyser.frequencyBinCount;
                      const data = new Uint8Array(bins);
                      analyser.getByteFrequencyData(data);
                      ctx2d.clearRect(0, 0, W, H);
                      const count = 28; const gap = 4;
                      const barW = (W - gap * (count - 1)) / count;
                      const centerY = H / 2;
                      const raw: number[] = [];
                      for (let i = 0; i < count; i++) raw.push(data[Math.floor(i * bins / count)] / 255);
                      raw.sort((a, b) => b - a);
                      const vals = new Array(count).fill(0);
                      for (let i = 0; i < count; i++) {
                        const offset = Math.floor(i / 2);
                        if (i % 2 === 0) vals[Math.floor(count / 2) + offset] = raw[i];
                        else vals[Math.floor(count / 2) - 1 - offset] = raw[i];
                      }
                      for (let i = 0; i < count; i++) {
                        const v = vals[i];
                        const halfH = Math.max(3, v * centerY * 0.9);
                        ctx2d.fillStyle = `rgba(0,0,0,${0.06 + v * 0.16})`;
                        ctx2d.fillRect(i * (barW + gap), centerY - halfH, barW, halfH * 2);
                      }
                      warmupRafRef.current = requestAnimationFrame(draw);
                    };
                    draw();
                  }
                };
                const handleWarmupToggle = (e: React.MouseEvent) => { e.stopPropagation(); warmupToggleCore(); };
                return (
                  <div key="active" className="animate-tap-pulse" style={{ ...cardStyle, cursor: "pointer" }} onClick={() => { setDoModalOpen(true); setModalDetailOpen(false); }}>
                    {textureOverlay}
                    {/* Visualizer — fills ball when playing */}
                    <canvas
                      ref={warmupVizRef}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: warmupPlaying ? 1 : 0, transition: "opacity 0.5s" }}
                    />
                    {/* INFO STATE: fades out when playing */}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: warmupPlaying ? 0 : isSleepytime ? 0.2 : contentOpacity, transition: "opacity 0.35s", pointerEvents: warmupPlaying ? "none" : "auto" }}>
                      {(() => {
                        const circleTitle = s.title === "Lunch" ? "Lunchtime" : s.title === "Dinner" ? "Dinnertime" : s.title;
                        return (
                          <p style={{ position: "relative", color: "#000", fontWeight: 800, fontSize: "clamp(24px, 7.5vw, 34px)", lineHeight: 1.2, display: "inline-block", textAlign: "center", margin: 0 }}>
                            <span style={{ position: "absolute", left: 0, right: 0, bottom: "100%", fontSize: 13, fontWeight: 700, color: "#000", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1 }}>Now</span>
                            {circleTitle.includes(" & ")
                              ? <>{circleTitle.split(" & ")[0]}<br />{"& " + circleTitle.split(" & ").slice(1).join(" & ")}</>
                              : circleTitle}
                          </p>
                        );
                      })()}
                      {isAudioAvailable && (
                        <button onClick={handleWarmupToggle} style={{ marginTop: 10, background: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><polygon points="3,1 15,8 3,15" fill="#1a1c1c"/></svg>
                        </button>
                      )}
                    </div>

                    {/* PLAYING STATE: fades in when playing */}
                    {isAudioAvailable && (
                      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: warmupPlaying ? contentOpacity : 0, transition: "opacity 0.35s", pointerEvents: warmupPlaying ? "auto" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => warmupSeek(-10)}
                            style={{ background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 20, cursor: "pointer", padding: "5px 12px", fontSize: 13, fontWeight: 800, color: "#000", letterSpacing: "-0.02em" }}
                          >−10</button>
                          <button onClick={handleWarmupToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="37" height="37" viewBox="0 0 36 36" fill="none"><rect x="10" y="9" width="5" height="18" rx="2" fill="#000"/><rect x="21" y="9" width="5" height="18" rx="2" fill="#000"/></svg>
                          </button>
                          <button
                            onClick={() => warmupSeek(10)}
                            style={{ background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 20, cursor: "pointer", padding: "5px 12px", fontSize: 13, fontWeight: 800, color: "#000", letterSpacing: "-0.02em" }}
                          >+10</button>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.55)", letterSpacing: "0.01em" }}>
                          {warmupDuration > 0
                            ? `${String(Math.floor(warmupCurrentTime / 60)).padStart(2, "0")}:${String(Math.floor(warmupCurrentTime % 60)).padStart(2, "0")}`
                            : "--:--"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Captions — shown below ball when warmup audio is playing */}
              {(() => {
                const cueIdx = [...WARMUP_CUES].map((_, i) => i).reverse().find(i => WARMUP_CUES[i].from <= warmupCurrentTime) ?? 0;
                const cue = WARMUP_CUES[cueIdx];
                const nextCue = WARMUP_CUES[cueIdx + 1];
                const cueDuration = nextCue ? nextCue.from - cue.from : 3;
                const words = (cue?.text ?? "").split(" ");
                const timeInCue = warmupCurrentTime - (cue?.from ?? 0);
                const activeWord = Math.min(words.length - 1, Math.floor((timeInCue / cueDuration) * words.length));
                return (
                  <div style={{ width: "100%", flexShrink: 0, minHeight: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px", opacity: warmupPlaying ? 1 : 0, transition: "opacity 0.4s", pointerEvents: "none" }}>
                    <p style={{ margin: 0, fontSize: "clamp(15px, 3.8vw, 18px)", fontWeight: 500, color: "#1a1c1c", textAlign: "center", lineHeight: 1.6 }}>
                      {cue?.text ?? ""}
                    </p>
                  </div>
                );
              })()}

              {/* Card 2: My Game snapshot grid (content swapped in, same wrapper/dimensions as before) */}
              {(() => {
                const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                const points = completed.size;
                const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                const nmDiff = match ? Math.round((new Date(match.date + "T12:00").getTime() - new Date(todayStr + "T12:00").getTime()) / 86400000) : null;
                const nmLabel = nmDiff === null ? "None" : nmDiff === 0 ? "Today" : nmDiff === 1 ? "Tmrw" : `${nmDiff}d`;
                const wellCount = reviews.flatMap(r => r.wellDone ?? []).length;
                const badCount = reviews.flatMap(r => r.improved ?? []).length;

                const circle = (
                  id: string, fill: string, title: string, titleColor: string,
                  main: React.ReactNode, mainColor: string,
                  sub: React.ReactNode, subColor: string, subOpacity: number,
                  onTap?: () => void,
                  mainFontSize: number = 46,
                ) => (
                  <div onClick={onTap} style={{ minWidth: 0, minHeight: 0, overflow: "hidden", cursor: onTap ? "pointer" : "default" }}>
                    <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                      <defs><path id={id} d="M 33,79 A 73,73 0 0,1 167,79" /></defs>
                      <circle cx="100" cy="100" r="99" fill={fill} />
                      <text fontSize="19" fontWeight="700" letterSpacing="0.05em" style={{ fill: titleColor, fontFamily: ff }}>
                        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{title}</textPath>
                      </text>
                      <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize={mainFontSize} fontWeight="800" style={{ fill: mainColor, fontFamily: ff }}>{main}</text>
                      <text x="100" y="152" textAnchor="middle" fontSize="19" fontWeight="600" style={{ fill: subColor, fontFamily: ff, opacity: subOpacity } as React.CSSProperties}>{sub}</text>
                    </svg>
                  </div>
                );

                return (
                  <div
                    key="card2"
                    style={{ width: "100%", flexShrink: 0, borderRadius: 24, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 0, gap: 2, zIndex: doIdx === 1 ? 2 : 1, height: "calc(100vw - 40px)", overflow: "hidden", pointerEvents: doIdx === 1 ? "auto" : "none", touchAction: "none", opacity: doIdx === 1 ? 1 : 0, transition: "opacity 0.3s" }}
                  >
                    {(() => {
                      const title =
                        dayType === "match"     ? "Game on." :
                        dayType === "pre-match" ? "Tomorrow is match day." :
                        dayType === "recovery"  ? "Well played." :
                        "Keep going.";
                      const sub =
                        dayType === "match"
                          ? "Trust your game and enjoy every point."
                          : dayType === "pre-match"
                          ? "Rest up, carb load, and get to bed early. The prep is done."
                          : dayType === "recovery"
                          ? "Rest is part of training. Let your body recover and come back stronger."
                          : drillTag
                          ? `Today focus on ${drillTag}. Small improvements compound into big gains.`
                          : "Every session counts. Show up, put in the work, and trust the process.";
                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 36px", width: "100%" }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2653d4", textAlign: "center" }}>
                            {dayLabel}
                          </p>
                          <p style={{ margin: 0, fontSize: "clamp(36px, 9vw, 48px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.1, textAlign: "center" }}>{title}</p>
                          <p style={{ margin: 0, fontSize: "clamp(17px, 4.4vw, 20px)", color: "#6b7480", lineHeight: 1.6, textAlign: "center" }}>{sub}</p>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

            </div>
          </div>

          {/* Profile panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingLeft: 20, paddingRight: 20, paddingTop: "calc(45dvh - (100vw - 40px) / 2)" }}>
            <div style={{ width: "100%", height: "calc(100vw - 40px)", background: "#fff", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 12px", marginLeft: cardSnap === 'left' ? 0 : -20, opacity: cardSnap === 'left' ? 1 : 0, transform: `translateX(${cardSnap === 'left' ? -50 : 0}px)`, transition: "margin 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
              {/* Hydration teardrop meter */}
              {(() => {
                const MAX = 3000;
                const pct = Math.min(1, logHydrationMl / MAX);
                // teardrop viewBox 100 × 130, drop path fills from y=130 up
                const innerH = 118;
                const fillH  = pct * innerH;
                const waterY = 130 - fillH;
                const waveAmp = logHydrationMl > 0 ? 8 : 0;
                const labelMl = logHydrationMl === 0
                  ? "Drink!"
                  : logHydrationMl >= 1000
                  ? `${+(logHydrationMl / 1000).toFixed(1)}L`
                  : `${logHydrationMl}ml`;
                const pingHydrationToast = () => {
                  setHydrationToastOn(true);
                  if (hydrationToastTimer.current) clearTimeout(hydrationToastTimer.current);
                  hydrationToastTimer.current = setTimeout(() => setHydrationToastOn(false), 2500);
                };
                return (
                  <>
                    <div style={{ position: "relative" }}>
                      <p style={{ position: "absolute", left: 0, right: 0, top: -28, textAlign: "center", fontSize: "clamp(13px, 3.4vw, 16px)", fontWeight: 600, color: "#3b9eff", margin: 0, lineHeight: 1.1, opacity: hydrationToastOn ? 1 : 0, transition: "opacity 0.4s", pointerEvents: "none" }}>
                        {Math.round(Math.min(logHydrationMl / 2500, 1) * 100)}% of 2.5L goal
                      </p>
                    <svg
                      onClick={() => {
                        const next = Math.min(MAX, logHydrationMl + 250);
                        setLogHydrationMl(next);
                        saveLogHydration(next);
                        pingHydrationToast();
                      }}
                      viewBox="0 0 100 130" width="138" height="179" style={{ overflow: "visible", cursor: logHydrationMl >= MAX ? "default" : "pointer" }}>
                      <defs>
                        <clipPath id="drop-clip-r">
                          <path d="M50 4 C72 22 94 58 94 84 A44 44 0 0 1 6 84 C6 58 28 22 50 4 Z"/>
                        </clipPath>
                        <path id="goal-arc-r" d="M16 22 A40 40 0 0 1 84 22"/>
                      </defs>

                      {/* Background (empty) */}
                      <path d="M50 4 C72 22 94 58 94 84 A44 44 0 0 1 6 84 C6 58 28 22 50 4 Z"
                        fill="#dce8f8"/>

                      {/* Water fill clipped to teardrop */}
                      <g clipPath="url(#drop-clip-r)">
                        {/* Solid fill below wave */}
                        <rect x="-10" y={waterY + waveAmp} width="120" height={fillH + 10} fill="#3b9eff" opacity="0.9"/>
                        {/* Animated wave at water surface */}
                        {logHydrationMl > 0 && (
                          <>
                            {/* Back wave — slower, lighter */}
                            <g style={{ animation: "water-wave 3.5s linear infinite", willChange: "transform", transformBox: "fill-box" }}>
                              <path
                                d={`M0 ${waterY + 3} Q25 ${waterY + 3 + waveAmp} 50 ${waterY + 3} Q75 ${waterY + 3 - waveAmp} 100 ${waterY + 3} Q125 ${waterY + 3 + waveAmp} 150 ${waterY + 3} Q175 ${waterY + 3 - waveAmp} 200 ${waterY + 3} L200 130 L0 130 Z`}
                                fill="#5aaeff" opacity="0.6"
                              />
                            </g>
                            {/* Front wave — faster, solid */}
                            <g style={{ animation: "water-wave 2.2s linear infinite", willChange: "transform", transformBox: "fill-box" }}>
                              <path
                                d={`M0 ${waterY} Q25 ${waterY - waveAmp} 50 ${waterY} Q75 ${waterY + waveAmp} 100 ${waterY} Q125 ${waterY - waveAmp} 150 ${waterY} Q175 ${waterY + waveAmp} 200 ${waterY} L200 130 L0 130 Z`}
                                fill="#3b9eff" opacity="0.9"
                              />
                            </g>
                          </>
                        )}
                      </g>

                      {/* Amount label inside drop */}
                      <text x="50" y="88" textAnchor="middle" fontSize="19" fontWeight="800"
                        fill="#2653d4" fontFamily="inherit">
                        {labelMl}
                      </text>
                    </svg>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                      <button
                        onClick={() => {
                          const next = Math.max(0, logHydrationMl - 250);
                          setLogHydrationMl(next);
                          saveLogHydration(next);
                          pingHydrationToast();
                        }}
                        style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", border: "1.5px solid #dde2e8", boxShadow: "0 1px 4px rgba(0,0,0,0.10)", cursor: logHydrationMl <= 0 ? "default" : "pointer", fontSize: "clamp(15px, 3.9vw, 18px)", fontWeight: 700, color: logHydrationMl <= 0 ? "#c8cdd3" : "#6b7480", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        −
                      </button>
                      <button
                        onClick={() => {
                          const next = Math.min(MAX, logHydrationMl + 250);
                          setLogHydrationMl(next);
                          saveLogHydration(next);
                          pingHydrationToast();
                        }}
                        style={{ width: 34, height: 34, borderRadius: "50%", background: logHydrationMl >= MAX ? "#e8f0e8" : "#3b9eff", border: "none", cursor: logHydrationMl >= MAX ? "default" : "pointer", fontSize: "clamp(15px, 3.9vw, 18px)", fontWeight: 700, color: logHydrationMl >= MAX ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        +
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Complete modal */}
        {doModalOpen && modalItem && (
          <ScheduleItemModal
            item={modalItem}
            endTime={modalEndTime}
            drillTag={drillTag}
            isComplete={completed.has(modalItem.title)}
            onComplete={handleModalComplete}
            onClosed={() => { setDoModalOpen(false); setSchedModalIdx(null); }}
            swipeLabelText="Swipe to complete (+1 pt)"
            zIndex={200}
          />
        )}


        {/* First-visit tooltip */}

        <LogSheet open={logSheetOpen} onClose={() => { setLogSheetOpen(false); setLogTab(null); setLogWizard(false); }} defaultSub={logTab} startWizard={logWizard} />
        <ReadinessSheet open={readinessSheetOpen} onClose={() => setReadinessSheetOpen(false)} onOpenLog={tab => { setLogTab(tab as Parameters<typeof setLogTab>[0]); setLogSheetOpen(true); }} onOpenLogScreen={() => setReadinessSheetOpen(false)} />
        <PushPrompt />

        {/* Post-match prompt */}
        {postMatchOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={() => setPostMatchOpen(false)} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ background: "#f0fdf4" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8M12 17v4"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.3-2.7 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
                  </svg>
                </div>
                <p className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Great game!</p>
                {postMatchDate && (
                  <p className="text-[14px] text-[#6b7480]">
                    {new Date(postMatchDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                  </p>
                )}
                <p className="text-[15px] text-[#4a5050] mt-1 leading-snug">Rate your match while it&apos;s fresh — it only takes a minute.</p>
              </div>
              <div className="px-6 pb-8 flex flex-col gap-3">
                <button
                  onClick={() => { setPostMatchOpen(false); setLogTab("matchreview"); setLogSheetOpen(true); }}
                  className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                  style={{ background: "#2653d4" }}
                >
                  Rate my match
                </button>
                <button onClick={() => { try { localStorage.setItem("padelop:post-match-dismissed", postMatchDate ?? ""); } catch {} setPostMatchOpen(false); }} className="w-full py-3 text-[14px] font-semibold text-[#6b7480]">
                  I&apos;ll do it later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Morning check-in nudge */}
        {checkinNudgeOpen && !postMatchOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={() => { try { localStorage.setItem("padelop:checkin-nudge-dismissed", new Date().toISOString().slice(0, 10)); } catch {} setCheckinNudgeOpen(false); }} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ background: "#f0f4ff" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                </div>
                <p className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Morning check-in</p>
                <p className="text-[15px] text-[#4a5050] mt-1 leading-snug">30 seconds to set up your day — how did you sleep?</p>
              </div>
              <div className="px-6 pb-8 flex flex-col gap-3">
                <button
                  onClick={() => { setCheckinNudgeOpen(false); setLogWizard(false); setLogTab("checkin"); setLogSheetOpen(true); }}
                  className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                  style={{ background: "#2653d4" }}>
                  Start check-in
                </button>
                <button
                  onClick={() => { try { localStorage.setItem("padelop:checkin-nudge-dismissed", new Date().toISOString().slice(0, 10)); } catch {} setCheckinNudgeOpen(false); }}
                  className="w-full py-3 text-[14px] font-semibold text-[#6b7480]">
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Night check-in nudge */}



        {/* Match info modal — bottom sheet (mirrors the FAB menu's slide-up sheet) */}
        {matchInfoOpen && match && (() => {
          const matchDate = new Date(match.date + "T12:00");
          const todayDate = new Date(today + "T12:00");
          const diffDays = Math.round((matchDate.getTime() - todayDate.getTime()) / 86400000);
          const countdownLabel = diffDays === 0 ? "TODAY" : diffDays === 1 ? "TOMORROW" : `IN ${diffDays} DAYS`;
          const dateStr = matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
          const playerStr = match.players && match.players.length > 0 ? match.players.map(p => p.slice(0, 2)).join(' · ') : null;
          const closeSheet = () => { setMatchInfoOpen(false); setMatchInfoMode(null); setMatchInfoAddTab(null); setMatchInfoTipsOpen(false); setEditingMatchKey(null); };
          const reviewedDates = (() => {
            try {
              const reviews: { ts?: string; matchDate?: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
              return new Set(reviews.map(r => r.matchDate ?? r.ts?.slice(0, 10)).filter(Boolean) as string[]);
            } catch { return new Set<string>(); }
          })();
          const seenDates = new Set<string>();
          const unratedMatches = getMatchList().filter(m => {
            if (!m.date || !m.time || seenDates.has(m.date)) return false;
            seenDates.add(m.date);
            return new Date(`${m.date}T${m.time}:00`).getTime() < Date.now() && !reviewedDates.has(m.date);
          });
          const unratedKeys = new Set(unratedMatches.map(m => `${m.date}_${m.time}`));
          const otherMatches = getMatchList().filter(m => !(m.date === match.date && m.time === match.time) && !unratedKeys.has(`${m.date}_${m.time}`));
          const openMatchReview = () => { closeSheet(); setLogTab("matchreview"); setLogSheetOpen(true); };
          const openEditFor = (src: StoredMatch) => {
            setMatchForm({ date: src.date ?? '', time: src.time ?? '', club: src.club ?? '', court: src.court ?? '', p1: src.player_1 ?? '', p2: src.player_2 ?? '', p3: src.player_3 ?? '', p4: src.player_4 ?? '' });
            setEditingMatchKey({ date: src.date, time: src.time });
            setMatchInfoMode('edit');
            setMatchInfoAddTab(null);
          };
          const saveEdit = () => {
            if (!matchForm.date || !matchForm.time) return;
            const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
            const key = editingMatchKey ?? match;
            const current = getMatchList();
            const replaced = current.map(m => m.date === key?.date && m.time === key?.time ? data : m);
            const updated = current.some(m => m.date === key?.date && m.time === key?.time) ? replaced : [data, ...current];
            const sorted = saveMatchList(updated);
            const next = sorted[0];
            if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, court: next.court || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
            saveUpcomingMatch(data);
            window.dispatchEvent(new Event("storage"));
            closeSheet();
          };
          const saveAdd = () => {
            if (!matchForm.date || !matchForm.time) return;
            const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
            const current = getMatchList();
            const sorted = saveMatchList([...current, data]);
            const next = sorted[0];
            if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, court: next.court || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
            saveUpcomingMatch(data);
            window.dispatchEvent(new Event("storage"));
            closeSheet();
          };
          return (
            <div className="fixed inset-0 z-[200] flex items-end" onClick={closeSheet}>
              <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div
                className="relative w-full bg-white rounded-t-[28px] flex flex-col overflow-hidden shadow-2xl"
                style={{ animation: "sheetUp 0.3s cubic-bezier(0.22,1,0.36,1)", maxHeight: "85dvh", minHeight: "55dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: "#d0d3d8" }} />
                </div>

                {/* Shared hidden file input for both edit and add upload */}
                <input ref={actionUploadRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadError(null); setUploadExtracting(true);
                  try {
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
                    const res = await fetch('/api/extract-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, mediaType: file.type }) });
                    const data = await res.json();
                    if (!res.ok || data.error) { setUploadError(data.message || 'Could not read the screenshot.'); }
                    else { setMatchForm({ date: data.date ?? '', time: data.time ?? '', club: data.club ?? '', court: data.court ?? '', p1: data.player_1 ?? '', p2: data.player_2 ?? '', p3: data.player_3 ?? '', p4: data.player_4 ?? '' }); setMatchInfoAddTab('manual'); }
                  } catch { setUploadError('Upload failed. Please try again.'); }
                  setUploadExtracting(false);
                  if (actionUploadRef.current) actionUploadRef.current.value = '';
                }} />

                {/* Scrollable cards */}
                <div className="overflow-y-auto flex-1 overscroll-contain" style={{ minHeight: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 16px 32px" }}>

                  {/* Needs rating — same list the FAB "Log" sheet surfaces */}
                  {unratedMatches.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <p style={{ margin: "0 2px", fontSize: 11, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em", textTransform: "uppercase" }}>Needs rating</p>
                      {unratedMatches.map((m, i) => (
                        <button
                          key={`${m.date}-${m.time}-${i}`}
                          onClick={openMatchReview}
                          style={{ width: "100%", padding: "11px 14px", borderRadius: 12, background: "#f0f4ff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a1c1c" }}>{new Date(m.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                            <p style={{ margin: "1px 0 0", fontSize: 12, color: "#6b7480" }}>{m.time}{m.club ? ` · ${m.club}` : ""}</p>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#2653d4", background: "#dce8ff", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>Rate now</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* MATCH INFO CARD */}
                  <div style={{ position: "relative", borderRadius: 24, overflow: "hidden" }}>
                    {/* All content on white */}
                    <div style={{ background: "#fff", padding: "28px 20px 28px", position: "relative" }}>
                      {/* Edit icon — left */}
                      <button
                        onClick={() => {
                          if (matchInfoMode === 'edit') { setMatchInfoMode(null); setEditingMatchKey(null); }
                          else { const fresh = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); const src = fresh ?? match; setMatchForm({ date: src.date ?? '', time: src.time ?? '', club: src.club ?? src.location ?? '', court: src.court ?? '', p1: src.player_1 ?? src.players?.[0] ?? '', p2: src.player_2 ?? src.players?.[1] ?? '', p3: src.player_3 ?? src.players?.[2] ?? '', p4: src.player_4 ?? src.players?.[3] ?? '' }); setEditingMatchKey({ date: match.date, time: match.time }); setMatchInfoMode('edit'); setMatchInfoAddTab(null); }
                        }}
                        style={{ position: "absolute", top: 14, left: 14, background: "#f4f4f6", border: "none", cursor: "pointer", padding: 7, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5050" }}
                      >
                        {matchInfoMode === 'edit' ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        )}
                      </button>
                      {/* Plus / add match — right */}
                      <button
                        onClick={() => {
                          if (matchInfoMode === 'add') { setMatchInfoMode(null); setMatchInfoAddTab(null); }
                          else { setMatchForm({ date: '', time: '', club: '', court: '', p1: '', p2: '', p3: '', p4: '' }); setUploadError(null); setMatchInfoMode('add'); setMatchInfoAddTab('upload'); actionUploadRef.current?.click(); }
                        }}
                        style={{ position: "absolute", top: 14, right: 14, background: "#f4f4f6", border: "none", cursor: "pointer", padding: 7, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5050" }}
                      >
                        {matchInfoMode === 'add' ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        )}
                      </button>
                      {/* Hero text */}
                      <div style={{ textAlign: "center", marginBottom: 6 }} onClick={closeSheet}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2653d4" }}>Next Match</span>
                        <p style={{ margin: "6px 0 8px", fontSize: "clamp(32px, 8vw, 42px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.05, letterSpacing: "-0.01em" }}>{countdownLabel}</p>
                        <span style={{ fontSize: 14, color: "#6b7480", fontWeight: 500, lineHeight: 1 }}>{dateStr} · {match.time}</span>
                      </div>
                      {/* Detail rows */}
                      <div style={{ display: "flex", flexDirection: "column", textAlign: "center", gap: 4 }}>
                        {match.club && <span style={{ fontSize: 13, fontWeight: 500, color: "#8a9096", lineHeight: 1 }}>({match.club})</span>}
                        {match.court && (() => { const n = match.court.match(/\d+/)?.[0]; return n ? <span style={{ fontSize: 17, fontWeight: 700, color: "#1a1c1c", lineHeight: 1.4, marginTop: 2 }}>#{n}</span> : null; })()}
                      </div>

                    {/* Inline edit form — expands below info rows */}
                    {matchInfoMode === 'edit' && (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ height: 1, background: "#f0f0f0", marginBottom: 16 }} />
                        <div className="flex flex-col gap-3">
                          <button onClick={() => { setUploadError(null); actionUploadRef.current?.click(); }} disabled={uploadExtracting} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70" style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: uploadExtracting ? 0.5 : 1 }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </div>
                            <span className="text-[14px] font-semibold text-[#1a1c1c] flex-1 text-left">{uploadExtracting ? "Reading screenshot…" : "Upload screenshot"}</span>
                            {uploadExtracting && <svg className="animate-spin ml-auto flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                          </button>
                          {uploadError && <div className="px-3 py-2.5 rounded-xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{uploadError}</div>}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                              <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#fff", color: matchForm.date ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                              <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#fff", color: matchForm.time ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                            <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#fff" }} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Court #</label>
                            <input type="text" placeholder="e.g. 3" value={matchForm.court} onChange={e => setMatchForm(f => ({ ...f, court: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.court ? "#2653d4" : "#e2e2e2", background: matchForm.court ? "#f4f6ff" : "#fff" }} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                            {(['p1','p2','p3','p4'] as const).map((key, i) => (
                              <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm[key] ? "#2653d4" : "#e2e2e2", background: matchForm[key] ? "#f4f6ff" : "#fff" }} />
                            ))}
                          </div>
                          <button onClick={saveEdit} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white" style={{ background: (!matchForm.date || !matchForm.time) ? "#c4c7c7" : "#2653d4" }}>Save changes</button>
                          <button onClick={() => {
                            const key = editingMatchKey ?? match;
                            deleteUpcomingMatchFromDb(key.date, key.time ?? "");
                            const updated = getMatchList().filter(m => !(m.date === key.date && m.time === key.time));
                            const sorted = saveMatchList(updated);
                            const next = sorted[0];
                            if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, court: next.court || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
                            else setMatch(null);
                            window.dispatchEvent(new Event("storage"));
                            closeSheet();
                          }} className="w-full py-3 rounded-2xl text-[14px] font-semibold" style={{ background: "#fef2f2", color: "#dc2626", border: "none", cursor: "pointer" }}>Delete match</button>
                        </div>
                      </div>
                    )}
                    {matchInfoMode === 'add' && (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ height: 1, background: "#f0f0f0", marginBottom: 16 }} />
                        <div className="flex flex-col gap-3">
                          <button onClick={() => { setUploadError(null); actionUploadRef.current?.click(); }} disabled={uploadExtracting} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70" style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: uploadExtracting ? 0.5 : 1 }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </div>
                            <span className="text-[14px] font-semibold text-[#1a1c1c] flex-1 text-left">{uploadExtracting ? "Reading screenshot…" : "Upload screenshot"}</span>
                            {uploadExtracting && <svg className="animate-spin ml-auto flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                          </button>
                          {matchInfoAddTab !== 'manual' && (
                            <button onClick={() => setMatchInfoAddTab('manual')} className="w-full py-3 rounded-2xl text-[14px] font-semibold" style={{ background: "#f4f4f6", color: "#1a1c1c", border: "none", cursor: "pointer" }}>Add manually</button>
                          )}
                          {uploadError && <div className="px-3 py-2.5 rounded-xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{uploadError}</div>}
                          {matchInfoAddTab === 'manual' && (<>
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                              <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#fff", color: matchForm.date ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                              <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#fff", color: matchForm.time ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                            <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#fff" }} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Court #</label>
                            <input type="text" placeholder="e.g. 3" value={matchForm.court} onChange={e => setMatchForm(f => ({ ...f, court: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.court ? "#2653d4" : "#e2e2e2", background: matchForm.court ? "#f4f6ff" : "#fff" }} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                            {(['p1','p2','p3','p4'] as const).map((key, i) => (
                              <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm[key] ? "#2653d4" : "#e2e2e2", background: matchForm[key] ? "#f4f6ff" : "#fff" }} />
                            ))}
                          </div>
                          <button onClick={saveAdd} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white" style={{ background: (!matchForm.date || !matchForm.time) ? "#c4c7c7" : "#2653d4" }}>Save match</button>
                          </>)}
                        </div>
                      </div>
                    )}
                    </div>{/* end gradient section */}
                  </div>

                  {/* Other stored games — same list the FAB "Log" sheet surfaces */}
                  {otherMatches.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <p style={{ margin: "4px 2px 0", fontSize: 11, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em", textTransform: "uppercase" }}>Other upcoming games</p>
                      {otherMatches.map((m, i) => (
                        <button
                          key={`${m.date}-${m.time}-${i}`}
                          onClick={() => openEditFor(m)}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 16, background: "#f4f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a1c1c" }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                            <p style={{ margin: "1px 0 0", fontSize: 12, color: "#6b7480" }}>{m.time}{m.club ? ` · ${m.club}` : ""}{m.court ? ` · #${m.court}` : ""}</p>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#2653d4", background: "#dce8ff", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>Edit</span>
                        </button>
                      ))}
                    </div>
                  )}

                </div>{/* end flex column */}
                </div>{/* end scroll container */}
              </div>
            </div>
          );
        })()}

        {/* Match action sheet */}
        {matchActionOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "10dvh" }} onClick={() => { setMatchActionOpen(false); setMatchActionMode(null); }} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white shadow-2xl" style={{ borderRadius: 24, maxHeight: "calc(85dvh - 4rem)", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              {/* Edit match */}
              <button onClick={() => {
                if (matchActionMode === 'edit') { setMatchActionMode(null); return; }
                setIsAddMode(false);
                const fresh = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); const src = fresh ?? match;
                setMatchForm({ date: src?.date ?? '', time: src?.time ?? '', club: src?.club ?? src?.location ?? '', court: src?.court ?? '', p1: src?.player_1 ?? src?.players?.[0] ?? '', p2: src?.player_2 ?? src?.players?.[1] ?? '', p3: src?.player_3 ?? src?.players?.[2] ?? '', p4: src?.player_4 ?? src?.players?.[3] ?? '' });
                setMatchActionMode('edit');
              }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f4f6ff] transition-colors" style={{ borderBottom: "1px solid #f0f0f0" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d418" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c] flex-1 text-left">Edit match</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b5ba" strokeWidth="2.2" strokeLinecap="round" style={{ transform: matchActionMode === 'edit' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {matchActionMode === 'edit' && (() => {
                const saveMatch = () => {
                  if (!matchForm.date || !matchForm.time) return;
                  const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
                  const current = getMatchList();
                  const replaced = current.map(m => m.date === match?.date && m.time === match?.time ? data : m);
                  const updated = current.some(m => m.date === match?.date && m.time === match?.time) ? replaced : [data, ...current];
                  const sorted = saveMatchList(updated);
                  const next = sorted[0];
                  if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, court: next.court || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
                  saveUpcomingMatch(data);
                  setMatchActionOpen(false); setMatchActionMode(null); setDoIdx(-1);
                  window.dispatchEvent(new Event("storage"));
                };
                return (
                  <div className="px-5 pt-4 pb-5 flex flex-col gap-3" style={{ borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                        <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#fff", color: matchForm.date ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                        <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#fff", color: matchForm.time ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                      <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#fff" }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Court #</label>
                      <input type="text" placeholder="e.g. 3" value={matchForm.court} onChange={e => setMatchForm(f => ({ ...f, court: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.court ? "#2653d4" : "#e2e2e2", background: matchForm.court ? "#f4f6ff" : "#fff" }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                      {(['p1','p2','p3','p4'] as const).map((key, i) => (
                        <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm[key] ? "#2653d4" : "#e2e2e2", background: matchForm[key] ? "#f4f6ff" : "#fff" }} />
                      ))}
                    </div>
                    <button onClick={saveMatch} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform mt-1" style={{ background: (!matchForm.date || !matchForm.time) ? "#c4c7c7" : "#2653d4" }}>Save match</button>
                  </div>
                );
              })()}
              {/* Add a match */}
              <button onClick={() => {
                if (matchActionMode === 'add') { setMatchActionMode(null); return; }
                setIsAddMode(true);
                setMatchForm({ date: '', time: '', club: '', court: '', p1: '', p2: '', p3: '', p4: '' });
                setMatchActionMode('add');
              }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f4f6ff] transition-colors" style={{ borderBottom: "1px solid #f0f0f0" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f0fdf4" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c] flex-1 text-left">Add a match</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b5ba" strokeWidth="2.2" strokeLinecap="round" style={{ transform: matchActionMode === 'add' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {matchActionMode === 'add' && (() => {
                const saveMatch = () => {
                  if (!matchForm.date || !matchForm.time) return;
                  const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
                  const current = getMatchList();
                  const updated = [...current, data];
                  const sorted = saveMatchList(updated);
                  const next = sorted[0];
                  if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, court: next.court || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
                  saveUpcomingMatch(data);
                  setMatchActionOpen(false); setMatchActionMode(null); setDoIdx(-1);
                  window.dispatchEvent(new Event("storage"));
                };
                return (
                  <div className="px-5 pt-4 pb-5 flex flex-col gap-3" style={{ borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
                    {/* Upload button */}
                    <button
                      disabled={uploadExtracting}
                      onClick={() => { setUploadError(null); actionUploadRef.current?.click(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70 transition-opacity"
                      style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: uploadExtracting ? 0.5 : 1 }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                      <span className="text-[14px] font-semibold text-[#1a1c1c]">
                        {uploadExtracting ? "Reading screenshot…" : "Upload screenshot"}
                      </span>
                      {uploadExtracting && <svg className="animate-spin ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                    </button>
                    {uploadError && <div className="px-3 py-2.5 rounded-xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{uploadError}</div>}
                    <input ref={actionUploadRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadError(null); setUploadExtracting(true);
                      try {
                        const reader = new FileReader();
                        const base64 = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
                        const res = await fetch('/api/extract-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, mediaType: file.type }) });
                        const data = await res.json();
                        if (!res.ok || data.error) { setUploadError(data.message || 'Could not read the screenshot. Please enter manually.'); }
                        else { setMatchForm({ date: data.date ?? '', time: data.time ?? '', club: data.club ?? '', court: data.court ?? '', p1: data.player_1 ?? '', p2: data.player_2 ?? '', p3: data.player_3 ?? '', p4: data.player_4 ?? '' }); }
                      } catch { setUploadError('Upload failed. Please try again or enter manually.'); }
                      setUploadExtracting(false);
                      if (actionUploadRef.current) actionUploadRef.current.value = '';
                    }} />
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                        <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#fff", color: matchForm.date ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                        <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#fff", color: matchForm.time ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                      <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#fff" }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Court #</label>
                      <input type="text" placeholder="e.g. 3" value={matchForm.court} onChange={e => setMatchForm(f => ({ ...f, court: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm.court ? "#2653d4" : "#e2e2e2", background: matchForm.court ? "#f4f6ff" : "#fff" }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                      {(['p1','p2','p3','p4'] as const).map((key, i) => (
                        <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: matchForm[key] ? "#2653d4" : "#e2e2e2", background: matchForm[key] ? "#f4f6ff" : "#fff" }} />
                      ))}
                    </div>
                    <button onClick={saveMatch} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform mt-1" style={{ background: (!matchForm.date || !matchForm.time) ? "#c4c7c7" : "#16a34a" }}>Save match</button>
                  </div>
                );
              })()}
              {/* See all matches */}
              <button onClick={() => { setMatchActionOpen(false); setMatchActionMode(null); startNavLoad(); router.push("/matches"); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f4f4f6" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c]">See all matches</span>
              </button>
            </div>
          </div>
        )}

        {/* Add / Edit Match modal */}
        {matchModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); setLiveX(0); setLiveY(0); setUploadError(null); setUploadExtracting(false); }} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-[#f0f0f0]">
                <div>
                  <p className="text-[18px] font-bold text-[#1a1c1c]">{isAddMode ? "Add Match" : "Edit Match"}</p>
                  <p className="text-[13px] text-[#6b7480] mt-0.5">Upload a screenshot or enter manually</p>
                </div>
                <button onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); setLiveX(0); setLiveY(0); setUploadError(null); setUploadExtracting(false); }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#f4f4f6" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {matchModalTab === 'pick' && (
                <div className="px-6 py-6 flex flex-col gap-3">
                  {uploadExtracting && (
                    <div className="flex items-center justify-center gap-3 py-4">
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      <span className="text-[14px] font-medium text-[#2653d4]">Reading screenshot…</span>
                    </div>
                  )}
                  {uploadError && (
                    <div className="px-4 py-3 rounded-2xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{uploadError}</div>
                  )}
                  <button
                    disabled={uploadExtracting}
                    onClick={() => {
                      setUploadError(null);
                      setLiveX(0);
                      setCardSnap('none');
                      const onFocus = () => { setLiveX(0); setCardSnap('none'); window.removeEventListener('focus', onFocus); };
                      window.addEventListener('focus', onFocus);
                      matchUploadRef.current?.click();
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:opacity-70 transition-opacity"
                    style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: uploadExtracting ? 0.5 : 1 }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">Upload screenshot</p>
                      <p className="text-[12px] text-[#6b7480] mt-0.5">From your camera roll or files</p>
                    </div>
                  </button>
                  <input ref={matchUploadRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadError(null);
                    setUploadExtracting(true);
                    try {
                      const reader = new FileReader();
                      const base64 = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => {
                          const result = reader.result as string;
                          resolve(result.split(',')[1]);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                      const res = await fetch('/api/extract-match', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64, mediaType: file.type }),
                      });
                      const data = await res.json();
                      if (!res.ok || data.error) {
                        setUploadError(data.message || 'Could not read the screenshot. Please enter manually.');
                        setUploadExtracting(false);
                        return;
                      }
                      setMatchForm({
                        date: data.date ?? '',
                        time: data.time ?? '',
                        club: data.club ?? '',
                        court: data.court ?? '',
                        p1: data.player_1 ?? '',
                        p2: data.player_2 ?? '',
                        p3: data.player_3 ?? '',
                        p4: data.player_4 ?? '',
                      });
                      setMatchModalTab('confirm');
                    } catch {
                      setUploadError('Upload failed. Please try again or enter manually.');
                    }
                    setUploadExtracting(false);
                    if (matchUploadRef.current) matchUploadRef.current.value = '';
                  }} />

                  <button
                    disabled={uploadExtracting}
                    onClick={() => { setMatchForm({ date: match?.date ?? '', time: match?.time ?? '', club: match?.club ?? '', court: match?.court ?? '', p1: match?.players?.[0] ?? '', p2: match?.players?.[1] ?? '', p3: match?.players?.[2] ?? '', p4: match?.players?.[3] ?? '' }); setMatchModalTab('manual'); }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:opacity-70 transition-opacity"
                    style={{ background: "#f9f9f9", border: "1.5px solid #f0f0f0", opacity: uploadExtracting ? 0.5 : 1 }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1a1c1c" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="13" y2="18"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">Enter manually</p>
                      <p className="text-[12px] text-[#6b7480] mt-0.5">Date, time, club and players</p>
                    </div>
                  </button>
                </div>
              )}

              {matchModalTab === 'confirm' && (
                <div className="px-6 py-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f0fdf4" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p className="text-[13px] font-semibold text-[#16a34a]">We read your screenshot — does this look right?</p>
                  </div>
                  <div style={{ background: "#f9f9f9", borderRadius: 16, overflow: "hidden", border: "1px solid #f0f0f0" }}>
                    {[
                      { label: "Date", value: matchForm.date ? new Date(matchForm.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—" },
                      { label: "Time", value: matchForm.time || "—" },
                      { label: "Club", value: matchForm.club || "—" },
                      { label: "Players", value: [matchForm.p1, matchForm.p2, matchForm.p3, matchForm.p4].filter(Boolean).join(", ") || "—" },
                    ].map((row, i, arr) => (
                      <div key={row.label} className="flex items-center px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#8a9096] w-16 flex-shrink-0">{row.label}</span>
                        <span className="text-[14px] font-medium text-[#1a1c1c]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (!matchForm.date || !matchForm.time) return;
                      const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
                      const current = getMatchList();
                      let updated: StoredMatch[];
                      if (isAddMode) { updated = [...current, data]; } else {
                        const replaced = current.map(m => m.date === match?.date && m.time === match?.time ? data : m);
                        updated = current.some(m => m.date === match?.date && m.time === match?.time) ? replaced : [data, ...current];
                      }
                      const sorted = saveMatchList(updated);
                      const next = sorted[0];
                      if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
                      saveUpcomingMatch({ date: data.date, time: data.time, club: data.club, court: data.court, player_1: data.player_1, player_2: data.player_2, player_3: data.player_3, player_4: data.player_4 });
                      setMatchModalOpen(false); setMatchModalTab('pick'); setLiveX(0); setLiveY(0); setCardSnap('none'); setDoIdx(-1);
                      window.dispatchEvent(new Event("storage"));
                    }}
                    className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
                    style={{ background: (!matchForm.date || !matchForm.time) ? "#c4c7c7" : "#2653d4" }}
                  >
                    Yes, save match
                  </button>
                  <button
                    onClick={() => setMatchModalTab('manual')}
                    className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-70 transition-opacity"
                    style={{ background: "#f4f4f6", color: "#4a5050" }}
                  >
                    Edit details
                  </button>
                </div>
              )}

              {matchModalTab === 'manual' && (
                <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                      <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#f9f9f9", color: matchForm.date ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                      <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#f9f9f9", color: matchForm.time ? "#1a1c1c" : "#b0b5ba", minHeight: 44, cursor: "pointer" }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                    <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]"
                      style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#f9f9f9" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                    {(['p1','p2','p3','p4'] as const).map((key, i) => (
                      <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]"
                        style={{ borderColor: matchForm[key] ? "#2653d4" : "#e2e2e2", background: matchForm[key] ? "#f4f6ff" : "#f9f9f9" }} />
                    ))}
                    {(() => {
                      const opponentInputs = [matchForm.p3, matchForm.p4].filter(Boolean).map(s => s.toLowerCase().trim());
                      if (!opponentInputs.length) return null;
                      const matched = pastReviews.filter(r =>
                        opponentInputs.some(name =>
                          r.opponentNames.toLowerCase().split(/[\s,&]+/).some(n => n.length > 2 && name.includes(n))
                        )
                      );
                      if (!matched.length) return null;
                      const wins   = matched.filter(r => r.result === "win").length;
                      const losses = matched.filter(r => r.result === "loss").length;
                      const topStrength = matched.flatMap(r => r.wellDone).slice(0, 3).filter((v, i, a) => a.indexOf(v) === i);
                      const topWeakness = matched.flatMap(r => r.improved).slice(0, 3).filter((v, i, a) => a.indexOf(v) === i);
                      return (
                        <div style={{ background: "#f4f6ff", borderRadius: 14, padding: "12px 14px", marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
                          <p style={{ fontSize: "clamp(11px, 2.8vw, 14px)", fontWeight: 700, color: "#2653d4", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                            History vs this opponent — {wins}W {losses}L
                          </p>
                          {topStrength.length > 0 && (
                            <p style={{ fontSize: "clamp(12px, 3.1vw, 15px)", color: "#496640", margin: 0 }}>
                              Worked well: {topStrength.join(", ")}
                            </p>
                          )}
                          {topWeakness.length > 0 && (
                            <p style={{ fontSize: "clamp(12px, 3.1vw, 15px)", color: "#d97706", margin: 0 }}>
                              Focus on: {topWeakness.join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => {
                      if (!matchForm.date || !matchForm.time) return;
                      const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
                      const current = getMatchList();
                      let updated: StoredMatch[];
                      if (isAddMode) {
                        updated = [...current, data];
                      } else {
                        // Replace the current next match (matched by date+time)
                        const replaced = current.map(m => m.date === match?.date && m.time === match?.time ? data : m);
                        updated = current.some(m => m.date === match?.date && m.time === match?.time) ? replaced : [data, ...current];
                      }
                      const sorted = saveMatchList(updated);
                      const next = sorted[0];
                      if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
                      saveUpcomingMatch({ date: data.date, time: data.time, club: data.club, court: data.court, player_1: data.player_1, player_2: data.player_2, player_3: data.player_3, player_4: data.player_4 });
                      setMatchModalOpen(false);
                      setMatchModalTab('pick');
                      setLiveX(0);
                      setLiveY(0);
                      setCardSnap('none');
                      setDoIdx(-1);
                    }}
                    className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                    style={{ background: matchForm.date && matchForm.time ? "#2653d4" : "#d0d3d6" }}
                  >Save Match</button>
                  <button onClick={() => setMatchModalTab('pick')} className="w-full py-2 text-[13px] font-semibold text-[#6b7480]">← Back</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule detail modal */}
        {schedDetailOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.5)" }} onClick={() => setSchedDetailOpen(null)}>
            <div style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 24, padding: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${schedDetailOpen.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: schedDetailOpen.color }} />
              </div>
              <p style={{ fontSize: "clamp(26px, 6.6vw, 32px)", fontWeight: 700, color: "#1a1c1c", margin: "0 0 4px" }}>{schedDetailOpen.title}</p>
              {schedDetailOpen.subtitle && <p style={{ fontSize: "clamp(20px, 5.1vw, 24px)", color: "#6b7480", margin: "0 0 12px" }}>{schedDetailOpen.subtitle}</p>}
              <div style={{ height: 1, background: "#dfe3e7", margin: "12px 0" }} />
              {schedDetailOpen.isDrill ? (
                <p style={{ fontSize: "clamp(21px, 5.4vw, 26px)", color: "#3a4550", lineHeight: 1.6, margin: 0 }}>
                  {(DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).subtitle}
                </p>
              ) : (
                <p style={{ fontSize: "clamp(21px, 5.4vw, 26px)", color: "#3a4550", lineHeight: 1.6, margin: 0 }}>{schedDetailOpen.detail}</p>
              )}
              <button onClick={() => setSchedDetailOpen(null)} style={{ marginTop: 20, width: "100%", padding: "12px 0", borderRadius: 50, background: "#f4f4f6", border: "none", fontSize: "clamp(23px, 5.8vw, 27px)", fontWeight: 600, color: "#1a1c1c", cursor: "pointer" }}>Done</button>
            </div>
          </div>
        )}

        {/* Breathing disclaimer — shown only on the breathing (left) card */}
        <p
          style={{
            position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)",
            width: "80%", fontSize: "clamp(10px, 2.8vw, 13px)", color: "#c8cdd3", margin: 0, textAlign: "center", lineHeight: 1.4,
            zIndex: cardSnap === 'right' ? 65 : -1, opacity: cardSnap === 'right' ? 1 : 0, pointerEvents: "none",
            transition: "opacity 0.3s",
          }}
        >
          Skip if you have a respiratory condition
        </p>

        {/* Stats link + Settings shortcut — shown only on the bottom (grid) card */}
        <div
          style={{
            position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 18,
            zIndex: doIdx === 1 ? 65 : -1, opacity: doIdx === 1 ? 1 : 0, pointerEvents: doIdx === 1 ? "auto" : "none",
            transition: "opacity 0.3s",
          }}
        >
          <button
            onClick={() => setOpenPanel("schedule")}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <polyline points="8,12 10.5,14.5 16,9"/>
            </svg>
          </button>
          <button
            onClick={() => setOpenPanel("stats")}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>
          <button
            onClick={() => { startNavLoad(); router.push("/settings"); }}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 9.76,4.01 L 9.71,1.75 L 14.29,1.75 L 14.24,4.01 L 16.07,4.77 L 17.63,3.13 L 20.87,6.37 L 19.23,7.93 L 19.99,9.76 L 22.25,9.71 L 22.25,14.29 L 19.99,14.24 L 19.23,16.07 L 20.87,17.63 L 17.63,20.87 L 16.07,19.23 L 14.24,19.99 L 14.29,22.25 L 9.71,22.25 L 9.76,19.99 L 7.93,19.23 L 6.37,20.87 L 3.13,17.63 L 4.77,16.07 L 4.01,14.24 L 1.75,14.29 L 1.75,9.71 L 4.01,9.76 L 4.77,7.93 L 3.13,6.37 L 6.37,3.13 L 7.93,4.77 Z"/>
            </svg>
          </button>
        </div>

        <ScheduleSheet open={openPanel === "schedule"} onClose={() => setOpenPanel(null)} />
        <StatsSheet
          open={openPanel === "stats"}
          onClose={() => setOpenPanel(null)}
          points={completed.size}
          streak={streak}
          winRate={winRate}
          readiness={readiness}
        />
      </main>
    </>
  );
}
