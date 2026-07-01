"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogSheet from "@/components/log-sheet";
import ReadinessSheet from "@/components/readiness-sheet";
import PushPrompt from "@/components/push-prompt";
import { computeScores, loadScoringData, computePillarStates, loadScoreHistory, computeMatchReadiness, loadMorningLog, improveTips, type MatchReadinessResult, type PillarStates, type DailyCheckIn, type HydrationEntry, type NutritionEntry, type TrainingEntry } from "@/lib/scoring";
import { pad, addMins, toMins, DRILL_LIBRARY, DEFAULT_DRILL, getTopNeedsWorkTag, getDayType, ITEM_COLORS, type ScheduleItem, type DayType, getScheduleData, SCHEDULE_DETAILS } from "@/lib/schedule-data";
import { saveUpcomingMatch, saveNutritionToDb, saveHydrationToDb, saveNoteToDb, saveMatchReview, saveGearToDb, saveScheduleDoneToDb, saveTrainingToDb, deleteUpcomingMatchFromDb } from "@/lib/db";
import { hydrateFromSupabase } from "@/lib/sync";
import { downloadSnapshot } from "@/lib/storage";

// ── Warmup audio captions (from 0618 (1).srt) ────────────────────────────
const WARMUP_CUES: { from: number; text: string }[] = [
  { from: 0,     text: "take a breath if you're listening to this" },
  { from: 2.4,   text: "chances are your match is about 10 or 15 minutes away" },
  { from: 5.7,   text: "and right now whether you realize it or not" },
  { from: 8.4,   text: "your brain is already playing padel" },
  { from: 10.4,  text: "it's thinking about opponents" },
  { from: 12.1,  text: "it's remembering the last match" },
  { from: 13.8,  text: "it's replaying mistakes" },
  { from: 15.1,  text: "it's imagining great points that haven't happened yet" },
  { from: 17.9,  text: "the funny thing is" },
  { from: 18.8,  text: "that the actual match hasn't even started" },
  { from: 21.3,  text: "you're still in the car and that's where we'll begin" },
  { from: 24.0,  text: "because one of the most useful skills in padel" },
  { from: 26.2,  text: "has nothing to do with technique" },
  { from: 28.0,  text: "it's the ability to arrive mentally" },
  { from: 29.9,  text: "where your feet already are" },
  { from: 31.4,  text: "right now you're not playing a match" },
  { from: 33.2,  text: "you're driving to one" },
  { from: 34.5,  text: "so let the future stay in the future" },
  { from: 36.3,  text: "for a few more minutes let's do a quick check" },
  { from: 38.9,  text: "how's your hydration nothing fancy here" },
  { from: 41.5,  text: "if you've brought water good" },
  { from: 43.4,  text: "if you have electrolytes that you normally use fine" },
  { from: 46.2,  text: "if not that's fine too" },
  { from: 47.6,  text: "the goal isn't perfection" },
  { from: 49.2,  text: "the goal is simply not showing up dehydrated" },
  { from: 51.8,  text: "hydration isn't about gaining an advantage" },
  { from: 54.1,  text: "it's about avoiding an unnecessary disadvantage simple" },
  { from: 57.6,  text: "now let's talk about expectations" },
  { from: 59.8,  text: "many players arrive at the court" },
  { from: 61.4,  text: "carrying invisible luggage" },
  { from: 63.2,  text: "maybe it's their ranking maybe it's their partner" },
  { from: 65.8,  text: "maybe it's a previous loss" },
  { from: 67.4,  text: "maybe it's the belief that they should win" },
  { from: 69.4,  text: "but Padel doesn't care the court doesn't care" },
  { from: 72.0,  text: "the glass doesn't care the ball certainly doesn't care" },
  { from: 75.3,  text: "the match begins at 0 zero" },
  { from: 77.1,  text: "every single time" },
  { from: 78.5,  text: "and that's one of the most beautiful things about sport" },
  { from: 81.3,  text: "nobody owes you anything everything starts fresh" },
  { from: 83.8,  text: "now let's talk tactics not complicated tactics" },
  { from: 86.7,  text: "just useful reminders first" },
  { from: 89.1,  text: "respect the net at most club levels" },
  { from: 91.0,  text: "the team controlling the net usually controls the match" },
  { from: 93.7,  text: "that doesn't mean rushing the net recklessly" },
  { from: 96.3,  text: "it means understanding its value" },
  { from: 98.0,  text: "if you're at the back" },
  { from: 99.0,  text: "and your opponents are comfortable at the net" },
  { from: 101.4, text: "your mission isn't necessarily to hit a winner" },
  { from: 104.0, text: "your mission is often much simpler" },
  { from: 105.9, text: "create an opportunity to move forward" },
  { from: 108.2, text: "maybe that's a lob maybe it's a deep ball" },
  { from: 110.7, text: "maybe it's patience the point isn't the shot" },
  { from: 113.4, text: "the point is improving your position" },
  { from: 115.6, text: "second make your opponents earn points" },
  { from: 118.2, text: "this sounds obvious" },
  { from: 119.2, text: "but many matches are lost because players donate points" },
  { from: 122.4, text: "unforced errors low percentage winners" },
  { from: 124.8, text: "hero shots the kind of shot that looks amazing once" },
  { from: 127.5, text: "and fails four times today" },
  { from: 129.7, text: "see what happens if you make your opponents hit" },
  { from: 132.0, text: "one more ball then one more" },
  { from: 134.2, text: "then one more third" },
  { from: 136.1, text: "watch the feet if you get a comfortable ball at the net" },
  { from: 139.3, text: "remember that the feet" },
  { from: 140.1, text: "are often a better target than the corners" },
  { from: 142.5, text: "a difficult volley at someone's shoes" },
  { from: 144.4, text: "can create more problems" },
  { from: 145.9, text: "than a spectacular shot aimed at the fence" },
  { from: 148.6, text: "simple beats flashy" },
  { from: 149.8, text: "more often than most players realize" },
  { from: 151.9, text: "now let's talk about the first few games" },
  { from: 153.9, text: "the beginning of a match tells a story" },
  { from: 156.0, text: "and many players try to write the ending in Chapter 1" },
  { from: 158.8, text: "don't use the first few games to gather information" },
  { from: 161.9, text: "who likes to lob who gets nervous under pressure" },
  { from: 164.7, text: "who serves well who rushes" },
  { from: 166.6, text: "who stays calm think like an observer" },
  { from: 169.1, text: "the player who learns fastest often wins" },
  { from: 171.5, text: "and finally a reminder" },
  { from: 173.1, text: "you're going to miss shots today" },
  { from: 174.8, text: "everybody does professionals do" },
  { from: 177.2, text: "beginners do everyone in between does" },
  { from: 180.0, text: "the difference isn't who misses" },
  { from: 181.9, text: "the difference is who recovers" },
  { from: 183.7, text: "can you let one bad point stay one bad point" },
  { from: 186.2, text: "can you avoid turning one mistake into three" },
  { from: 188.6, text: "can you reset" },
  { from: 189.7, text: "because matches are rarely decided by a single error" },
  { from: 192.6, text: "they're often decided" },
  { from: 193.8, text: "by the emotional reaction that follows it" },
  { from: 196.1, text: "so as you arrive at the club" },
  { from: 197.9, text: "leave a little room for curiosity" },
  { from: 200.0, text: "see what kind of match this becomes" },
  { from: 202.0, text: "compete communicate" },
  { from: 203.7, text: "move your feet stay present" },
  { from: 205.7, text: "and when the first point begins" },
  { from: 207.4, text: "remember you don't need to play perfect padel" },
  { from: 210.4, text: "you just need to make the next good decision" },
  { from: 212.5, text: "good luck see you on court" },
];

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
  const [modalClosing, setModalClosing] = useState(false);
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
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; court?: string; players?: string[] } | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [matchActionMode, setMatchActionMode] = useState<null | 'edit' | 'add'>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [now, setNow] = useState(new Date());
  const lastDateRef = useRef(new Date().toISOString().slice(0, 10));
  const doneAtRef = useRef<Map<number, number>>(new Map());
  const [doIdx, setDoIdx] = useState(0); // -1 = top holder, 0 = do-this-now, 1 = see schedule
  const [completed, setCompleted] = useState<Set<number>>(new Set());
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
  const [postMatchOpen, setPostMatchOpen] = useState(false);
  const [postMatchDate, setPostMatchDate] = useState<string | null>(null);
  const [checkinNudgeOpen, setCheckinNudgeOpen] = useState(false);
  const [yesterdayWasMatch, setYesterdayWasMatch] = useState(false);
  const [gameDays, setGameDays] = useState<string[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<{ date: string; time: string }[]>([]);
  const [dayType, setDayType] = useState<DayType>("baseline");
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [drillSteps, setDrillSteps] = useState<{ step: string; cue: string; reps: string }[] | null>(null);
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
  const [cardSnap, setCardSnap] = useState<'none' | 'left' | 'right'>('none');
  const [liveX, setLiveX] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const swipeTrackRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef(0);
  const [liveY, setLiveY] = useState(0);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathDashOffset, setBreathDashOffset] = useState(560);
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
      setReadiness(computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training).overall);
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
          const morningLog = JSON.parse(localStorage.getItem("padelop:morning-log") || "null");
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
      // Compute streak from score snapshot history
      const history = loadScoreHistory();
      const dateset = new Set(history.map(s => s.date));
      let s = 0;
      const cur = new Date();
      if (!dateset.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
      while (dateset.has(cur.toISOString().slice(0, 10))) { s++; cur.setDate(cur.getDate() - 1); }
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
        const ml = JSON.parse(localStorage.getItem("padelop:morning-log") || "null");
        const done = ml?.date === todayStr;
        setMorningDone(done);
        const hour = new Date().getHours();
        const nudgeDismissed = localStorage.getItem("padelop:checkin-nudge-dismissed") === todayStr;
        if (done) {
          setCheckinNudgeOpen(false);
        }
      } catch { setMorningDone(false); }
      // Seed completed Set from padelop:schedule-done + waterOnWaking
      try {
        const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
        const doneTitles = sd[todayStr] ?? [];
        const sched = getScheduleData(dayTypeRef.current, match?.time ?? null, drillTagRef.current).schedule;
        const indices = new Set<number>();
        sched.forEach((item, i) => { if (doneTitles.includes(item.title)) indices.add(i); });
        try {
          const dat: Record<string, Record<string, number>> = JSON.parse(localStorage.getItem("padelop:done-at") || "{}");
          const todayDat = dat[todayStr] ?? {};
          sched.forEach((item, i) => { if (todayDat[item.title]) doneAtRef.current.set(i, todayDat[item.title]); });
        } catch {}
        // Directly merge waterOnWaking into indices without going through schedule-done
        try {
          const ml = JSON.parse(localStorage.getItem("padelop:morning-log") || "null");
          if (ml?.date === todayStr && ml?.waterOnWaking === true) {
            const wakeIdx = sched.findIndex(item => item.title === "Wake up");
            if (wakeIdx >= 0) {
              indices.add(wakeIdx);
              // Persist to schedule-done + DB if not already there
              if (!doneTitles.includes("Wake up")) {
                const updated = [...doneTitles, "Wake up"];
                sd[todayStr] = updated;
                localStorage.setItem("padelop:schedule-done", JSON.stringify(sd));
                saveScheduleDoneToDb(todayStr, updated);
              }
            }
          }
        } catch {}
        setCompleted(indices);
      } catch {}
    }
    function loadMatch() {
      const todayD = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
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
    window.addEventListener("padelop:open-log-sheet", handleOpenLogSheet);
    window.addEventListener("padelop:toggle-log-sheet", handleToggleLogSheet);
    // Only show the morning nudge AFTER sync finishes — avoids false positives when sync hasn't loaded yet
    function handleSyncDone() {
      loadReadiness();
      loadMatch();
      const todayStr = new Date().toISOString().slice(0, 10);
      const ml = JSON.parse(localStorage.getItem("padelop:morning-log") || "null");
      const done = ml?.date === todayStr;
      const nudgeDismissed = localStorage.getItem("padelop:checkin-nudge-dismissed") === todayStr;
      const hour = new Date().getHours();
      if (!done && !nudgeDismissed && hour < 13) setCheckinNudgeOpen(true);
    }
    window.addEventListener("padelop:sync-done", handleSyncDone);
    setDrillTag(getTopNeedsWorkTag());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => { clearInterval(id); window.removeEventListener("storage", handleStorage); window.removeEventListener("padelop:match-added", handleMatchAdded); window.removeEventListener("padelop:open-log-sheet", handleOpenLogSheet); window.removeEventListener("padelop:toggle-log-sheet", handleToggleLogSheet); window.removeEventListener("padelop:sync-done", handleSyncDone); };
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
    if (doIdx === 0) setDrumIdx(currentIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doIdx]);


  useEffect(() => {
    const item = schedule[schedModalIdx ?? currentIdx];
    if (!doModalOpen || !item?.isDrill) { setDrillSteps(null); return; }
    const def = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
    setDrillSteps(def.steps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doModalOpen, schedModalIdx]);

  // Detect when a match has ended (same day or previous day) and prompt review
  useEffect(() => {
    if (!match || postMatchOpen) return;
    const matchDay = match.date;
    const todayDay = now.toISOString().slice(0, 10);

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
      setBreathDashOffset(560);
      return;
    }
    breathStartRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - breathStartRef.current) % 16000;
      setBreathPhase(Math.floor(elapsed / 4000));
      setBreathDashOffset(560 - (elapsed / 16000) * 560);
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
  const curMins = now.getHours() * 60 + now.getMinutes();

  const goNext = () => setDoIdx(i => Math.min(i + 1, 1));
  const goPrev = () => setDoIdx(i => Math.max(i - 1, -1));

  return (
    <>
      <main style={{ ...S, position: "fixed", inset: 0, paddingTop: 0, paddingLeft: 10, paddingRight: 10, paddingBottom: 0, overflow: "hidden", background: "#fff", zIndex: 60 }}>

        {/* Horizontal strip: [readiness | carousel | log] */}
        <div
          ref={outerRef}
          style={{
            display: "flex", width: "300%", marginLeft: "-100%",
            height: "100dvh", touchAction: doIdx >= 1 ? "pan-y" : "manipulation",
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
            if (doIdx >= 1) return;
            const dx = e.touches[0].clientX - touchStartXRef.current;
            const dy = e.touches[0].clientY - touchStartYRef.current;
            if (!swipeDirRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
              swipeDirRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (swipeDirRef.current === 'h' && doIdx === 0) setLiveX(dx);
            if (swipeDirRef.current === 'v' && cardSnap === 'none' && doIdx < 1 && !settlingRef.current) setLiveY(dy);
          }}
          onTouchEnd={e => {
            const endY = e.changedTouches[0].clientY;
            const dx = e.changedTouches[0].clientX - touchStartXRef.current;
            if (doIdx >= 1) { swipeDirRef.current = null; return; }
            const dy = endY - touchStartYRef.current;
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
                  <div style={{ position: "relative", width: "60%", aspectRatio: "1 / 1" }}>
                    <svg width="100%" height="100%" viewBox="0 0 160 160" style={{ display: "block", overflow: "visible" }}>
                      <path d="M10 150 L10 10 L150 10 L150 150 L10 150" fill="none" stroke="#dce8f8" strokeWidth="5" strokeLinejoin="miter" />
                      <path d="M10 150 L10 10 L150 10 L150 150 L10 150" fill="none" stroke="#3b9eff" strokeWidth="5" strokeLinejoin="miter"
                        strokeDasharray="560" strokeDashoffset={breathDashOffset} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: "0.8vw" }}>
                      <p style={{ fontSize: "clamp(16px, 5.25vw, 22px)", fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1 }}>Breathe</p>
                      <p style={{ fontSize: "clamp(11px, 3.5vw, 16px)", fontWeight: 500, color: "#9aa5b0", margin: 0, textAlign: "center", lineHeight: 1.3 }}>(4x4 box breath)</p>
                    </div>
                  </div>
                  <div style={{ height: "clamp(24px, 6vw, 32px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {(() => {
                      const phases = [
                        { label: "In (nose)" },
                        { label: "Hold" },
                        { label: "Out (mouth)" },
                        { label: "Hold" },
                      ];
                      const p = phases[breathPhase];
                      return (
                        <p key={breathPhase} style={{ fontSize: "clamp(13px, 4vw, 18px)", color: "#3b9eff", margin: 0, lineHeight: 1, fontWeight: 600 }}>
                          {p.label}
                        </p>
                      );
                    })()}
                  </div>
                  <p style={{ fontSize: "clamp(10px, 2.8vw, 13px)", color: "#c8cdd3", margin: 0, textAlign: "center", lineHeight: 1.4 }}>Skip if you have a respiratory condition</p>
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
              transform: doIdx >= 1
                ? `translateY(calc(270px - 200vw - 100dvh))`
                : doIdx === -1
                  ? `translateY(calc(60px - 100vw + ${liveY}px))`
                  : `translateY(calc(160px - 150vw - 55dvh + ${liveY}px))`,
              transition: liveY !== 0 ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}>
              {/* Structural spacer — keeps transform geometry intact */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", pointerEvents: "none" }} />

              {/* Card 0: next match */}
              {(() => {
                const today = now.toISOString().slice(0, 10);
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
                            onClick={() => window.dispatchEvent(new Event("padelop:add-match"))}
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

              {/* Card 1: do-this-now */}
              {(() => {
                const s = doItem;
                const isDone = completed.has(currentIdx);
                const isReady = curMins >= toMins(s.time);
                const nextSlide = schedule[currentIdx + 1];
                const secsUntilNext = nextSlide ? toMins(nextSlide.time) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) : 0;
                const fmtTime = (s: number) => { if (s <= 0) return "a moment"; const h = Math.floor(s / 3600), rem = s % 3600, m = Math.floor(rem / 60), sec = rem % 60; const ss = String(sec).padStart(2, "0"); if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m ${ss}s`; return m > 0 ? `${m}m ${ss}s` : `${sec}s`; };
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
                  const doneAt = doneAtRef.current.get(currentIdx);
                  const justDone = doneAt && (Date.now() - doneAt < 2000);
                  const completedTitle = s.title === "Lunch" ? "Lunchtime" : s.title === "Dinner" ? "Dinnertime" : s.title;
                  const nextTitle = nextSlide.title === "Lunch" ? "Lunchtime" : nextSlide.title === "Dinner" ? "Dinnertime" : nextSlide.title;

                  return (
                    <div key="done-card" style={{ ...cardStyle, background: "#c8cacc", animation: "ball-drop 0.9s 0.1s both, circle-breathe 4s ease-in-out 1.1s infinite" }} onClick={() => { setSchedModalIdx(currentIdx); setDoModalOpen(true); setModalDetailOpen(false); }}>
                      {textureOverlay}

                      {/* Timer layer — 3 rows matching done flash slot heights exactly */}
                      <div style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, animation: justDone ? "fade-in 0.9s ease-out 1.1s both" : undefined }}>
                        {/* Row 1: same height as checkmark SVG (38px) */}
                        <div style={{ height: 38, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5 }}>
                          <span style={{ fontSize: "clamp(14px, 4vw, 17px)", fontWeight: 700, color: "#1a1c1c" }}>{nextTitle}</span>
                          <span style={{ fontSize: "clamp(11px, 3vw, 13px)", fontWeight: 500, color: "rgba(0,0,0,0.45)", letterSpacing: "0.04em" }}>in</span>
                        </div>
                        {/* Row 2: same font + padding as Breakfast pill → same height */}
                        <p style={{ fontSize: "clamp(22px, 7vw, 30px)", fontWeight: 800, color: "#1a1c1c", margin: 0, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", textAlign: "center", lineHeight: 1.2, background: "#fff", padding: "3px 8px", borderRadius: 4 }}>{fmtTime(secsUntilNext)}</p>
                        {/* Row 3: invisible spacer matching "Done" text height */}
                        <p style={{ fontSize: "clamp(13px, 4vw, 17px)", margin: 0, color: "transparent" }} aria-hidden>Done</p>
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
                const handleWarmupToggle = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!warmupAudioRef.current) {
                    const a = new Audio("/warmup.mp3");
                    warmupAudioRef.current = a;
                    a.onended = () => { setWarmupPlaying(false); setWarmupCurrentTime(0); warmupCurrentTimeRef.current = 0; if (warmupRafRef.current) cancelAnimationFrame(warmupRafRef.current); };
                    a.ontimeupdate = () => { setWarmupCurrentTime(a.currentTime); warmupCurrentTimeRef.current = a.currentTime; };
                    a.onloadedmetadata = () => { setWarmupDuration(a.duration); warmupDurationRef.current = a.duration; };
                  }
                  if (warmupPlaying) {
                    warmupAudioRef.current.pause();
                    setWarmupPlaying(false);
                    if (warmupRafRef.current) cancelAnimationFrame(warmupRafRef.current);
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
                return (
                  <div key="active" className="animate-bounce-in" style={cardStyle}>
                    {textureOverlay}
                    {/* Visualizer — fills ball when playing */}
                    <canvas
                      ref={warmupVizRef}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: warmupPlaying ? 1 : 0, transition: "opacity 0.5s" }}
                    />
                    {/* INFO STATE: fades out when playing */}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: warmupPlaying ? 0 : isSleepytime ? 0.2 : contentOpacity, transition: "opacity 0.35s", pointerEvents: warmupPlaying ? "none" : "auto" }}>
                      {!isSleepytime && <p className="text-[14px] tracking-wide leading-none" style={{ color: "#000", fontWeight: 600, background: "#fff", padding: 4, borderRadius: 4 }}>Do this now</p>}
                      {(() => {
                        const circleTitle = s.title === "Lunch" ? "Lunchtime" : s.title === "Dinner" ? "Dinnertime" : s.title;
                        return (
                          <p style={{ color: "#000", fontWeight: 800, fontSize: "clamp(24px, 7.5vw, 34px)", lineHeight: 1.2, background: "#fff", padding: "3px 6px", borderRadius: 4, display: "inline-block", textAlign: "center", margin: 0 }}>
                            {circleTitle.includes(" & ")
                              ? <>{circleTitle.split(" & ")[0]}<br />{"& " + circleTitle.split(" & ").slice(1).join(" & ")}</>
                              : circleTitle}
                          </p>
                        );
                      })()}
                      {isAudioAvailable
                        ? (
                          <button onClick={handleWarmupToggle} style={{ marginTop: 10, background: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><polygon points="3,1 15,8 3,15" fill="#1a1c1c"/></svg>
                          </button>
                        ) : (
                          <button onClick={() => { setDoModalOpen(true); setModalDetailOpen(false); }} className="mt-2 font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: `${s.color}40`, color: "#fff", fontSize: "clamp(13px, 4vw, 18px)", border: "none", cursor: "pointer" }}>
                            Show me
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><path d="M15 6l6 6-6 6"/></svg>
                          </button>
                        )
                      }
                    </div>

                    {/* PLAYING STATE: fades in when playing */}
                    {isAudioAvailable && (
                      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: warmupPlaying ? contentOpacity : 0, transition: "opacity 0.35s", pointerEvents: warmupPlaying ? "auto" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => {
                              if (!warmupAudioRef.current) return;
                              const t = Math.max(0, warmupAudioRef.current.currentTime - 10);
                              warmupAudioRef.current.currentTime = t;
                              setWarmupCurrentTime(t); warmupCurrentTimeRef.current = t;
                            }}
                            style={{ background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 20, cursor: "pointer", padding: "5px 12px", fontSize: 13, fontWeight: 800, color: "#000", letterSpacing: "-0.02em" }}
                          >−10</button>
                          <button onClick={handleWarmupToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="37" height="37" viewBox="0 0 36 36" fill="none"><rect x="10" y="9" width="5" height="18" rx="2" fill="#000"/><rect x="21" y="9" width="5" height="18" rx="2" fill="#000"/></svg>
                          </button>
                          <button
                            onClick={() => {
                              if (!warmupAudioRef.current) return;
                              const t = Math.min(warmupDurationRef.current, warmupAudioRef.current.currentTime + 10);
                              warmupAudioRef.current.currentTime = t;
                              setWarmupCurrentTime(t); warmupCurrentTimeRef.current = t;
                            }}
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

              {/* Card 2: encouragement */}
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
                  <div
                    key="card2"
                    style={{ width: "100%", flexShrink: 0, borderRadius: 24, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", gap: 2, zIndex: doIdx === 1 ? 2 : 1, height: "calc(100vw - 40px)", overflow: "hidden", pointerEvents: doIdx === 1 ? "auto" : "none", touchAction: "none", opacity: doIdx >= 1 ? 1 : 0, transition: "opacity 0.3s" }}
                    onTouchStart={e => { handleDragStartY.current = e.touches[0].clientY; }}
                    onTouchEnd={e => { if (e.changedTouches[0].clientY - handleDragStartY.current > 20) goPrev(); }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2653d4", textAlign: "center" }}>
                      {dayLabel}
                    </p>
                    <p style={{ margin: 0, fontSize: "clamp(36px, 9vw, 48px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.1, textAlign: "center" }}>{title}</p>
                    <p style={{ margin: 0, fontSize: "clamp(15px, 3.8vw, 18px)", color: "#6b7480", lineHeight: 1.6, textAlign: "center" }}>{sub}</p>
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
                return (
                  <>
                    <svg viewBox="0 0 100 130" width="138" height="179" style={{ overflow: "visible" }}>
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

                    {/* + with subordinate − below-left */}
                    <div style={{ position: "relative", width: 52, height: 52 }}>
                      <button
                        onClick={() => {
                          const next = Math.min(MAX, logHydrationMl + 250);
                          setLogHydrationMl(next);
                          saveLogHydration(next);
                        }}
                        style={{ width: 52, height: 52, borderRadius: "50%", background: logHydrationMl >= MAX ? "#e8f0e8" : "#3b9eff", border: "none", cursor: logHydrationMl >= MAX ? "default" : "pointer", fontSize: "clamp(22px, 5.6vw, 27px)", fontWeight: 700, color: logHydrationMl >= MAX ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => {
                          const next = Math.max(0, logHydrationMl - 250);
                          setLogHydrationMl(next);
                          saveLogHydration(next);
                        }}
                        style={{ position: "absolute", top: "50%", left: -26, transform: "translateY(-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "1.5px solid #dde2e8", boxShadow: "0 1px 4px rgba(0,0,0,0.10)", cursor: logHydrationMl <= 0 ? "default" : "pointer", fontSize: "clamp(13px, 3.4vw, 16px)", fontWeight: 700, color: logHydrationMl <= 0 ? "#c8cdd3" : "#6b7480", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                      >
                        −
                      </button>
                    </div>
                    <p style={{ fontSize: "clamp(13px, 3.4vw, 16px)", fontWeight: 600, color: "#3b9eff", margin: 0 }}>
                      {logHydrationMl > 0
                        ? `${Math.round(logHydrationMl / 250)} glass${Math.round(logHydrationMl / 250) === 1 ? "" : "es"}`
                        : "0 glasses"}
                    </p>

                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Complete modal */}
        {doModalOpen && modalItem && (() => {
          const isComplete = completed.has(modalIdx);
          const detail = SCHEDULE_DETAILS[modalItem.title];
          const isMeal = detail?.type === 'meal';
          const isExercise = detail?.type === 'exercise';
          const isInfo = detail?.type === 'info';
          const isDrill = modalItem.isDrill && !!drillSteps;

          const closeModal = () => {
            setModalClosing(true);
            setSwipeX(0);
            setTimeout(() => {
              setDoModalOpen(false);
              setSchedModalIdx(null);
              setModalClosing(false);
            }, 320);
          };

          const handleDone = () => {
            // Update data immediately
            setCompleted(prev => {
              const n = new Set(prev);
              if (!isComplete) {
                n.add(modalIdx);
                doneAtRef.current.set(modalIdx, Date.now());
                if (modalItem.isDrill) {
                  try {
                    const entry = { ts: new Date().toISOString(), sessionType: ["Drills"], drillFocus: drillTag ? [drillTag] : [], duration: "6", intensity: "moderate" };
                    const prev2 = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]");
                    localStorage.setItem("padelop:training-logs", JSON.stringify([entry, ...prev2].slice(0, 50)));
                    window.dispatchEvent(new Event("storage"));
                  } catch {}
                  saveTrainingToDb({ date: new Date().toISOString().slice(0, 10), drill_focus: drillTag ?? undefined, duration_mins: 6 });
                }
              } else {
                n.delete(modalIdx);
              }
              return n;
            });
            try {
              const todayKey = new Date().toISOString().slice(0, 10);
              const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
              const titles = sd[todayKey] ?? [];
              sd[todayKey] = isComplete
                ? titles.filter(t => t !== modalItem.title)
                : [...titles.filter(t => t !== modalItem.title), modalItem.title];
              localStorage.setItem("padelop:schedule-done", JSON.stringify(sd));
              saveScheduleDoneToDb(todayKey, sd[todayKey]);
              try {
                const dat: Record<string, Record<string, number>> = JSON.parse(localStorage.getItem("padelop:done-at") || "{}");
                if (!dat[todayKey]) dat[todayKey] = {};
                if (isComplete) { delete dat[todayKey][modalItem.title]; } else { dat[todayKey][modalItem.title] = Date.now(); }
                localStorage.setItem("padelop:done-at", JSON.stringify(dat));
              } catch {}
              window.dispatchEvent(new Event("storage"));
            } catch {}
            // A: if marking complete, pause so circle shows green, then B: fade modal out
            if (!isComplete) {
              setTimeout(closeModal, 350);
            } else {
              closeModal();
            }
          };

          const renderSteps = (stepList: { step: string; cue: string; reps: string }[]) => (
            <div className="flex flex-col gap-3 mt-3">
              {stepList.map((s, i) => (
                <div key={i} className="flex flex-col items-start p-3">
                  <p className="text-[17px] font-semibold text-[#1a1c1c] leading-snug">{s.step}</p>
                  <p className="text-[14px] text-[#6b7480] mt-1 leading-snug">{s.cue}</p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#2653d420", color: "#2653d4" }}>{s.reps}</span>
                </div>
              ))}
            </div>
          );

          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={closeModal} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
              <style>{`@keyframes guideIn{from{transform:scale(0.94);opacity:0}to{transform:scale(1);opacity:1}}@keyframes guideOut{from{transform:scale(1);opacity:1}to{transform:scale(0.94);opacity:0}}`}</style>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: modalClosing ? "guideOut 0.2s cubic-bezier(0.4,0,1,1) both" : undefined }} />
              <div
                className="relative w-full bg-white flex flex-col"
                style={{ borderRadius: 28, maxHeight: "85dvh", animation: modalClosing ? "guideOut 0.2s cubic-bezier(0.4,0,1,1) both" : "guideIn 0.22s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)", overflow: "hidden" }}
                onClick={e => e.stopPropagation()}
              >
                {/* Detail content + inline complete button */}
                {(isMeal || isExercise || isDrill || isInfo) && (
                  <div className="overflow-y-auto flex-1 px-6 pb-6" style={{ minHeight: 0 }}>
                    <p className="font-bold" style={{ color: "#1a1c1c", fontSize: "clamp(22px, 6.5vw, 30px)", lineHeight: 1.15, margin: "20px 0 4px" }}>{modalItem.title}</p>
                    {isMeal && detail?.type === 'meal' && (
                      <div className="flex flex-col pt-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest pb-3" style={{ color: "#8a9096" }}>{detail.focus}</p>
                        {detail.options.map((meal, i) => (
                          <div key={i} className="flex flex-col p-3">
                            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3 }}>{meal.title}</p>
                            {meal.detail && <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6b7480", lineHeight: 1.45 }}>{meal.detail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(isInfo || isExercise || isDrill) && (
                      <div className="pt-4">
                        {isInfo && detail?.type === 'info' && (
                          <>
                            <p className="text-[11px] font-bold uppercase tracking-widest pb-3" style={{ color: "#1a1c1c" }}>{detail.focus}</p>
                            <p className="text-[17px] text-[#4a5050] leading-snug">{detail.text}</p>
                          </>
                        )}
                        {isExercise && detail?.type === 'exercise' && renderSteps(detail.steps)}
                        {isDrill && drillSteps && (
                          <>
                            <p className="text-[11px] font-bold uppercase tracking-widest pb-1 text-left" style={{ color: "#1a1c1c" }}>{(DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).focus}</p>
                            {renderSteps(drillSteps)}
                          </>
                        )}
                      </div>
                    )}
                    <div style={{ padding: "24px 0 4px" }}>
                      {isComplete ? (
                        <button
                          onClick={handleDone}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 56, borderRadius: 28, border: "2px solid #00D455", background: "transparent", cursor: "pointer" }}
                        >
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#00D455", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#00D455" }}>Done</span>
                        </button>
                      ) : (
                        <div
                          ref={swipeTrackRef}
                          style={{ position: "relative", height: 56, borderRadius: 28, background: "#f0f1f3", overflow: "hidden", touchAction: "none" }}
                          onTouchStart={e => { swipeStartX.current = e.touches[0].clientX - swipeX; }}
                          onTouchMove={e => {
                            const track = swipeTrackRef.current;
                            if (!track) return;
                            const maxX = track.offsetWidth - 56;
                            setSwipeX(Math.max(0, Math.min(maxX, e.touches[0].clientX - swipeStartX.current)));
                          }}
                          onTouchEnd={() => {
                            const track = swipeTrackRef.current;
                            if (!track) return;
                            const maxX = track.offsetWidth - 56;
                            if (swipeX >= maxX * 0.82) { handleDone(); }
                            setSwipeX(0);
                          }}
                        >
                          {/* Green fill */}
                          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: swipeX, background: "#00D455", transition: swipeX === 0 ? "width 0.3s" : "none" }} />
                          {/* Label */}
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#8a9096", opacity: Math.max(0, 1 - swipeX / 80), transition: "opacity 0.1s" }}>Swipe to complete</span>
                          </div>
                          {/* Thumb */}
                          <div style={{ position: "absolute", top: 4, left: 4 + swipeX, width: 48, height: 48, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: swipeX === 0 ? "left 0.3s" : "none", pointerEvents: "none" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M13 6l6 6-6 6"/></svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}


        {/* First-visit tooltip */}

        <LogSheet open={logSheetOpen} onClose={() => { setLogSheetOpen(false); setLogTab(null); setLogWizard(false); }} defaultSub={logTab} startWizard={logWizard} />
        <ReadinessSheet open={readinessSheetOpen} onClose={() => setReadinessSheetOpen(false)} onOpenLog={tab => { setLogTab(tab as Parameters<typeof setLogTab>[0]); setLogSheetOpen(true); }} onOpenLogScreen={() => setReadinessSheetOpen(false)} />
        <PushPrompt />

        {/* Post-match prompt */}
        {postMatchOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={() => setPostMatchOpen(false)} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
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
        {checkinNudgeOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={() => { try { localStorage.setItem("padelop:checkin-nudge-dismissed", new Date().toISOString().slice(0, 10)); } catch {} setCheckinNudgeOpen(false); }} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
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



        {/* Match info modal */}
        {/* Match info modal — bottom sheet */}
        {matchInfoOpen && match && (() => {
          const matchDate = new Date(match.date + "T12:00");
          const todayDate = new Date(today + "T12:00");
          const diffDays = Math.round((matchDate.getTime() - todayDate.getTime()) / 86400000);
          const countdownLabel = diffDays === 0 ? "TODAY" : diffDays === 1 ? "TOMORROW" : `IN ${diffDays} DAYS`;
          const dateStr = matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
          const playerStr = match.players && match.players.length > 0 ? match.players.map(p => p.slice(0, 2)).join(' · ') : null;
          const closeSheet = () => { setMatchInfoOpen(false); setMatchInfoMode(null); setMatchInfoAddTab(null); setMatchInfoTipsOpen(false); };
          const saveEdit = () => {
            if (!matchForm.date || !matchForm.time) return;
            const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, court: matchForm.court, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
            const current = getMatchList();
            const replaced = current.map(m => m.date === match?.date && m.time === match?.time ? data : m);
            const updated = current.some(m => m.date === match?.date && m.time === match?.time) ? replaced : [data, ...current];
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
            <div className="fixed inset-0 z-[200] flex items-start justify-center px-5" style={{ paddingTop: "10dvh", paddingBottom: "10dvh" }} onClick={closeSheet}>
              <style>{`@keyframes miScaleIn{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div
                className="relative w-full bg-white rounded-[28px] flex flex-col overflow-hidden"
                style={{ animation: "miScaleIn 0.2s cubic-bezier(0.22,1,0.36,1)", maxHeight: "80dvh" }}
                onClick={e => e.stopPropagation()}
              >
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

                  {/* MATCH INFO CARD */}
                  <div style={{ position: "relative", borderRadius: 24, overflow: "hidden" }}>
                    {/* All content on white */}
                    <div style={{ background: "#fff", padding: "28px 20px 28px", position: "relative" }}>
                      {/* Edit icon — left */}
                      <button
                        onClick={() => {
                          if (matchInfoMode === 'edit') { setMatchInfoMode(null); }
                          else { const fresh = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); const src = fresh ?? match; setMatchForm({ date: src.date ?? '', time: src.time ?? '', club: src.club ?? src.location ?? '', court: src.court ?? '', p1: src.player_1 ?? src.players?.[0] ?? '', p2: src.player_2 ?? src.players?.[1] ?? '', p3: src.player_3 ?? src.players?.[2] ?? '', p4: src.player_4 ?? src.players?.[3] ?? '' }); setMatchInfoMode('edit'); setMatchInfoAddTab(null); }
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
                            deleteUpcomingMatchFromDb(match.date, match.time ?? "");
                            const updated = getMatchList().filter(m => !(m.date === match.date && m.time === match.time));
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
                          <button onClick={saveAdd} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white" style={{ background: (!matchForm.date || !matchForm.time) ? "#c4c7c7" : "#2653d4" }}>Save match</button>
                        </div>
                      </div>
                    )}
                    </div>{/* end gradient section */}
                  </div>


                </div>{/* end flex column */}
                </div>{/* end scroll container */}
              </div>
            </div>
          );
        })()}

        {/* Match action sheet */}
        {matchActionOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "10dvh" }} onClick={() => { setMatchActionOpen(false); setMatchActionMode(null); }} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
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
              <button onClick={() => { setMatchActionOpen(false); setMatchActionMode(null); router.push("/matches"); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors">
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); setLiveX(0); setLiveY(0); setUploadError(null); setUploadExtracting(false); }} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
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


      </main>
    </>
  );
}
