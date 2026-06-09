"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LogSheet from "@/components/log-sheet";
import ReadinessSheet from "@/components/readiness-sheet";
import PushPrompt from "@/components/push-prompt";
import { computeScores, loadScoringData, computePillarStates, loadScoreHistory, type PillarStates, type DailyCheckIn, type HydrationEntry, type NutritionEntry, type TrainingEntry } from "@/lib/scoring";

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

const pad = (n: number) => String(n).padStart(2, "0");
const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

type DrillDef = { subtitle: string; court: string; solo: string };
const DRILL_LIBRARY: Record<string, DrillDef> = {
  "Serve":          { subtitle: "Serve consistency & placement",   court: "Hit 30 serves alternating cross-court and down-the-T. Focus on placement over power — 70% cross-court. Add spin variation in the final set.", solo: "Shadow your serve motion 20× each side. Practice the toss alone until it's consistent — contact point variability is the #1 cause of serve errors." },
  "Bandeja":        { subtitle: "Bandeja contact point & control", court: "Feed 20 bandejas from mid-court lobs. Focus on getting under the ball, closed racket face, and directing to back corners. Film your shoulder rotation.", solo: "Shadow the bandeja in slow motion — trophy position, shoulder turn, controlled wrist snap. 3 sets of 15 reps each side. Takes 10 minutes anywhere." },
  "Smash":          { subtitle: "Overhead timing & footwork",      court: "Alternate left/right overhead feeds, 30 reps. Prioritise feet set before contact. Work on vibora and k-smash variations once timing feels clean.", solo: "Jump and reach drill — 3 sets of 10. Time your jump so contact happens at maximum reach. Wall tosses help if you have space." },
  "Volleys":        { subtitle: "Compact volley technique",        court: "Stand 3m from the wall, volley continuously — 3 sets of 100. No backswing. Wrist locked, punch motion. Progress to alternating forehand/backhand.", solo: "Shadow volley drill — 3 sets of 20 each hand. Elbow up, racket face open, contact point in front. Can be done in any room." },
  "Defense":        { subtitle: "Defensive positioning & lobs",    court: "Partner smashes from net, you return high defensive lobs to back corners. Focus on reading the ball early and getting low before contact.", solo: "Lateral shuffle + split step — 5 sets of 30 seconds. Defensive positioning is 80% footwork. Quick direction change every 3 shuffles." },
  "Attack":         { subtitle: "Attacking patterns at net",       court: "Approach-and-finish patterns — feed to mid-court, move to net, volley to finish. Focus on angle and depth, not power.", solo: "Reaction time: drop a ball from shoulder height, catch before the second bounce. 3 sets of 15. Simulates quick hands at net." },
  "Positioning":    { subtitle: "Court coverage & positioning",    court: "Shadow movement without a ball — coach calls positions (net, mid, back) and you move to the T and recover. 5 sets of 90 seconds.", solo: "Eyes-closed visualisation — 5 min picturing court positions from your last match. Find 3 moments where better positioning changes the point." },
  "Communication":  { subtitle: "On-court communication habits",   court: "Call every ball in practice — 'mine', 'yours', 'leave'. Make it automatic under low pressure so it's instinct under high pressure.", solo: "Replay your last match mentally. Find 3 moments where a call or no-call cost a point. Rehearse what you would have said." },
  "Movement":       { subtitle: "Footwork & court coverage",       court: "Cone agility — 5 cones T-shape, 5 sets of lateral shuffle + sprint to net. Split step timing before every direction change.", solo: "Side-to-side shuffle + split step — 5 sets of 20 seconds. Any hallway works. Add a forward lunge at each end." },
  "Mental strength":{ subtitle: "Focus & pressure management",     court: "Pressure tiebreaks only — start every game at 6-6. Focus on your between-point routine: bounce, breathe, pick a target.", solo: "Box breathing + visualisation — 5 min. In 4, hold 4, out 4, hold 4. Then 3 min visualising winning points under pressure." },
};
const DEFAULT_DRILL: DrillDef = {
  subtitle: "General technical session",
  court: "General rally practice — focus on consistency over winners. Work on the shot you feel least confident about. 30 minutes of deliberate repetition beats 90 minutes of casual play.",
  solo: "20 min shadow footwork and stroke mechanics. Then 5 min visualising your strongest patterns and your next match.",
};

function getTopNeedsWorkTag(): string | null {
  try {
    const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
    const counts: Record<string, number> = {};
    for (const r of reviews) for (const tag of (r.improved ?? [])) counts[tag] = (counts[tag] ?? 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  } catch { return null; }
}

const ITEM_COLORS: Record<string, string> = {
  "Wake up & hydrate": "#0e7490", "Light breakfast": "#16a34a", "Breakfast": "#16a34a",
  "Morning mobility": "#64748b", "Light mobility": "#64748b",
  "Pre-game meal": "#16a34a", "Warmup & activation": "#d97706",
  "Match": "#2653d4", "Post-match cool down": "#64748b",
  "Recovery meal": "#16a34a", "Recovery walk": "#0e7490",
  "Foam roll & stretch": "#64748b", "Protein-rich lunch": "#16a34a",
  "Cold shower": "#0e7490", "Dinner": "#16a34a",
  "Early wind down": "#64748b", "Balanced lunch": "#16a34a",
  "Active recovery": "#0e7490", "Visualisation": "#64748b",
  "Wind down": "#64748b",
};

type ScheduleItem = { time: string; title: string; subtitle?: string; color: string; isDrill?: boolean };

function getScheduleData(dayType: "match" | "recovery" | "training", matchTime: string | null, drillTag: string | null): { schedule: ScheduleItem[]; currentIdx: number } {
  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 18;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "18:30";
  const drill = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
  const drillTitle = drillTag ? `${drillTag} Drill` : "Training Session";
  const rawSchedules: Record<string, Array<{ time: string; title: string; subtitle?: string; isDrill?: boolean }>> = {
    match: [
      { time: "07:00", title: "Wake up & hydrate",   subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",            subtitle: "Oats, eggs, fruit" },
      { time: "09:00", title: "Morning mobility",     subtitle: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Pre-game meal",       subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation", subtitle: "Dynamic drills, 30 min" },
      { time: mt,                    title: "Match",                subtitle: "Game time" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",       subtitle: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down", subtitle: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",  subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Light breakfast",     subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Recovery walk",       subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Foam roll & stretch", subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Protein-rich lunch",  subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower",         subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",              subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Early wind down",     subtitle: "Sleep is your best recovery tool tonight" },
    ],
    training: [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",          subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",     subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "11:00", title: drillTitle,           subtitle: drill.subtitle, isDrill: true },
      { time: "12:30", title: "Balanced lunch",     subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",    subtitle: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",             subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",      subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",          subtitle: "No screens, consistent bedtime" },
    ],
  };
  const schedule: ScheduleItem[] = rawSchedules[dayType].map(item => ({
    ...item,
    color: item.isDrill ? "#2653d4" : (ITEM_COLORS[item.title] ?? "#8a9096"),
  }));
  const curMins = new Date().getHours() * 60 + new Date().getMinutes();
  let idx = 0;
  if (curMins >= toMins(schedule[schedule.length - 1].time)) {
    idx = schedule.length - 1;
  } else {
    for (let i = 0; i < schedule.length - 1; i++) {
      if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { idx = i; break; }
    }
  }
  return { schedule, currentIdx: idx };
}

type DetailMeal     = { type: 'meal';     focus: string; options: [string, string, string] };
type DetailExercise = { type: 'exercise'; focus: string; steps: { step: string; cue: string; reps: string }[] };
type DetailInfo     = { type: 'info';     text: string };
type ScheduleDetail = DetailMeal | DetailExercise | DetailInfo;

const SCHEDULE_DETAILS: Record<string, ScheduleDetail> = {
  "Wake up & hydrate": { type: 'info', text: "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration." },
  "Breakfast": { type: 'meal', focus: "High protein · slow-release carbs", options: [
    "Scrambled eggs + oats with banana and almond butter",
    "Greek yogurt bowl with granola, mixed berries and honey",
    "Whole grain toast + 3-egg omelette with spinach and feta",
  ]},
  "Light breakfast": { type: 'meal', focus: "Light · easily digestible", options: [
    "2 poached eggs on sourdough with sliced avocado",
    "Greek yogurt with a small handful of granola and fruit",
    "Banana with almond butter and a boiled egg",
  ]},
  "Morning mobility": { type: 'exercise', focus: "Hip flexors · thoracic spine · ankles", steps: [
    { step: "Hip flexor lunge hold", cue: "Step into a deep lunge, front knee at 90°. Push hips gently forward and hold.", reps: "60 sec each side" },
    { step: "Thoracic rotation", cue: "Sit back on heels, hands behind head. Rotate your upper back slowly left and right.", reps: "10 reps each direction" },
    { step: "Ankle circles", cue: "Stand on one foot and draw slow controlled circles with your raised ankle.", reps: "10 each direction, each ankle" },
  ]},
  "Light mobility": { type: 'exercise', focus: "Joints · hip flexors · thoracic rotation", steps: [
    { step: "Cat-cow", cue: "On hands and knees, alternate arching and rounding your back. Breathe with each rep.", reps: "10 slow reps" },
    { step: "Hip flexor lunge hold", cue: "Low lunge — hold gently, no bouncing. Let the hip ease open.", reps: "45 sec each side" },
    { step: "Thoracic opener", cue: "Arms crossed on chest, rotate torso slowly side to side keeping hips still.", reps: "8 reps each direction" },
  ]},
  "Pre-game meal": { type: 'meal', focus: "Easily digestible · energy without heaviness", options: [
    "Grilled chicken breast + white rice + cucumber salad",
    "Pasta with light tomato sauce and lean mince",
    "Jacket potato + tuna + a small mixed salad",
  ]},
  "Warmup & activation": { type: 'exercise', focus: "Neuromuscular activation · movement prep", steps: [
    { step: "Leg swings", cue: "Hold a wall for balance. Swing each leg forward and back, then laterally. Stay controlled.", reps: "15 reps each direction, each leg" },
    { step: "Lateral shuffle", cue: "Stay low, weight on balls of feet. Shuffle 5 metres left and right. Explode off each plant.", reps: "3 sets of 10 metres" },
    { step: "Shadow groundstrokes", cue: "20 forehand + 20 backhand shadow swings, building from 60% to 80% intensity. Focus on footwork first.", reps: "20 each side" },
  ]},
  "Match": { type: 'info', text: "Match time. Focus on early rhythm — the first two games set the tone. Communicate constantly with your partner. Stay hydrated between sets." },
  "Post-match cool down": { type: 'exercise', focus: "Heart rate reduction · static stretching", steps: [
    { step: "Standing quad stretch", cue: "Hold your ankle behind you against your glute. Keep the knee pointing straight down.", reps: "45 sec each leg" },
    { step: "Seated hamstring stretch", cue: "Legs straight out in front, hinge from the hips and reach towards your feet.", reps: "45 sec" },
    { step: "Shoulder cross-body stretch", cue: "Pull one arm across your chest. Keep your shoulder pressed down away from your ear.", reps: "30 sec each side" },
  ]},
  "Recovery meal": { type: 'meal', focus: "Protein + carbs · 30-min window", options: [
    "Grilled salmon + sweet potato mash + wilted spinach",
    "Chicken stir-fry with rice noodles and broccoli",
    "Protein shake + banana + peanut butter on whole grain toast",
  ]},
  "Recovery walk": { type: 'info', text: "Walk at a pace where you can hold a full conversation. Low-intensity movement flushes metabolic waste from fatigued muscles without adding stress. 20 minutes is enough." },
  "Foam roll & stretch": { type: 'exercise', focus: "Quads · IT band · hip flexors · calves", steps: [
    { step: "IT band roll", cue: "Side-lying, roll slowly from hip to knee on the outer thigh. Pause and breathe on tight spots.", reps: "60–90 sec each leg" },
    { step: "Quad roll", cue: "Face down, forearms supporting you. Roll from hip to knee on the front of the thigh.", reps: "60 sec each leg" },
    { step: "Hip flexor lunge stretch", cue: "Low lunge, back knee down, slight backward lean. Feel the stretch in the front of the back hip.", reps: "60 sec each side" },
  ]},
  "Protein-rich lunch": { type: 'meal', focus: "30–40g protein · muscle repair", options: [
    "Grilled chicken breast + quinoa + roasted courgette and peppers",
    "Tuna nicoise salad with boiled eggs, green beans and olives",
    "Salmon fillet + brown rice + steamed broccoli with olive oil",
  ]},
  "Cold shower": { type: 'info', text: "Two minutes of cold water constricts blood vessels, reduces inflammation, and blunts delayed onset muscle soreness. Start warm, finish cold for the last 90–120 seconds." },
  "Dinner": { type: 'meal', focus: "Anti-inflammatory · high micronutrient", options: [
    "Baked salmon + roasted sweet potato + wilted spinach with garlic",
    "Grilled sea bass + brown rice + stir-fried kale and broccoli",
    "Chicken thighs + roasted Mediterranean veg + a small portion of couscous",
  ]},
  "Early wind down": { type: 'info', text: "Dim lights by 9pm and avoid screens. Sleep is the highest-impact recovery tool available — aim for 8 hours tonight. A consistent bedtime rhythm compounds over weeks." },
  "Balanced lunch": { type: 'meal', focus: "Variety · antioxidants · sustained energy", options: [
    "Buddha bowl: brown rice, roasted veg, chickpeas and tahini dressing",
    "Chicken wrap with avocado, spinach, cucumber and hummus",
    "Lentil soup with whole grain bread and a large side salad",
  ]},
  "Active recovery": { type: 'info', text: "Walk, swim, or cycle at a pace where you can hold a full conversation. Keep heart rate below 130 bpm. Light aerobic activity maintains cardiovascular fitness without accumulating fatigue." },
  "Visualisation": { type: 'exercise', focus: "Mental rehearsal · pattern reinforcement", steps: [
    { step: "Replay a key moment", cue: "Pick one point from your last match that you lost. Replay it slowly in your mind — what would you change?", reps: "2 min" },
    { step: "Strongest pattern", cue: "Visualise your best attacking sequence in full detail: footwork → position → shot → result. Make it vivid.", reps: "2 min" },
    { step: "Next session intent", cue: "Walk through your next session mentally and set one specific technical focus before you begin.", reps: "1 min" },
  ]},
  "Wind down": { type: 'info', text: "Blue light from screens suppresses melatonin by up to 50%. In the 60 minutes before bed: dim lights, avoid screens, and keep the room cool for deeper sleep." },
};

const S: React.CSSProperties = { fontFamily: "Inter, sans-serif", fontSize: 17, fontWeight: 400, color: "#111", lineHeight: 1.6 };

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

function getDayMsg(match: { date: string; time: string } | null, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
  if (match?.date === today) {
    const [mH, mM] = match.time.split(":").map(Number);
    const diffMins = mH * 60 + mM - now.getHours() * 60 - now.getMinutes();
    if (diffMins > 180) { const hrs = Math.floor(diffMins / 60); return `Match in ${hrs}h — hydrate and eat your pre-game meal ${hrs > 4 ? "a few hours before" : "soon"}.`; }
    if (diffMins > 60) return "Time to warm up. Sip water and focus.";
    if (diffMins > 0) return "Almost game time. Breathe and trust your prep.";
    return "Great match today. Stretch, eat protein, and rest up.";
  }
  if (match?.date === yesterday) return "Recovery day. Drink plenty of water and get your protein in.";
  return "Rest day. Hydrate, eat well, and take it easy.";
}

export default function Home8() {
  const router = useRouter();
  const [doModalOpen, setDoModalOpen] = useState(false);
  const [schedModalIdx, setSchedModalIdx] = useState<number | null>(null);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [readinessSheetOpen, setReadinessSheetOpen] = useState(false);
  const [logTab, setLogTab] = useState<"checkin" | "wellbeing" | "matchreview" | "hydration" | "nutrition" | "training" | null>(null);
  const [logWizard, setLogWizard] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchModalTab, setMatchModalTab] = useState<'pick' | 'manual'>('pick');
  const [matchForm, setMatchForm] = useState({ date: '', time: '', club: '', p1: '', p2: '', p3: '', p4: '' });
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pastReviews, setPastReviews] = useState<{ ts: string; result: string; opponentNames: string; wellDone: string[]; improved: string[] }[]>([]);
  const [matchActionOpen, setMatchActionOpen] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; players?: string[] } | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [now, setNow] = useState(new Date());
  const [doIdx, setDoIdx] = useState(0); // -1 = top holder, 0 = do-this-now, 1 = see schedule
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [readiness, setReadiness] = useState(65);
  const [readinessDone, setReadinessDone] = useState(0);
  const [readinessItems, setReadinessItems] = useState([false, false, false, false]);
  const [logPickerOpen, setLogPickerOpen] = useState(false);
  const [logPickerExpanded, setLogPickerExpanded] = useState<string | null>(null);
  const [logPickerSub, setLogPickerSub] = useState<"nutrition" | "matchreview" | null>(null);
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
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [drillContext, setDrillContext] = useState<"court" | "solo">("court");
  const [drillSteps, setDrillSteps] = useState<{ step: string; cue: string; reps: string }[] | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const [logHydrationMl, setLogHydrationMl] = useState(0);
  const logGaugeRef    = useRef<HTMLDivElement>(null);
  const logDragStartX  = useRef(0);
  const logDragStartMl = useRef(0);
  const LOG_GOAL_ML = 2500;
  const LOG_MAX_ML  = 3000;

  const [schedTriangleTop, setSchedTriangleTop] = useState<number | null>(null);

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

  const matchUploadRef = useRef<HTMLInputElement>(null);
  const schedScrollRef = useRef<HTMLDivElement>(null);
  const schedCurrentRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const doIdxRef = useRef(doIdx);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const hitTopYRef = useRef<number | null>(null); // Y when scroll first reached 0
  const handleDragStartY = useRef(0);
  const swipeDirRef = useRef<'h' | 'v' | null>(null);
  const [cardSnap, setCardSnap] = useState<'none' | 'left' | 'right'>('none');
  const [liveX, setLiveX] = useState(0);
  const [liveY, setLiveY] = useState(0);

  useEffect(() => {
    function loadReadiness() {
      const d = loadScoringData();
      setReadiness(computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training).overall);
      const ri = [!!d.checkIn, !!d.hydration, !!d.nutrition, !!d.training];
      setReadinessDone(ri.filter(Boolean).length);
      setReadinessItems(ri);
      setCheckInData(d.checkIn);
      setHydrationData(d.hydration);
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
        setLogHydrationMl(hq?.date === todayKey ? (hq.ml ?? 0) : 0);
      } catch { setLogHydrationMl(0); }
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
        if (!done && !nudgeDismissed && hour < 13) setTimeout(() => setCheckinNudgeOpen(true), 1200);
      } catch { setMorningDone(false); }
    }
    function loadMatch() {
      const todayD = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      try {
        const listRaw = localStorage.getItem("padelop:upcoming-matches");
        const list: StoredMatch[] = listRaw ? JSON.parse(listRaw) : [];
        const future = list.filter(m => m.date >= todayD).sort((a, b) => a.date.localeCompare(b.date));
        setUpcomingCount(future.length);
        if (future.length > 0 && future[0].date !== JSON.parse(localStorage.getItem("padelop:next-match") || "{}").date) {
          localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
        }
      } catch {}
      let wasYesterday = false;
      try {
        const raw = localStorage.getItem("padelop:next-match");
        if (raw) {
          const m = JSON.parse(raw);
          if (m.date && m.time) {
            // Match is today-or-future: check if it has already ended (today, past end time)
            const nowD = new Date();
            let matchEnded = m.date < todayD;
            if (!matchEnded && m.date === todayD && m.time) {
              const [mH, mM] = (m.time as string).split(":").map(Number);
              matchEnded = nowD.getHours() * 60 + nowD.getMinutes() >= mH * 60 + mM + 90;
            }
            if (!matchEnded) {
              setMatch({ date: m.date, time: m.time, club: m.club || undefined, players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean) });
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
    setDrillTag(getTopNeedsWorkTag());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => { clearInterval(id); window.removeEventListener("storage", handleStorage); };
  }, []);

  type StoredMatch = { date: string; time: string; club: string; player_1: string; player_2: string; player_3: string; player_4: string };

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
    setMealsToday(prev => [...prev, entry]);
    setMealText("");
  }

  function saveNote(text: string) {
    if (!text.trim()) return;
    const entry = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(), text: text.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:notes") || "[]");
      localStorage.setItem("padelop:notes", JSON.stringify([entry, ...existing].slice(0, 200)));
    } catch {}
    setNoteText("");
  }

  function nowTimeStr() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  }

  function saveLogHydration(ml: number) {
    const todayKey = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayKey, ml })); } catch {}
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

  useEffect(() => { setCardSnap('none'); setLiveX(0); }, [doIdx]);
  useEffect(() => { doIdxRef.current = doIdx; }, [doIdx]);

  // Overscroll-to-navigate on the schedule scroll div.
  // Tracks direction per-frame so we only intercept when the user is at the
  // top AND actively moving downward — never interferes with normal scrolling.
  useEffect(() => {
    const div = schedScrollRef.current;
    if (!div) return;
    let prevY = 0;
    let prevT = 0;
    let vel = 0; // px/ms, positive = finger moving downward

    const onStart = (e: TouchEvent) => {
      prevY = e.touches[0].clientY;
      prevT = e.timeStamp;
      vel = 0;
      hitTopYRef.current = null;
    };

    const onMove = (e: TouchEvent) => {
      if (doIdxRef.current < 1) return;
      const y = e.touches[0].clientY;
      const t = e.timeStamp;
      const dt = t - prevT;
      if (dt > 0) vel = (y - prevY) / dt;
      const movingDown = y > prevY;
      prevY = y;
      prevT = t;
      lastTouchYRef.current = y;
      if (div.scrollTop === 0 && movingDown) {
        if (hitTopYRef.current === null) hitTopYRef.current = y;
        e.preventDefault(); // block rubber-band / touchcancel
      }
    };

    const trigger = (endY: number, isCancel = false) => {
      const atTop = hitTopYRef.current !== null;
      const dist  = atTop ? endY - hitTopYRef.current! : 0;
      // primary path: user was at scrollTop=0 and dragged or flicked downward
      if (atTop && (dist > 30 || vel > 0.3))
        setDoIdx(i => Math.max(i - 1, -1));
      // cancel path: iOS claimed the gesture for rubber-band before our handler
      // could set hitTopYRef, but scrollTop===0 and downward vel confirm intent
      else if (isCancel && div.scrollTop === 0 && vel > 0.2)
        setDoIdx(i => Math.max(i - 1, -1));
      hitTopYRef.current = null;
      vel = 0;
    };

    const onEnd    = (e: TouchEvent) => { if (doIdxRef.current >= 1) trigger(e.changedTouches[0].clientY); };
    const onCancel = ()              => { if (doIdxRef.current >= 1) trigger(lastTouchYRef.current, true); };

    div.addEventListener('touchstart',  onStart,   { passive: true });
    div.addEventListener('touchmove',   onMove,    { passive: false });
    div.addEventListener('touchend',    onEnd,     { passive: true });
    div.addEventListener('touchcancel', onCancel,  { passive: true });
    return () => {
      div.removeEventListener('touchstart',  onStart);
      div.removeEventListener('touchmove',   onMove);
      div.removeEventListener('touchend',    onEnd);
      div.removeEventListener('touchcancel', onCancel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (doIdx !== 1) return;
    const container = schedScrollRef.current;
    const current = schedCurrentRef.current;
    if (!container || !current) return;
    const top = current.offsetTop - container.clientHeight / 2 + current.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [doIdx]);

  // Track current schedule item's screen Y for the fixed triangle indicator
  useEffect(() => {
    if (doIdx !== 1) { setSchedTriangleTop(null); return; }
    const update = () => {
      const el = schedCurrentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSchedTriangleTop(rect.top + rect.height / 2);
    };
    update();
    const scroller = schedScrollRef.current;
    scroller?.addEventListener("scroll", update, { passive: true });
    return () => scroller?.removeEventListener("scroll", update);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doIdx]);

  useEffect(() => {
    const item = schedule[schedModalIdx ?? currentIdx];
    if (!doModalOpen || !item?.isDrill) { setDrillSteps(null); return; }
    let cancelled = false;
    setDrillSteps(null);
    setDrillLoading(true);
    fetch("/api/exercise-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: item.title, tag: drillTag, context: drillContext, subtitle: item.subtitle }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled && data.steps) setDrillSteps(data.steps); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDrillLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doModalOpen, drillContext, schedModalIdx]);

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
    if (!matchModalOpen) return;
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

  const today = new Date().toISOString().slice(0, 10);
  const dayType: "match" | "recovery" | "training" = match?.date === today ? "match" : yesterdayWasMatch ? "recovery" : "training";
  const { schedule, currentIdx } = getScheduleData(dayType, match?.time ?? null, drillTag);
  const doItem = schedule[currentIdx];
  const modalIdx = schedModalIdx ?? currentIdx;
  const modalItem = schedule[modalIdx] ?? doItem;
  const curMins = now.getHours() * 60 + now.getMinutes();

  const goNext = () => setDoIdx(i => Math.min(i + 1, 1));
  const goPrev = () => setDoIdx(i => Math.max(i - 1, -1));

  return (
    <>
      {/* Fixed triangle — outside all overflow constraints, tracks current schedule item */}
      {schedTriangleTop !== null && (
        <div style={{
          position: "fixed", left: 3, top: schedTriangleTop, transform: "translateY(-50%)",
          zIndex: 200, pointerEvents: "none",
          width: 0, height: 0,
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderLeft: `8px solid ${schedule[currentIdx]?.color ?? "#000"}`,
        }} />
      )}
      <main style={{ ...S, position: "fixed", inset: 0, paddingTop: "4rem", paddingLeft: 10, paddingRight: 10, paddingBottom: 0, overflow: "hidden", background: "#ffffff", zIndex: 60 }}>

        {/* Horizontal strip: [readiness | carousel | log] */}
        <div
          ref={outerRef}
          style={{
            display: "flex", width: "300%", marginLeft: "-100%",
            height: "calc(100dvh - 4rem)", touchAction: doIdx >= 1 ? "pan-y" : "manipulation",
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
            if (doIdx >= 1) return; // scroll div's native listeners own goPrev logic
            const dx = e.touches[0].clientX - touchStartXRef.current;
            const dy = e.touches[0].clientY - touchStartYRef.current;
            if (!swipeDirRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
              swipeDirRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (swipeDirRef.current === 'h' && doIdx === 0) setLiveX(dx);
            if (swipeDirRef.current === 'v' && cardSnap === 'none' && doIdx < 1) setLiveY(dy);
          }}
          onTouchEnd={e => {
            const endY = e.changedTouches[0].clientY;
            const dx = e.changedTouches[0].clientX - touchStartXRef.current;
            if (doIdx >= 1) { swipeDirRef.current = null; return; } // scroll div handles goPrev
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
              if (dy < -40 && doIdx < 1) goNext();
              else if (dy > 40) goPrev();
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10, transform: `translateX(${cardSnap === 'right' ? 50 : 0}px) translateY(calc(45dvh - 4rem - 3 * (100vw - 40px) / 2 - 10px))`, transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
              {/* Placeholder above */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "white", opacity: 0 }} />
              {/* Main card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", background: "white", borderRadius: 24, marginRight: cardSnap === 'right' ? 0 : -40, opacity: cardSnap === 'right' ? 1 : 0, transition: "margin 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={() => setLogPickerOpen(true)}
                  style={{ padding: "14px 28px", borderRadius: 999, background: "#2653d4", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#fff" }}
                >
                  Log +
                </button>
              </div>
              {/* Placeholder below */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "white", opacity: 0 }} />
            </div>
          </div>

          {/* Carousel center — all schedule cards, doIdx in transform */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingLeft: 10, paddingRight: 10, position: "relative", zIndex: 2 }}>
            <div style={{
              display: "flex", flexDirection: "column", gap: 10,
              transform: doIdx >= 1
                ? `translateY(calc(84px + 4rem - 2 * (100vw - 30px) - 95dvh))`
                : doIdx === -1
                  ? `translateY(calc(10px - (100vw - 30px) + ${liveY}px))`
                  : `translateY(calc(-50dvh - 150vw + 100px + ${liveY}px))`,
              transition: liveY !== 0 ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}>
              {/* Logo above top card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.12 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 72, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1c1c", display: "flex", alignItems: "flex-end", gap: 1 }}>
                  {["p","a","d","l","a"].map((ch, i) => (
                    <span key={i} style={{ display: "inline-block", transform: `translateY(${(5 - i) * 1.5}px)` }}>{ch}</span>
                  ))}
                  <span style={{ display: "inline-block", width: "0.45em", height: "0.45em", borderRadius: "50%", background: "#22c55e", marginLeft: 4, marginBottom: 10 }} />
                </span>
              </div>

              {/* Card 0: next match */}
              {(() => {
                const today = now.toISOString().slice(0, 10);
                const vals = Object.values(pillarStates);
                const allNL = vals.every(v => v.status === 'not_logged');
                const hasLow = vals.some(v => v.status === 'low');
                const hasOk  = vals.some(v => v.status === 'ok');
                const readinessLabel = allNL ? null : hasLow ? 'LOW READINESS' : hasOk ? 'OK READINESS' : 'GOOD READINESS';
                const readinessColor = hasLow ? '#dc2626' : hasOk ? '#d97706' : '#16a34a';
                const coachTip = hasLow ? 'Focus on recovery today.' : hasOk ? 'Keep your habits consistent today.' : allNL ? 'Log your check-ins to track readiness.' : 'You\'re in great shape. Stay sharp.';

                return (
                  <div style={{ width: "100%", flexShrink: 0, height: "calc(95dvh - 4rem - 60px)", borderRadius: 24, background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", opacity: cardSnap === 'none' && doIdx === -1 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)", zIndex: doIdx === -1 ? 2 : 1, pointerEvents: doIdx === -1 ? "auto" : "none" }}>
                    {match ? (() => {
                      const matchDate = new Date(match.date + "T12:00");
                      const todayDate = new Date(today + "T12:00");
                      const diffDays = Math.round((matchDate.getTime() - todayDate.getTime()) / 86400000);
                      const countdownLabel = diffDays === 0 ? "TODAY" : diffDays === 1 ? "TOMORROW" : `IN ${diffDays} DAYS`;
                      const dateStr = matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                      const playerStr = match.players && match.players.length > 0
                        ? `with ${match.players.join(', ')}`
                        : null;

                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                          {/* Single muted header */}
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b0b8c1", margin: "0 0 20px" }}>
                            Next Match · {countdownLabel}
                            {upcomingCount > 1 && <span style={{ marginLeft: 6, fontWeight: 600, color: "#c8ccd0" }}>+{upcomingCount - 1} more</span>}
                          </p>

                          {/* Hero date */}
                          <button onClick={() => setMatchActionOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <p style={{ fontSize: "clamp(34px, 9vw, 44px)", fontWeight: 800, color: "#1a1c1c", margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>{dateStr}</p>
                            <p style={{ fontSize: "clamp(26px, 7vw, 34px)", fontWeight: 700, color: "#2653d4", margin: 0, lineHeight: 1 }}>{match.time}</p>
                            {match.club && <p style={{ fontSize: 17, fontWeight: 500, color: "#6b7480", margin: "4px 0 0" }}>{match.club}</p>}
                            {playerStr && <p style={{ fontSize: 13, color: "#b0b8c1", margin: "3px 0 0", textAlign: "center", lineHeight: 1.4 }}>{playerStr}</p>}
                          </button>

                          {/* Divider */}
                          <div style={{ width: 48, height: 1, background: "#e8eaed", margin: "24px 0" }} />

                          {/* Readiness */}
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b0b8c1", margin: "0 0 6px" }}>Readiness</p>
                          <button onClick={() => setReadinessSheetOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            <span style={{ fontSize: 32, fontWeight: 800, color: "#1a1c1c", lineHeight: 1, letterSpacing: "-0.02em" }}>
                              {readinessDone}<span style={{ color: "#dde0e4" }}>/4</span>
                            </span>
                          </button>
                        </div>
                      );
                    })() : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b0b8c1", margin: 0 }}>Next Match</p>
                        <p style={{ fontSize: 20, fontWeight: 500, color: "#c0c7d0", margin: 0 }}>No match scheduled</p>
                        <button onClick={() => { setIsAddMode(true); setMatchForm({ date: '', time: '', club: '', p1: '', p2: '', p3: '', p4: '' }); setMatchModalTab('manual'); setMatchModalOpen(true); }} style={{ fontSize: 15, fontWeight: 600, color: "#2653d4", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add a match</button>
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
                const fmtTime = (s: number) => { if (s <= 0) return "a moment"; const h = Math.floor(s / 3600), rem = s % 3600, m = Math.floor(rem / 60), sec = rem % 60; if (h > 0) return `${h}h ${m}m ${sec}s`; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };
                const cardStyle: React.CSSProperties = { width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: "50%", overflow: "hidden", background: "#00D455", border: "6px solid #00D455", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", opacity: 1, zIndex: 3, boxShadow: "none" };
                const contentOpacity = doIdx === 0 ? 1 : 0.2;

                if (isDone) return (
                  <div key="active" className="animate-bounce-in" style={cardStyle} onClick={() => setDoModalOpen(true)}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: contentOpacity, transition: "opacity 0.25s" }}>
                      <p className="font-bold leading-none text-center" style={{ color: "#fff", fontSize: "clamp(26px, 8vw, 36px)" }}>Good Job!</p>
                      <p className="font-semibold mt-1 leading-none text-center" style={{ color: "#fff", fontSize: "clamp(15px, 4.8vw, 22px)" }}>{s.title} complete</p>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mt-3" style={{ background: "rgba(255,255,255,0.25)" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      {nextSlide && <div className="mt-4 text-center">
                        <p className="leading-none" style={{ color: "rgba(255,255,255,0.75)", fontSize: "clamp(12px, 3.7vw, 16px)" }}>see you in</p>
                        <p className="font-bold leading-none mt-1" style={{ color: "#fff", fontSize: "clamp(22px, 7vw, 32px)" }}>{fmtTime(secsUntilNext)}</p>
                        <p className="leading-none mt-1" style={{ color: "rgba(255,255,255,0.75)", fontSize: "clamp(12px, 3.7vw, 16px)" }}>for: <span className="font-semibold" style={{ color: "#fff" }}>{nextSlide.title}</span></p>
                      </div>}
                    </div>
                  </div>
                );
                return (
                  <div key="active" className="animate-bounce-in" style={cardStyle} onClick={() => setDoModalOpen(true)}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: contentOpacity, transition: "opacity 0.25s" }}>
                      <p className="text-[14px] tracking-wide leading-none" style={{ color: "#000", fontWeight: 600 }}>Now</p>
                      <p className="font-bold leading-tight text-center" style={{ color: "#000", fontSize: "clamp(24px, 7.5vw, 34px)" }}>{s.title}</p>
                      {s.subtitle && <p className="leading-none text-center mt-0.5" style={{ color: "#000", fontSize: "clamp(15px, 4.8vw, 22px)", fontWeight: 500 }}>{s.subtitle.split(", ").join(" · ")}</p>}
                      <button onClick={e => { e.stopPropagation(); setDoModalOpen(true); }} className="mt-3 font-semibold px-5 py-2 rounded-full flex items-center gap-1" style={{ background: "#fff", color: isReady ? s.color : "#b0b5ba", fontSize: "clamp(13px, 4vw, 18px)" }}>Guide me <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                      {dayType === "match" && match && (() => { const [mH, mM] = match.time.split(":").map(Number); return now.getHours() * 60 + now.getMinutes() >= mH * 60 + mM - 60; })() && (
                        <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 12, width: "100%" }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (!warmupAudioRef.current) {
                                const a = new Audio("/warmup.mp3");
                                warmupAudioRef.current = a;
                                a.onended = () => {
                                  setWarmupPlaying(false);
                                  setWarmupCurrentTime(0);
                                  if (warmupRafRef.current) cancelAnimationFrame(warmupRafRef.current);
                                  const canvas = warmupVizRef.current;
                                  if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
                                };
                                a.ontimeupdate = () => { setWarmupCurrentTime(a.currentTime); warmupCurrentTimeRef.current = a.currentTime; };
                                a.onloadedmetadata = () => { setWarmupDuration(a.duration); warmupDurationRef.current = a.duration; };
                              }
                              if (warmupPlaying) {
                                warmupAudioRef.current.pause();
                                setWarmupPlaying(false);
                                if (warmupRafRef.current) cancelAnimationFrame(warmupRafRef.current);
                              } else {
                                // Wire up Web Audio API on first play (requires user gesture)
                                if (!warmupAudioCtxRef.current) {
                                  const ctx = new AudioContext();
                                  warmupAudioCtxRef.current = ctx;
                                  const analyser = ctx.createAnalyser();
                                  analyser.fftSize = 64;
                                  analyser.smoothingTimeConstant = 0.8;
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
                                // Start visualizer loop
                                const draw = () => {
                                  const canvas = warmupVizRef.current;
                                  const analyser = warmupAnalyserRef.current;
                                  if (!canvas || !analyser) {
                                    warmupRafRef.current = requestAnimationFrame(draw);
                                    return;
                                  }
                                  const ctx2d = canvas.getContext("2d");
                                  if (!ctx2d) { warmupRafRef.current = requestAnimationFrame(draw); return; }
                                  const bins = analyser.frequencyBinCount;
                                  const data = new Uint8Array(bins);
                                  analyser.getByteFrequencyData(data);
                                  const W = canvas.width, H = canvas.height;
                                  const centerY = H / 2;
                                  ctx2d.clearRect(0, 0, W, H);
                                  // Sample raw values then sort highest→center, lowest→edges
                                  const count = 28;
                                  const gap = 2;
                                  const barW = (W - gap * (count - 1)) / count;
                                  const raw: number[] = [];
                                  for (let i = 0; i < count; i++) raw.push(data[Math.floor(i * bins / count)] / 255);
                                  raw.sort((a, b) => b - a); // descending
                                  const vals = new Array(count).fill(0);
                                  for (let i = 0; i < count; i++) {
                                    const offset = Math.floor(i / 2);
                                    if (i % 2 === 0) vals[Math.floor(count / 2) + offset] = raw[i];
                                    else vals[Math.floor(count / 2) - 1 - offset] = raw[i];
                                  }
                                  for (let i = 0; i < count; i++) {
                                    const v = vals[i];
                                    const halfH = Math.max(1, v * centerY);
                                    ctx2d.fillStyle = `rgba(0,0,0,${0.25 + v * 0.75})`;
                                    ctx2d.fillRect(i * (barW + gap), centerY - halfH, barW, halfH * 2);
                                  }
                                  // Center track line
                                  ctx2d.fillStyle = "rgba(0,0,0,0.12)";
                                  ctx2d.fillRect(0, centerY - 0.5, W, 1);
                                  // Progress dot on center line
                                  const dur = warmupDurationRef.current;
                                  const cur = warmupCurrentTimeRef.current;
                                  const pct = dur > 0 ? cur / dur : 0;
                                  const dotX = pct * W;
                                  ctx2d.beginPath();
                                  ctx2d.arc(dotX, centerY, 4, 0, Math.PI * 2);
                                  ctx2d.fillStyle = "rgba(0,0,0,0.85)";
                                  ctx2d.fill();
                                  warmupRafRef.current = requestAnimationFrame(draw);
                                };
                                draw();
                              }
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {warmupPlaying
                              ? <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="10" y="9" width="5" height="18" rx="2" fill="#000"/><rect x="21" y="9" width="5" height="18" rx="2" fill="#000"/></svg>
                              : <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><polygon points="12,8 30,18 12,28" fill="#000"/></svg>
                            }
                          </button>
                          {warmupStarted && (
                            <div style={{ width: "80%", marginTop: 8 }}>
                              <canvas
                                ref={warmupVizRef}
                                width={240}
                                height={56}
                                style={{ width: "100%", height: 56, borderRadius: 6, display: "block" }}
                              />
                              <div style={{ position: "relative", height: 16 }}>
                                <span style={{ position: "absolute", right: 0, top: 2, fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>
                                  {warmupDuration > 0 ? `${Math.floor(warmupDuration / 60)}:${String(Math.round(warmupDuration % 60)).padStart(2, "0")}` : "--:--"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Card 2: today's schedule */}
              {(() => {
                return (
                  <div key="sched" style={{ width: "100%", flexShrink: 0, borderRadius: 24, background: "white", display: "flex", flexDirection: "column", opacity: cardSnap === 'none' && doIdx === 1 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)", zIndex: doIdx === 1 ? 2 : 1, height: "calc(100dvh - 4rem - 44px)", overflow: "hidden", pointerEvents: doIdx === 1 ? "auto" : "none" }}>
                    {/* Entire header is the drag zone — easy to swipe down back to hero */}
                    <div
                      style={{ flexShrink: 0, touchAction: "none", cursor: "grab", userSelect: "none" }}
                      onTouchStart={e => { handleDragStartY.current = e.touches[0].clientY; }}
                      onTouchEnd={e => { if (e.changedTouches[0].clientY - handleDragStartY.current > 20) goPrev(); }}
                    >
                      <div style={{ padding: "14px 0 10px", display: "flex", justifyContent: "center" }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d0d3d6" }} />
                      </div>
                      <div style={{ padding: "0 20px 16px", textAlign: "center" }}>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1c1c", margin: "0 0 4px" }}>Today&apos;s Schedule</p>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 99,
                          background: dayType === "match" ? "#2653d418" : dayType === "recovery" ? "#7c3aed18" : "#16a34a18",
                          color: dayType === "match" ? "#2653d4" : dayType === "recovery" ? "#7c3aed" : "#16a34a",
                        }}>
                          {dayType === "match" ? "Match Day" : dayType === "recovery" ? "Recovery Day" : "Training Day"}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 1, background: "#dfe3e7", flexShrink: 0 }} />
                    <div ref={schedScrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, overscrollBehavior: "none" }}>
                      <div style={{ padding: "16px 2px 28px 2px" }}>
                        {/* ── Today4-style schedule list ── */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                          {schedule.map((s4, i) => {
                            const isCur4 = i === currentIdx;
                            const isPast4 = !isCur4 && now.getHours() * 60 + now.getMinutes() > toMins(s4.time);
                            const detail4 = SCHEDULE_DETAILS[s4.title];
                            return (
                              <div
                                key={i}
                                ref={isCur4 ? schedCurrentRef : undefined}
                                style={{
                                  position: "relative",
                                  display: "flex", alignItems: "center", gap: 12,
                                  background: "#fff", borderRadius: 14,
                                  padding: "10px 10px 10px 14px",
                                  cursor: detail4 ? "pointer" : "default",
                                  ...(isCur4
                                    ? { boxShadow: `0 0 0 1.5px ${s4.color}` }
                                    : { border: "1px solid #f0f0f0" }),
                                }}
                                onClick={() => detail4 && (() => { setSchedModalIdx(i); setDoModalOpen(true); })()}
                              >
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isPast4 ? "#f0f0f0" : `${s4.color}18` }}>
                                    {isCur4
                                      ? <div className="animate-breathe" style={{ width: 12, height: 12, borderRadius: "50%", background: s4.color, ["--glow" as string]: s4.color } as React.CSSProperties} />
                                      : <div style={{ width: 12, height: 12, borderRadius: "50%", background: isPast4 ? "#d0d3d6" : s4.color }} />
                                    }
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color: isPast4 ? "#c4c7c7" : s4.color }}>{s4.time}</p>
                                    <p style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.25, color: isPast4 ? "#a0a5aa" : "#1a1c1c" }}>{s4.title}</p>
                                    {s4.subtitle && <p style={{ fontSize: 13, margin: "2px 0 0", color: isPast4 ? "#c4c7c7" : "#6b7480" }}>{s4.subtitle}</p>}
                                  </div>
                                  {detail4 && (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                      <path d="M9 18l6-6-6-6"/>
                                    </svg>
                                  )}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Profile panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingLeft: 40, paddingTop: "calc(45dvh - 4rem - (100vw - 40px) / 2)" }}>
            <div style={{ width: "100%", height: "calc(100vw - 40px)", background: "white", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 12px", marginLeft: cardSnap === 'left' ? 0 : -40, opacity: cardSnap === 'left' ? 1 : 0, transform: `translateX(${cardSnap === 'left' ? -50 : 0}px)`, transition: "margin 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
              {/* Hydration teardrop meter */}
              {(() => {
                const MAX = 3000;
                const pct = Math.min(1, logHydrationMl / MAX);
                // teardrop viewBox 100 × 130, drop path fills from y=130 up
                const innerH = 118; // usable vertical fill space inside the drop
                const fillH  = pct * innerH;
                const waterY = 130 - fillH; // top of water rect
                const waveAmp = logHydrationMl > 0 ? 3 : 0;
                const labelMl = logHydrationMl >= 1000
                  ? `${+(logHydrationMl / 1000).toFixed(1)}L`
                  : `${logHydrationMl}ml`;
                return (
                  <>
                    <svg viewBox="0 0 100 130" width="138" height="179" style={{ overflow: "visible" }}>
                      <defs>
                        <clipPath id="drop-clip-r">
                          {/* teardrop: pointed top, circular bottom */}
                          <path d="M50 4 C72 22 94 58 94 84 A44 44 0 0 1 6 84 C6 58 28 22 50 4 Z"/>
                        </clipPath>
                      </defs>

                      {/* Background (empty) */}
                      <path d="M50 4 C72 22 94 58 94 84 A44 44 0 0 1 6 84 C6 58 28 22 50 4 Z"
                        fill="#dce8f8"/>

                      {/* Water fill clipped to teardrop */}
                      <g clipPath="url(#drop-clip-r)">
                        {/* Solid fill below wave */}
                        <rect x="-10" y={waterY + waveAmp} width="120" height={fillH + 10} fill="#3b9eff" opacity="0.85"/>
                        {/* Animated wave at water surface */}
                        {logHydrationMl > 0 && (
                          <g style={{ animation: "water-wave 5s linear infinite", willChange: "transform", transformBox: "fill-box" }}>
                            <path
                              d={`M0 ${waterY} Q25 ${waterY - waveAmp} 50 ${waterY} Q75 ${waterY + waveAmp} 100 ${waterY} Q125 ${waterY - waveAmp} 150 ${waterY} Q175 ${waterY + waveAmp} 200 ${waterY} L200 130 L0 130 Z`}
                              fill="#3b9eff" opacity="0.85"
                            />
                          </g>
                        )}
                      </g>

                      {/* Amount label inside drop */}
                      <text x="50" y="88" textAnchor="middle" fontSize="19" fontWeight="800"
                        fill={pct > 0.45 ? "#fff" : "#5b8fcc"} fontFamily="inherit">
                        {labelMl}
                      </text>
                    </svg>

                    {/* + / − buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        onClick={() => {
                          const next = Math.min(MAX, logHydrationMl + 250);
                          setLogHydrationMl(next);
                          saveLogHydration(next);
                        }}
                        style={{ width: 55, height: 55, borderRadius: "50%", background: logHydrationMl >= MAX ? "#e8f0e8" : "#3b9eff", border: "none", cursor: logHydrationMl >= MAX ? "default" : "pointer", fontSize: 27, fontWeight: 700, color: logHydrationMl >= MAX ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => {
                          const next = Math.max(0, logHydrationMl - 250);
                          setLogHydrationMl(next);
                          saveLogHydration(next);
                        }}
                        style={{ width: 55, height: 55, borderRadius: "50%", background: "#f0f2f5", border: "none", cursor: logHydrationMl <= 0 ? "default" : "pointer", fontSize: 27, fontWeight: 700, color: logHydrationMl <= 0 ? "#c8cdd3" : "#1a1c1c", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        −
                      </button>
                    </div>

                    {/* 3L goal label */}
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7480", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                      {logHydrationMl >= MAX ? "Goal reached 🎉" : `Goal: 3L`}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Complete modal */}
        {doModalOpen && modalItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => { setDoModalOpen(false); setSchedModalIdx(null); }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden max-h-[88vh] overflow-y-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-5 pb-4" style={{ background: `${modalItem.color}18` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: modalItem.color }} />
                  <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: modalItem.color }}>Today&apos;s Schedule</p>
                </div>
                <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{modalItem.title}</h3>
                {modalItem.subtitle && <p className="text-[15px] text-[#6b7480] mt-0.5">{modalItem.subtitle}</p>}
              </div>
              {modalItem.isDrill ? (
                <div className="px-6 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a9096] mb-3">Where are you today?</p>
                  <div className="flex gap-2 mb-5">
                    <button onClick={() => setDrillContext("court")} className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors" style={{ background: drillContext === "court" ? "#2653d4" : "#f4f4f6", color: drillContext === "court" ? "#fff" : "#4a5050" }}>Court</button>
                    <button onClick={() => setDrillContext("solo")} className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors" style={{ background: drillContext === "solo" ? "#2653d4" : "#f4f4f6", color: drillContext === "solo" ? "#fff" : "#4a5050" }}>Anywhere</button>
                  </div>
                  {drillLoading ? (
                    <div className="flex flex-col gap-4">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex items-start gap-3 animate-pulse">
                          <div className="w-6 h-6 rounded-full bg-[#f0f2f5] flex-shrink-0"/>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 bg-[#f0f2f5] rounded w-3/4"/>
                            <div className="h-3 bg-[#f0f2f5] rounded w-full"/>
                            <div className="h-3 bg-[#f0f2f5] rounded w-1/2"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : drillSteps ? (
                    <div className="flex flex-col gap-4">
                      {drillSteps.map((s, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${modalItem.color}18` }}>
                            <span className="text-[11px] font-bold" style={{ color: modalItem.color }}>{i + 1}</span>
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#1a1c1c]">{s.step}</p>
                            <p className="text-[13px] text-[#6b7480] mt-0.5 leading-snug">{s.cue}</p>
                            <p className="text-[12px] font-semibold mt-1" style={{ color: modalItem.color }}>{s.reps}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (() => {
                const detail = SCHEDULE_DETAILS[modalItem.title];
                if (!detail) return null;
                if (detail.type === 'meal') return (
                  <div className="px-6 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a9096] mb-4">{detail.focus}</p>
                    <div className="flex flex-col gap-3">
                      {detail.options.map((meal, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: modalItem.color }}/>
                          <p className="text-[15px] text-[#2c3235] leading-snug">{meal}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                if (detail.type === 'exercise') return (
                  <div className="px-6 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a9096] mb-4">{detail.focus}</p>
                    <div className="flex flex-col gap-4">
                      {detail.steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${modalItem.color}18` }}>
                            <span className="text-[11px] font-bold" style={{ color: modalItem.color }}>{i + 1}</span>
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#1a1c1c]">{s.step}</p>
                            <p className="text-[13px] text-[#6b7480] mt-0.5 leading-snug">{s.cue}</p>
                            <p className="text-[12px] font-semibold mt-1" style={{ color: modalItem.color }}>{s.reps}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                return (
                  <div className="px-6 py-5">
                    <p className="text-[16px] text-[#2c3235] leading-relaxed">{detail.text}</p>
                  </div>
                );
              })()}
              <div className="px-6 pb-6">
                {(() => {
                  const isComplete = completed.has(modalIdx);
                  return (
                    <button
                      onClick={() => { setDoModalOpen(false); setSchedModalIdx(null); setCompleted(prev => { const n = new Set(prev); isComplete ? n.delete(modalIdx) : n.add(modalIdx); return n; }); }}
                      className="w-full py-3.5 rounded-2xl text-[15px] font-bold active:scale-[0.98] transition-transform"
                      style={isComplete ? { background: `${modalItem.color}18`, color: modalItem.color } : { background: modalItem.color, color: "#fff" }}
                    >
                      {isComplete ? "Mark as incomplete" : "Mark as complete"}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}


        {/* FAB */}
        <button
          onClick={() => setLogSheetOpen(true)}
          className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: doItem?.color ?? "#2653d4", boxShadow: `0 4px 16px ${doItem?.color ?? "#2653d4"}55` }}
          aria-label="Log activity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <LogSheet open={logSheetOpen} onClose={() => { setLogSheetOpen(false); setLogTab(null); setLogWizard(false); }} defaultSub={logTab} startWizard={logWizard} />
        <ReadinessSheet open={readinessSheetOpen} onClose={() => setReadinessSheetOpen(false)} onOpenLog={tab => { setLogTab(tab as Parameters<typeof setLogTab>[0]); setLogSheetOpen(true); }} onOpenLogScreen={() => { setReadinessSheetOpen(false); setLogPickerOpen(true); }} />
        <PushPrompt />

        {/* Post-match prompt */}
        {postMatchOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => setPostMatchOpen(false)}>
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => { try { localStorage.setItem("padelop:checkin-nudge-dismissed", new Date().toISOString().slice(0, 10)); } catch {} setCheckinNudgeOpen(false); }}>
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

        {/* Log picker */}
        {logPickerOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => { setLogPickerOpen(false); setLogPickerExpanded(null); setLogPickerSub(null); setExtrasOpen(false); }}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[24px] shadow-2xl" style={{ overflow: "hidden", maxHeight: "82dvh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid #f0f0f0" }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#1a1c1c", margin: 0 }}>What do you want to log?</p>
              </div>
              <div style={{ overflowY: "auto" }}>
              {(() => {
                const sleepLbl = (v: number) => ["Very poor","Poor","OK","Good","Excellent"][v-1] ?? `${v}/5`;
                const rateLbl  = (v: number) => ["Very low","Low","Moderate","Good","High"][v-1] ?? `${v}/5`;
                const items = [
                  {
                    label: "Morning Check-in", tab: "checkin" as const,
                    iconBg: "rgba(124,58,237,0.1)", iconColor: "#7c3aed",
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
                    logged: readinessItems[0],
                    detail: checkInData
                      ? `Sleep ${sleepLbl(checkInData.sleep)} · Soreness ${sleepLbl(checkInData.soreness)} · Stress ${rateLbl(checkInData.stress)}`
                      : "Log sleep, energy and soreness to set your baseline.",
                  },
                  {
                    label: "Hydration", tab: "hydration" as const,
                    iconBg: "rgba(8,145,178,0.1)", iconColor: "#0891b2",
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
                    logged: readinessItems[1],
                    detail: hydrationData
                      ? `${hydrationData.litres} · ${hydrationData.urine} urine · ${hydrationData.quality}`
                      : "Aim for 2–3L. The single biggest lever on your energy.",
                  },
                  {
                    label: "Night Check-in", tab: "wellbeing" as const,
                    iconBg: "rgba(236,72,153,0.1)", iconColor: "#ec4899",
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                    logged: false,
                    detail: checkInData
                      ? `Stress ${rateLbl(checkInData.stress)} · Motivation ${rateLbl(checkInData.motivation)} — complete before bed`
                      : "Do your morning check-in first.",
                  },
                ];
                return [
                  ...items.slice(0, 1).map((item, i) => (
                    <div key={item.tab} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <button onClick={() => setLogPickerExpanded(logPickerExpanded === item.tab ? null : item.tab)} className="w-full flex items-center gap-4 px-5 py-5 active:bg-[#f9f9f9] transition-colors">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: item.iconBg, color: item.iconColor }}>{item.icon}</div>
                        <span className="text-[19px] font-semibold text-[#1a1c1c]">{item.label}</span>
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                          {item.logged && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8ccd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: logPickerExpanded === item.tab ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                      </button>
                      {logPickerExpanded === item.tab && (<div style={{ padding: "0 20px 18px 20px" }}><p style={{ fontSize: 15, color: "#9aa5b0", margin: "0 0 14px", lineHeight: 1.5 }}>{item.detail}</p><button onClick={() => { setLogPickerOpen(false); setLogPickerExpanded(null); setLogWizard(false); setLogTab(item.tab as Parameters<typeof setLogTab>[0]); setLogSheetOpen(true); }} style={{ padding: "10px 22px", borderRadius: 999, background: "#2653d4", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#fff" }}>Log +</button></div>)}
                    </div>
                  )),
                  ...items.slice(1).map((item, i, rest) => (
                    <div key={item.tab} style={{ borderBottom: i < rest.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                      <button onClick={() => { setLogPickerExpanded(logPickerExpanded === item.tab ? null : item.tab); setLogPickerSub(null); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: item.iconBg, color: item.iconColor }}>{item.icon}</div>
                        <span className="text-[19px] font-semibold text-[#1a1c1c]">
                          {item.label}
                          {item.tab === "hydration" && logHydrationMl > 0 && (
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#2653d4", marginLeft: 8 }}>
                              {Math.min(100, Math.round(logHydrationMl / LOG_GOAL_ML * 100))}%
                            </span>
                          )}
                        </span>
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                          {item.logged && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8ccd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: logPickerExpanded === item.tab ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                      </button>
                      {logPickerExpanded === item.tab && (
                        item.tab === "hydration" ? (
                          <div style={{ padding: "0 20px 18px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1c1c" }}>
                                {logHydrationMl >= 1000 ? `${+(logHydrationMl / 1000).toFixed(1)}L` : `${logHydrationMl}ml`}
                                <span style={{ fontWeight: 400, color: "#c8ccd0" }}> / 2.5L</span>
                              </span>
                              {logHydrationMl >= LOG_GOAL_ML && <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Goal reached</span>}
                            </div>
                            <div ref={logGaugeRef} style={{ position: "relative", height: 8, borderRadius: 999, background: "#e8eaed", marginBottom: 20 }}>
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 999, background: "#2653d4", width: `${Math.min(100, (logHydrationMl / LOG_MAX_ML) * 100)}%`, transition: "width 0.15s" }} />
                              <div style={{ position: "absolute", top: -4, left: `${(LOG_GOAL_ML / LOG_MAX_ML) * 100}%`, width: 2, height: 16, background: "#b0b8c1", borderRadius: 1 }} />
                              <div
                                onTouchStart={onLogDotTouchStart}
                                onTouchMove={onLogDotTouchMove}
                                style={{
                                  position: "absolute", top: "50%", left: `${Math.min(100, (logHydrationMl / LOG_MAX_ML) * 100)}%`,
                                  transform: "translate(-50%, -50%)",
                                  width: 22, height: 22, borderRadius: "50%",
                                  background: "#fff", border: "2.5px solid #2653d4",
                                  boxShadow: "0 1px 6px rgba(38,83,212,0.25)",
                                  cursor: "grab", touchAction: "none",
                                }}
                              />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10, color: "#c8ccd0" }}>0</span>
                              <span style={{ fontSize: 10, color: "#b0b8c1" }}>2.5L</span>
                              <span style={{ fontSize: 10, color: "#c8ccd0" }}>3L+</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: "0 20px 18px 20px" }}>
                            <p style={{ fontSize: 15, color: "#9aa5b0", margin: "0 0 14px", lineHeight: 1.5 }}>{item.detail}</p>
                            <button onClick={() => { setLogPickerOpen(false); setLogPickerExpanded(null); setLogWizard(false); setLogTab(item.tab); setLogSheetOpen(true); }} style={{ padding: "10px 22px", borderRadius: 999, background: "#2653d4", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#fff" }}>Log +</button>
                          </div>
                        )
                      )}
                    </div>
                  )),
                ];

              })()}

              {/* Extras reveal */}
              {extrasOpen && (
                <div style={{ borderTop: "1px solid #f0f0f0" }}>
                  {/* Food & Snacks */}
                  <div style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <button onClick={() => setLogPickerSub(logPickerSub === "nutrition" ? null : "nutrition")} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors" style={{ background: "none", border: "none", cursor: "pointer" }}>
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                      </div>
                      <span style={{ fontSize: 19, fontWeight: 600, color: "#1a1c1c", flex: 1, textAlign: "left" }}>Food & Snacks</span>
                      {mealsToday.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "#2653d4" }}>{mealsToday.length} logged</span>}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8ccd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: logPickerSub === "nutrition" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    {logPickerSub === "nutrition" && (
                      <div style={{ padding: "4px 20px 14px 20px" }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <input type="time" value={mealTime || nowTimeStr()} onChange={e => setMealTime(e.target.value)} onClick={() => { if (!mealTime) setMealTime(nowTimeStr()); }} style={{ width: 90, padding: "7px 10px", borderRadius: 10, border: "1.5px solid #e8eaed", fontSize: 16, color: "#1a1c1c", outline: "none", flexShrink: 0 }} />
                          <input type="text" placeholder="What are you eating?" value={mealText} onChange={e => setMealText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && mealText.trim()) saveMealEntry(mealTime || nowTimeStr(), mealText); }} style={{ flex: 1, padding: "7px 12px", borderRadius: 10, border: "1.5px solid #e8eaed", fontSize: 16, color: "#1a1c1c", outline: "none" }} />
                          <button onClick={() => saveMealEntry(mealTime || nowTimeStr(), mealText)} style={{ padding: "7px 14px", borderRadius: 10, background: mealText.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: mealText.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 700, color: mealText.trim() ? "#fff" : "#b0b8c1", flexShrink: 0 }}>Save</button>
                        </div>
                        {mealsToday.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {mealsToday.map(m => (
                              <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                                <span style={{ fontSize: 13, color: "#6b7480", lineHeight: 1.4 }}>{m.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Add a note */}
                  <div>
                    <button onClick={() => setLogPickerSub(logPickerSub === "matchreview" ? null : "matchreview")} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors" style={{ background: "none", border: "none", cursor: "pointer" }}>
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(107,116,128,0.1)", color: "#6b7480" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </div>
                      <span style={{ fontSize: 19, fontWeight: 600, color: "#1a1c1c", flex: 1, textAlign: "left" }}>Add a note</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8ccd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: logPickerSub === "matchreview" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    {logPickerSub === "matchreview" && (
                      <div style={{ padding: "4px 20px 14px 20px" }}>
                        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What's on your mind?" rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: 16, color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
                        <button onClick={() => { saveNote(noteText); setLogPickerSub(null); }} style={{ marginTop: 8, padding: "7px 18px", borderRadius: 999, background: noteText.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: noteText.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 700, color: noteText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom chevron toggle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 14px", borderTop: "1px solid #f0f0f0" }}>
                <button onClick={() => { setExtrasOpen(o => !o); setLogPickerSub(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 16px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8ccd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: extrasOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Match action sheet */}
        {matchActionOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => setMatchActionOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[24px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setMatchActionOpen(false); setIsAddMode(false); setMatchModalTab('pick'); setMatchModalOpen(true); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f4f6ff] transition-colors" style={{ borderBottom: "1px solid #f0f0f0" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d418" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c]">Edit match</span>
              </button>
              <button onClick={() => { setMatchActionOpen(false); setIsAddMode(true); setMatchForm({ date: '', time: '', club: '', p1: '', p2: '', p3: '', p4: '' }); setMatchModalTab('manual'); setMatchModalOpen(true); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors" style={{ borderBottom: "1px solid #f0f0f0" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f0fdf4" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c]">Add a match</span>
              </button>
              <button onClick={() => { setMatchActionOpen(false); router.push("/matches4"); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors">
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); setUploadError(null); setUploadExtracting(false); }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-[#f0f0f0]">
                <div>
                  <p className="text-[18px] font-bold text-[#1a1c1c]">{isAddMode ? "Add Match" : "Edit Match"}</p>
                  <p className="text-[13px] text-[#6b7480] mt-0.5">Upload a screenshot or enter manually</p>
                </div>
                <button onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); setUploadError(null); setUploadExtracting(false); }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#f4f4f6" }}>
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
                    onClick={() => { setUploadError(null); matchUploadRef.current?.click(); }}
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
                        p1: data.player_1 ?? '',
                        p2: data.player_2 ?? '',
                        p3: data.player_3 ?? '',
                        p4: data.player_4 ?? '',
                      });
                      setMatchModalTab('manual');
                    } catch {
                      setUploadError('Upload failed. Please try again or enter manually.');
                    }
                    setUploadExtracting(false);
                    if (matchUploadRef.current) matchUploadRef.current.value = '';
                  }} />

                  <button
                    disabled={uploadExtracting}
                    onClick={() => { setMatchForm({ date: match?.date ?? '', time: match?.time ?? '', club: match?.club ?? '', p1: match?.players?.[0] ?? '', p2: match?.players?.[1] ?? '', p3: match?.players?.[2] ?? '', p4: match?.players?.[3] ?? '' }); setMatchModalTab('manual'); }}
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

              {matchModalTab === 'manual' && (
                <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                      <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[14px] font-medium text-[#1a1c1c] outline-none"
                        style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#f9f9f9" }} />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                      <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[14px] font-medium text-[#1a1c1c] outline-none"
                        style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#f9f9f9" }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                    <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-[14px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]"
                      style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#f9f9f9" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                    {(['p1','p2','p3','p4'] as const).map((key, i) => (
                      <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[14px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]"
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
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#2653d4", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                            History vs this opponent — {wins}W {losses}L
                          </p>
                          {topStrength.length > 0 && (
                            <p style={{ fontSize: 12, color: "#496640", margin: 0 }}>
                              Worked well: {topStrength.join(", ")}
                            </p>
                          )}
                          {topWeakness.length > 0 && (
                            <p style={{ fontSize: 12, color: "#d97706", margin: 0 }}>
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
                      const data: StoredMatch = { date: matchForm.date, time: matchForm.time, club: matchForm.club, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
                      const current = getMatchList();
                      let updated: StoredMatch[];
                      if (isAddMode) {
                        updated = [...current, data];
                      } else {
                        // Replace the current next match (matched by date+time)
                        const replaced = current.map(m => m.date === match?.date && m.time === match?.time ? data : m);
                        updated = replaced.some(m => m === data) ? replaced : [data, ...current];
                      }
                      const sorted = saveMatchList(updated);
                      const next = sorted[0];
                      if (next) setMatch({ date: next.date, time: next.time, club: next.club || undefined, players: [next.player_1, next.player_2, next.player_3, next.player_4].filter(Boolean) });
                      setMatchModalOpen(false);
                      setMatchModalTab('pick');
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
              <p style={{ fontSize: 17, fontWeight: 700, color: "#1a1c1c", margin: "0 0 4px" }}>{schedDetailOpen.title}</p>
              {schedDetailOpen.subtitle && <p style={{ fontSize: 13, color: "#6b7480", margin: "0 0 12px" }}>{schedDetailOpen.subtitle}</p>}
              <div style={{ height: 1, background: "#dfe3e7", margin: "12px 0" }} />
              {schedDetailOpen.isDrill ? (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8a9096", margin: "0 0 10px" }}>Where are you today?</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => setDrillContext("court")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", background: drillContext === "court" ? "#2653d4" : "#f4f4f6", color: drillContext === "court" ? "#fff" : "#4a5050" }}>Court</button>
                    <button onClick={() => setDrillContext("solo")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", background: drillContext === "solo" ? "#2653d4" : "#f4f4f6", color: drillContext === "solo" ? "#fff" : "#4a5050" }}>Anywhere</button>
                  </div>
                  <p style={{ fontSize: 14, color: "#3a4550", lineHeight: 1.6, margin: 0 }}>
                    {drillContext === "court" ? (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).court : (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).solo}
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "#3a4550", lineHeight: 1.6, margin: 0 }}>{schedDetailOpen.detail}</p>
              )}
              <button onClick={() => setSchedDetailOpen(null)} style={{ marginTop: 20, width: "100%", padding: "12px 0", borderRadius: 50, background: "#f4f4f6", border: "none", fontSize: 15, fontWeight: 600, color: "#1a1c1c", cursor: "pointer" }}>Done</button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
