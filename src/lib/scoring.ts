export type DailyCheckIn = {
  date: string;
  sleep: number;      // 1–5 (5 = excellent)
  energy: number;     // 1–5 (5 = high energy)
  soreness: number;   // 1–5 (5 = no soreness)
  hydration: number;  // 1–5 subjective feeling (5 = well hydrated)
  stress: number;     // 1–5 (5 = low stress = good)
  motivation: number; // 1–5 (5 = high motivation)
  sleepHours?: string;       // "5h"|"6h"|"7h"|"8h"|"9h+"
  pain?: string;             // "none"|"minor"|"yes"
  painAreas?: string[];
  waterOnWaking?: boolean;
};

export type HydrationEntry = {
  ts: string;
  litres: string;
  timing: string[];
  quality: string; // "bad" | "ok" | "great"
  urine: string;   // "clear" | "pale" | "yellow" | "dark" | "brown"
};

export type ReviewEntry = {
  ts: string;
  feeling: string;  // "great" | "ok" | "bad"
  result: string;   // "win" | "loss" | "draw"
  energy: string;   // "high" | "mid" | "low"
  injury: string;   // "yes" | "no" | "minor"
  mentalBefore: string; mentalDuring: string; mentalAfter: string;
  wellDone: string[]; improved: string[];
  notes?: string;
  [key: string]: unknown;
};

export type NutritionEntry = {
  ts: string;
  proteinRating: string; // "low" | "mid" | "high"
  foods: string[];
  postMatch: string;     // "yes" | "no"
  quality: string;       // "bad" | "ok" | "great"
};

export type TrainingEntry = {
  ts: string;
  sessionType: string[]; // ["Padel", "Gym", "Cardio", "Drills"]
  drillFocus: string[];  // ["Serve", "Bandeja", ...]
  duration: string;      // "30min" | "60min" | "90min+"
  intensity: string;     // "light" | "moderate" | "hard"
};

export type HabitsEntry = {
  date: string;
  sleep: boolean;
  mobility: boolean;
  visualise: boolean;
  boxBreathing: boolean;
  foamRoll: boolean;
  lightWalk: boolean;
  coldShower: boolean;
};

// 4-pillar readiness score
export type Scores = {
  overall: number;
  recovery: number;
  nutrition: number;
  training: number;
  wellbeing: number;
};

const LITRE_DELTA: Record<string, number> = {
  "<1L": -20, "1–1.5L": -12, "1.5–2L": -4, "2–2.5L": 4, "2.5–3L": 12, "3L+": 18,
};

const clamp = (n: number) => Math.max(65, Math.min(100, Math.round(n)));

export function computeScores(
  checkIn: DailyCheckIn | null,
  hydration: HydrationEntry | null,
  review: ReviewEntry | null,
  nutrition: NutritionEntry | null,
  gameDaysThisWeek: number,
  habits: HabitsEntry | null = null,
  training: TrainingEntry | null = null,
): Scores {
  const ci = checkIn ?? { sleep: 3, energy: 3, soreness: 3, hydration: 3, stress: 3, motivation: 3, date: "" };

  // Injury impact decays linearly to zero over 14 days
  const injuryDecay = review?.ts
    ? Math.max(0, 1 - Math.floor((Date.now() - new Date(review.ts).getTime()) / 86400000) / 14)
    : 0;

  // ── Recovery (sleep, soreness, habits, injury) ──────────────────────────
  let rec = 65;
  rec += (ci.sleep - 3) * 8;     // ±16
  rec += (ci.soreness - 3) * 7;  // ±14 (5 = no soreness = good)
  if (review) {
    const injuryDelta = review.injury === "no" ? 5 : review.injury === "yes" ? -15 : review.injury === "minor" ? -5 : 0;
    rec += Math.round(injuryDelta * injuryDecay);
  }
  if (habits) {
    if (habits.sleep)        rec += 10;
    if (habits.foamRoll)     rec += 8;
    if (habits.coldShower)   rec += 7;
    if (habits.boxBreathing) rec += 6;
    if (habits.lightWalk)    rec += 5;
    if (habits.mobility)     rec += 4;
    if (habits.visualise)    rec += 2;
  }

  // ── Nutrition (hydration + food quality) ────────────────────────────────
  let nut = 65;
  nut += (ci.hydration - 3) * 7;  // ±14 — subjective feeling from check-in
  if (hydration) {
    nut += LITRE_DELTA[hydration.litres] ?? 0;  // ±20
    nut += hydration.quality === "great" ? 6 : hydration.quality === "bad" ? -6 : 0;
    if (hydration.urine === "clear" || hydration.urine === "pale") nut += 6;
    else if (hydration.urine === "dark")  nut -= 10;
    else if (hydration.urine === "brown") nut -= 18;
  }
  if (nutrition) {
    nut += nutrition.proteinRating === "high" ? 8 : nutrition.proteinRating === "low" ? -8 : 0;
    nut += nutrition.quality === "great" ? 8 : nutrition.quality === "bad" ? -8 : 0;
    nut += nutrition.postMatch === "yes" ? 4 : 0;
  }

  // ── Training (sessions, load, focus) ────────────────────────────────────
  let trn = 65;
  trn += Math.min(gameDaysThisWeek, 2) * 5;  // up to +10 for 2 game days
  if (training) {
    trn += 10;  // logged a training session
    if (training.drillFocus.length > 0)          trn += 4;
    if (training.sessionType.includes("Gym") || training.sessionType.includes("Cardio")) trn += 4;
    if (training.intensity === "hard")     trn += 2;
    if (training.intensity === "light")    trn -= 2;
  }

  // ── Wellbeing (stress, motivation, energy, mental state) ────────────────
  let wb = 65;
  wb += (ci.stress - 3) * 8;      // ±16 (5 = low stress = good)
  wb += (ci.motivation - 3) * 6;  // ±12
  wb += (ci.energy - 3) * 4;      // ±8
  if (review) {
    const mentalScore = (v: string) => v === "great" ? 1 : v === "bad" ? -1 : 0;
    const mentalSum = mentalScore(review.mentalBefore as string ?? "")
      + mentalScore(review.mentalDuring as string ?? "")
      + mentalScore(review.mentalAfter as string ?? "");
    wb += Math.round(mentalSum * 3 * injuryDecay);
    wb += Math.round((review.energy === "high" ? 5 : review.energy === "low" ? -5 : 0) * injuryDecay);
  }
  if (habits?.visualise) wb += 4;

  const r = clamp(rec);
  const n = clamp(nut);
  const t = clamp(trn);
  const w = clamp(wb);

  // Overall: Recovery 30%, Nutrition 25%, Training 20%, Wellbeing 25%
  const overall = clamp(r * 0.30 + n * 0.25 + t * 0.20 + w * 0.25);

  return { overall, recovery: r, nutrition: n, training: t, wellbeing: w };
}

export function saveHabits(habits: Omit<HabitsEntry, "date">): void {
  const entry: HabitsEntry = { ...habits, date: new Date().toISOString().slice(0, 10) };
  localStorage.setItem("padelop:habits", JSON.stringify(entry));
  window.dispatchEvent(new Event("storage"));
}

export function loadScoringData(): {
  checkIn: DailyCheckIn | null;
  hydration: HydrationEntry | null;
  review: ReviewEntry | null;
  nutrition: NutritionEntry | null;
  gameDaysThisWeek: number;
  habits: HabitsEntry | null;
  training: TrainingEntry | null;
} {
  const todayYMD = new Date().toISOString().slice(0, 10);

  let checkIn: DailyCheckIn | null = null;
  try {
    const raw = localStorage.getItem("padelop:daily-checkin");
    if (raw) {
      const parsed = JSON.parse(raw) as DailyCheckIn;
      if (parsed.date === todayYMD) checkIn = parsed;
    }
  } catch {}

  let hydration: HydrationEntry | null = null;
  try {
    const logs = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
    const recent = logs[0];
    if (recent && new Date(recent.ts).toISOString().slice(0, 10) === todayYMD) hydration = recent;
  } catch {}

  let review: ReviewEntry | null = null;
  try {
    const logs = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[];
    if (logs.length > 0) review = logs[0];
  } catch {}

  let nutrition: NutritionEntry | null = null;
  try {
    const logs = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]") as NutritionEntry[];
    const recent = logs[0];
    if (recent && new Date(recent.ts).toISOString().slice(0, 10) === todayYMD) nutrition = recent;
  } catch {}

  let training: TrainingEntry | null = null;
  try {
    const logs = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]") as TrainingEntry[];
    const recent = logs[0];
    if (recent && Date.now() - new Date(recent.ts).getTime() < 48 * 3600_000) training = recent;
  } catch {}

  let gameDaysThisWeek = 0;
  try {
    const days = JSON.parse(localStorage.getItem("padelop:game-days") || "[]") as string[];
    const dow = (new Date().getDay() + 6) % 7;
    const y = new Date(); y.setDate(y.getDate() - dow);
    const weekStart = y.toISOString().slice(0, 10);
    gameDaysThisWeek = days.filter(d => d >= weekStart && d <= todayYMD).length;
  } catch {}

  let habits: HabitsEntry | null = null;
  try {
    const raw = localStorage.getItem("padelop:habits");
    if (raw) {
      const parsed = JSON.parse(raw) as HabitsEntry;
      if (parsed.date === todayYMD) habits = parsed;
    }
  } catch {}

  return { checkIn, hydration, review, nutrition, gameDaysThisWeek, habits, training };
}

export type ScoreSnapshot = Scores & { date: string };

export function saveScoreSnapshot(scores: Scores): void {
  const date = new Date().toISOString().slice(0, 10);
  try {
    const history: ScoreSnapshot[] = JSON.parse(localStorage.getItem("padelop:score-history") || "[]");
    const filtered = history.filter(s => s.date !== date);
    filtered.unshift({ ...scores, date });
    localStorage.setItem("padelop:score-history", JSON.stringify(filtered.slice(0, 90)));
  } catch {}
}

export function loadScoreHistory(): ScoreSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem("padelop:score-history") || "[]") as ScoreSnapshot[];
  } catch { return []; }
}

export type PillarStatus = "good" | "ok" | "low" | "not_logged";
export type PillarState = { status: PillarStatus; reason: string };
export type PillarStates = {
  recovery: PillarState;
  nutrition: PillarState;
  training: PillarState;
  wellbeing: PillarState;
};

export function computePillarStates(
  checkIn: DailyCheckIn | null,
  hydration: HydrationEntry | null,
  nutrition: NutritionEntry | null,
  habits: HabitsEntry | null,
  training: TrainingEntry | null,
  matchToday: boolean,
): PillarStates {
  // ── Recovery ─────────────────────────────────────────────────────────────
  let recovery: PillarState;
  if (!checkIn) {
    recovery = { status: "not_logged", reason: "Morning check-in not done" };
  } else {
    const s = checkIn.sleep, so = checkIn.soreness;
    const habitBoost = habits ? (habits.foamRoll ? 1 : 0) + (habits.coldShower ? 1 : 0) + (habits.mobility ? 1 : 0) : 0;
    if (s >= 4 && so >= 4)
      recovery = { status: "good", reason: habitBoost > 0 ? "Good sleep · habits done" : "Good sleep, body feels fresh" };
    else if (s >= 3 && so >= 3)
      recovery = { status: "ok", reason: s < 4 ? "Sleep could be better" : "Some soreness today" };
    else
      recovery = { status: "low", reason: s <= 2 ? "Poor sleep last night" : "High soreness today" };
  }

  // ── Nutrition ─────────────────────────────────────────────────────────────
  let nutritionState: PillarState;
  if (!nutrition && !hydration) {
    nutritionState = { status: "not_logged", reason: "Night check-in not done yet" };
  } else {
    const q = nutrition?.quality, p = nutrition?.proteinRating;
    const litres = hydration?.litres, urine = hydration?.urine;
    const badHydration = ["<1L", "1–1.5L"].includes(litres ?? "") || urine === "dark" || urine === "brown";
    const goodHydration = ["2–2.5L", "2.5–3L", "3L+"].includes(litres ?? "");
    if (badHydration)
      nutritionState = { status: "low", reason: urine === "dark" || urine === "brown" ? "Drink more — urine is dark" : "Not enough fluids today" };
    else if (p === "low" || q === "bad")
      nutritionState = { status: "low", reason: p === "low" ? "Protein intake low today" : "Poor nutrition quality" };
    else if ((q === "great" || p === "high") && !badHydration)
      nutritionState = { status: "good", reason: p === "high" ? "Protein target hit" : "Well fuelled today" };
    else
      nutritionState = { status: "ok", reason: goodHydration ? "Hydration on track" : "Nutrition adequate" };
  }

  // ── Training ─────────────────────────────────────────────────────────────
  let trainingState: PillarState;
  if (training) {
    const type = training.sessionType.length > 0 ? training.sessionType.join(" & ") : "Session";
    trainingState = { status: "good", reason: `${type} logged` };
  } else if (matchToday) {
    trainingState = { status: "good", reason: "Match day — game counts" };
  } else if (habits && (habits.lightWalk || habits.mobility)) {
    trainingState = { status: "ok", reason: "Light activity logged" };
  } else {
    trainingState = { status: "not_logged", reason: "No recent sessions" };
  }

  // ── Wellbeing ─────────────────────────────────────────────────────────────
  let wellbeing: PillarState;
  if (!checkIn) {
    wellbeing = { status: "not_logged", reason: "Check-in not done yet" };
  } else {
    const st = checkIn.stress, mo = checkIn.motivation, en = checkIn.energy;
    if (st >= 4 && mo >= 4)
      wellbeing = { status: "good", reason: "Low stress, feeling motivated" };
    else if (st >= 3 && mo >= 3)
      wellbeing = { status: "ok", reason: en >= 4 ? "Good energy today" : "Feeling steady" };
    else
      wellbeing = { status: "low", reason: st <= 2 ? "High stress today" : "Low motivation" };
  }

  return { recovery, nutrition: nutritionState, training: trainingState, wellbeing };
}

export function saveCheckIn(ci: Omit<DailyCheckIn, "date">): void {
  const entry: DailyCheckIn = { ...ci, date: new Date().toISOString().slice(0, 10) };
  localStorage.setItem("padelop:daily-checkin", JSON.stringify(entry));
}

export type MorningLog = Pick<DailyCheckIn, "sleepHours" | "pain" | "painAreas" | "waterOnWaking"> & { date?: string };

export type MatchReadinessResult = {
  color: "green" | "yellow" | "orange" | "red";
  label: "Ready" | "Manage" | "Limited" | "Protect";
  limiter: string | null;
  actions: string[];
  riskScore: number;
};

export function loadMorningLog(): MorningLog | null {
  try {
    const todayYMD = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem("padelop:daily-checkin");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyCheckIn;
    if (parsed.date !== todayYMD) return null;
    return { date: parsed.date, sleepHours: parsed.sleepHours, pain: parsed.pain, painAreas: parsed.painAreas, waterOnWaking: parsed.waterOnWaking };
  } catch { return null; }
}

export function computeMatchReadiness(
  checkIn: DailyCheckIn | null,
  morningLog: MorningLog | null,
  hadMatchYesterday: boolean,
  review: ReviewEntry | null = null,
): MatchReadinessResult {
  if (!checkIn && !morningLog) {
    return {
      color: "yellow",
      label: "Manage",
      limiter: "No check-in logged",
      actions: ["Log your morning check-in to get personalised readiness guidance."],
      riskScore: 0,
    };
  }

  let sleepPts = 0;
  let energyPts = 0;
  let sorenessPts = 0;
  let stressPts = 0;
  let trainingPts = 0;

  // Sleep hours
  const sh = morningLog?.sleepHours;
  if (sh === "6h") sleepPts += 1;
  else if (sh === "5h") sleepPts += 2;

  // Sleep quality (1–5, 5 = excellent)
  const sq = checkIn?.sleep ?? 3;
  if (sq === 3) sleepPts += 1;
  else if (sq <= 2) sleepPts += 2;

  // Energy (1–5, 5 = high)
  const en = checkIn?.energy ?? 3;
  if (en === 5) energyPts += 0;
  else if (en === 4) energyPts += 1;
  else if (en === 3) energyPts += 2;
  else energyPts += 3;

  // Soreness / pain (1–5, 5 = no soreness; pain field overrides)
  const pain = morningLog?.pain ?? (review?.injury === "yes" ? "yes" : review?.injury === "minor" ? "minor" : "none");
  if (pain === "yes") {
    sorenessPts = 4;
  } else if (pain === "minor") {
    sorenessPts = 2;
  } else {
    const so = checkIn?.soreness ?? 3;
    if (so <= 1) sorenessPts = 4;
    else if (so === 2) sorenessPts = 2;
    else if (so === 3) sorenessPts = 1;
  }

  // Stress (1–5, 5 = low stress)
  const st = checkIn?.stress ?? 3;
  if (st <= 2) stressPts = 2;
  else if (st === 3) stressPts = 1;

  // Yesterday's match
  const poorSleep = (checkIn?.sleep ?? 3) <= 2;
  if (hadMatchYesterday && poorSleep) trainingPts = 2;
  else if (hadMatchYesterday) trainingPts = 1;

  const riskScore = sleepPts + energyPts + sorenessPts + stressPts + trainingPts;

  const color: MatchReadinessResult["color"] =
    riskScore <= 2 ? "green" : riskScore <= 5 ? "yellow" : riskScore <= 8 ? "orange" : "red";
  const label: MatchReadinessResult["label"] =
    color === "green" ? "Ready" : color === "yellow" ? "Manage" : color === "orange" ? "Limited" : "Protect";

  const buckets: [string, number][] = [
    ["sleep", sleepPts],
    ["energy", energyPts],
    ["soreness", sorenessPts],
    ["stress", stressPts],
    ["training load", trainingPts],
  ];
  const topLimiter = [...buckets].sort((a, b) => b[1] - a[1])[0];
  const limiter = topLimiter[1] > 0 ? topLimiter[0] : null;

  const actionMap: Record<string, string[]> = {
    sleep: [
      "Drink 500–750ml water before noon — fatigue worsens with dehydration",
      "Take a 20-minute nap before 3pm if you can",
      "Extend your warm-up by 10 minutes — your nervous system needs more time today",
      "Avoid explosive or max-intensity drills",
      "Eat a proper meal 2–3 hours before play",
    ],
    energy: [
      "Have a carb-rich snack 90 minutes before play — banana, toast, or rice",
      "Drink 500ml of water now and keep sipping through the day",
      "Avoid skipping meals — small regular fuelling beats one big meal",
      "Use your warm-up to find your rhythm, not to push intensity",
      "A short walk before court time can lift energy levels",
    ],
    soreness: [
      "Foam roll quads, hips, and calves before warming up",
      "Add 10 minutes of light mobility before hitting",
      "Reduce intensity in the first 20 minutes — let your body ease in",
      "Prioritise protein in your next meal to support repair",
      "Ice or cold water on sore areas post-match",
    ],
    stress: [
      "5 minutes of box breathing before court (4 in – 4 hold – 4 out – 4 hold)",
      "Write down 3 things you can control today — focus only on those",
      "Keep your pre-match routine simple — familiar beats perfect",
      "Play your patterns, not the scoreboard",
      "Reset after every point — one rally at a time",
    ],
    "training load": [
      "Start warm-up at 50% and build slowly — don't rush the first 15 minutes",
      "Focus on control and placement today, not power or speed",
      "Avoid consecutive explosive sessions — manage the load",
      "Stretch for an extra 10 minutes after the match",
      "Prioritise sleep and protein tonight to recover before next session",
    ],
  };

  const actions = limiter
    ? actionMap[limiter]
    : [
        "You're well recovered — stick to your normal routine",
        "Stay hydrated during warm-up and throughout play",
        "Trust your preparation and focus on execution",
      ];

  const limiterLabels: Record<string, string> = {
    sleep: "Sleep",
    energy: "Energy",
    soreness: "Soreness",
    stress: "Stress",
    "training load": "Training load",
  };

  return { color, label, limiter: limiter ? limiterLabels[limiter] : null, actions, riskScore };
}

export function improveTips(states: PillarStates): string[] {
  const tips: string[] = [];
  const isMatchDay = states.training.reason?.includes("Match");

  if (states.recovery.status === "not_logged") {
    tips.push("Log your morning check-in so we can tailor today's recommendations");
  } else if (states.recovery.status === "low") {
    const r = states.recovery.reason;
    if (r.includes("sleep")) {
      tips.push(isMatchDay
        ? "Short on sleep — take a 20-min nap before your match and avoid caffeine after 2pm"
        : "Poor sleep last night — a 20-min nap now restores alertness better than caffeine");
    } else {
      tips.push(isMatchDay
        ? "Soreness going into your match — do a thorough warm-up and stay loose between sets"
        : "High soreness — 10 min of foam rolling or a cold shower will speed up recovery today");
    }
  } else if (states.recovery.status === "ok") {
    tips.push(isMatchDay
      ? "Not fully rested — keep your warm-up dynamic and sip water consistently to stay sharp"
      : "Not fully rested — cap today's intensity and get to bed 30 min earlier than usual");
  }

  if (states.wellbeing.status === "not_logged") {
    tips.push("Check in on your energy and stress — it shapes what training is right for today");
  } else if (states.wellbeing.status === "low") {
    const r = states.wellbeing.reason;
    tips.push(r.includes("stress")
      ? "Stress is high — try 5 minutes of box breathing before your next session"
      : isMatchDay
        ? "Motivation is low — stick to your warm-up routine and let the match energy carry you"
        : "Low motivation — commit to just 15 minutes; most of the time that's enough to get going");
  } else if (states.wellbeing.status === "ok") {
    tips.push("Energy not at peak — start with a dynamic warm-up to get your body into gear");
  }

  if (states.nutrition.status === "not_logged") {
    tips.push(`Log what you eat today — fuelling matters on a ${isMatchDay ? "match" : "training"} day`);
  } else if (states.nutrition.status === "low") {
    const r = states.nutrition.reason;
    if (r.includes("dark") || r.includes("fluids")) {
      tips.push("Hydration is low — drink 500ml now and keep a bottle with you for the rest of the day");
    } else if (r.includes("Protein")) {
      tips.push("Protein is low — add eggs, chicken, or a shake to your next meal before you train");
    } else {
      tips.push(isMatchDay
        ? "Nutrition is light — have a carb-rich snack 60–90 min before your match"
        : "Nutrition is light — a meal with veg, protein, and carbs will fuel your session better");
    }
  } else if (states.nutrition.status === "ok") {
    tips.push(isMatchDay
      ? "Nutrition is adequate — top up with a banana or rice cakes 60 min before kick-off"
      : "Nutrition is adequate — add another glass of water and a protein source at your next meal");
  }

  if (states.training.status === "not_logged") {
    tips.push("No session logged yet — even 30 min of focused drills moves the needle");
  }

  return tips.slice(0, 3);
}

export function buildInsightParagraph(states: PillarStates): string {
  const isMatchDay = states.training.reason?.includes("Match");
  const isRecoveryDay = states.training.reason?.includes("recovery") || states.training.reason?.includes("Recovery");

  // Gather what each pillar needs, as clause fragments
  const clauses: string[] = [];

  // Recovery
  if (states.recovery.status === "low") {
    const r = states.recovery.reason;
    if (r.includes("sleep")) {
      clauses.push(isMatchDay
        ? "you're short on sleep so squeeze in a 20-min nap before your match and cut caffeine by 2pm"
        : "last night's sleep was poor so a 20-min nap now will do more for you than another coffee");
    } else {
      clauses.push(isMatchDay
        ? "your legs are carrying some soreness so make your warm-up thorough and stay loose between sets"
        : "soreness is high so spend 10 minutes on foam rolling or finish with a cold shower");
    }
  } else if (states.recovery.status === "ok") {
    clauses.push(isMatchDay
      ? "you're not fully rested so keep your warm-up dynamic and sip water consistently throughout"
      : "recovery is partial so keep today's intensity moderate and aim to be in bed 30 minutes earlier");
  }

  // Wellbeing
  if (states.wellbeing.status === "low") {
    const r = states.wellbeing.reason;
    if (r.includes("stress")) {
      clauses.push("stress is elevated so take 5 minutes of box breathing before you start");
    } else {
      clauses.push(isMatchDay
        ? "motivation is low but lean on your routine and let the match energy do the rest"
        : "motivation is low so commit to just 15 minutes — momentum usually follows");
    }
  } else if (states.wellbeing.status === "ok") {
    clauses.push("energy isn't at its peak so open with a dynamic warm-up to get the body switched on");
  }

  // Nutrition
  if (states.nutrition.status === "low") {
    const r = states.nutrition.reason;
    if (r.includes("dark") || r.includes("fluids")) {
      clauses.push("hydration is behind so drink 500ml right now and keep a bottle close for the rest of the day");
    } else if (r.includes("Protein")) {
      clauses.push("protein is low so add eggs, chicken, or a shake to your next meal before you train");
    } else {
      clauses.push(isMatchDay
        ? "fuelling is light so get a carb-rich snack in 60–90 minutes before your match"
        : "nutrition is light so build your next meal around protein, veg, and slow carbs");
    }
  } else if (states.nutrition.status === "ok") {
    clauses.push(isMatchDay
      ? "top up with a banana or rice cakes about an hour before kick-off"
      : "add one more glass of water and a protein source at your next meal to push nutrition higher");
  }

  // All clear
  if (clauses.length === 0) {
    if (isMatchDay) return "Everything is tracking well. Trust your preparation, stay sharp, and enjoy the game.";
    if (isRecoveryDay) return "Your body is in good shape today. Keep the load light, stay hydrated, and let the recovery do its work.";
    return "All pillars are on track. Show up, put in the work, and keep the streak going.";
  }

  // Build the paragraph
  const dayOpener = isMatchDay ? "Ahead of your match" : isRecoveryDay ? "For your recovery today" : "Going into today's session";

  if (clauses.length === 1) {
    return `${dayOpener}, ${clauses[0]}.`;
  }
  if (clauses.length === 2) {
    return `${dayOpener}, ${clauses[0]}. Also, ${clauses[1]}.`;
  }
  // 3 clauses
  return `${dayOpener}, ${clauses[0]}. On top of that, ${clauses[1]}. Finally, ${clauses[2]}.`;
}

export function computeAllTimeScores(): Scores {
  try {
    const hydLogs = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
    const nutLogs = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]") as NutritionEntry[];
    const revLogs = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[];

    const len = Math.max(hydLogs.length, nutLogs.length, revLogs.length);
    if (len === 0) return { overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 };

    const all: Scores[] = [];
    for (let i = 0; i < len; i++) {
      all.push(computeScores(null, hydLogs[i] ?? null, revLogs[i] ?? null, nutLogs[i] ?? null, 1));
    }

    const avg = (vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return {
      overall:   avg(all.map(s => s.overall)),
      recovery:  avg(all.map(s => s.recovery)),
      nutrition: avg(all.map(s => s.nutrition)),
      training:  avg(all.map(s => s.training)),
      wellbeing: avg(all.map(s => s.wellbeing)),
    };
  } catch {
    return { overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 };
  }
}

// ── Form Score ────────────────────────────────────────────────────────────────
// 5-component rolling score (0–100, no artificial baseline).
// Components that have no data return null and their weight is redistributed.

export type FormScore = {
  score: number;
  components: {
    body: number | null;        // 30% — 7-day recovery+wellbeing average
    matchForm: number | null;   // 25% — last 5 match reviews (result + feeling + energy)
    consistency: number | null; // 20% — check-in days + schedule completion last 7 days
    activity: number | null;    // 15% — matches + training sessions last 14 days
    hydration: number | null;   // 10% — today's ml vs 2L target (or recent litres logs)
  };
};

export function computeFormScore(): FormScore {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const c01 = (n: number) => Math.max(0, Math.min(1, n));

  // Component 1: Body (30%)
  // 7-day average of recovery + wellbeing pillars from score-history.
  // These capture sleep, soreness, energy, stress, motivation.
  // Scores are in [65,100], remapped to [0,100].
  let body: number | null = null;
  try {
    const history = JSON.parse(localStorage.getItem("padelop:score-history") || "[]") as ScoreSnapshot[];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recent = history.filter(s => s.date >= cutoffStr && s.date <= todayYMD);
    if (recent.length >= 1) {
      const avg = recent.reduce((sum, s) => sum + (s.recovery + s.wellbeing) / 2, 0) / recent.length;
      body = Math.round(c01((avg - 65) / 35) * 100);
    }
  } catch {}

  // Component 2: Match Form (25%)
  // Last 5 match reviews. Result weighted 60%, feeling 20%, energy 20%.
  let matchForm: number | null = null;
  try {
    const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[];
    const last5 = reviews.slice(0, 5);
    if (last5.length >= 1) {
      const perReview = last5.map(r => {
        const result  = r.result === "win" ? 1 : r.result === "draw" ? 0.5 : 0;
        const feeling = r.feeling === "great" ? 1 : r.feeling === "ok" ? 0.5 : 0;
        const energy  = r.energy === "high" ? 1 : r.energy === "mid" ? 0.5 : 0;
        return (result * 0.6 + feeling * 0.2 + energy * 0.2) * 100;
      });
      matchForm = Math.round(perReview.reduce((a, b) => a + b, 0) / perReview.length);
    }
  } catch {}

  // Component 3: Consistency (20%)
  // Days with a score snapshot (logged check-in) + days with schedule tasks done, last 7 days.
  let consistency: number | null = null;
  try {
    const history = JSON.parse(localStorage.getItem("padelop:score-history") || "[]") as ScoreSnapshot[];
    const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
    let loggedDays = 0, schedDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (history.some(s => s.date === ds)) loggedDays++;
      if (sd[ds]?.length > 0) schedDays++;
    }
    if (loggedDays > 0 || schedDays > 0) {
      consistency = Math.round((loggedDays / 7 * 0.6 + schedDays / 7 * 0.4) * 100);
    }
  } catch {}

  // Component 4: Activity (15%)
  // Matches played (game-days) + training sessions logged, last 14 days.
  // 4 activities in 14 days = 100%.
  let activity: number | null = null;
  try {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const gameDays = JSON.parse(localStorage.getItem("padelop:game-days") || "[]") as string[];
    const matches = gameDays.filter(d => d >= cutoffStr && d <= todayYMD).length;
    const tLogs = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]") as { ts: string }[];
    const sessions = tLogs.filter(t => {
      const d = new Date(t.ts).toISOString().slice(0, 10);
      return d >= cutoffStr && d <= todayYMD;
    }).length;
    const total = matches + sessions;
    if (total > 0) activity = Math.round(c01(total / 4) * 100);
  } catch {}

  // Component 5: Hydration (10%)
  // Same three-step fallback as home8: quick tracker → litres log → waterOnWaking seed.
  let hydration: number | null = null;
  try {
    const LITRE_ML: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
    const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
    const hasQuick = hq?.date === todayYMD && typeof hq.ml === "number" && hq.ml > 0;
    let ml = hasQuick ? (hq.ml as number) : 0;
    if (!hasQuick) {
      const logs = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
      const todayLog = logs.find(e => new Date(e.ts).toISOString().slice(0, 10) === todayYMD);
      if (todayLog) ml = LITRE_ML[todayLog.litres] ?? 0;
    }
    if (ml === 0) {
      const mLog = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      if (mLog?.date === todayYMD && mLog?.waterOnWaking === true) ml = 500;
    }
    if (ml > 0) hydration = Math.round(c01(ml / 2000) * 100);
  } catch {}

  // Weighted average — null components redistribute their weight to present ones
  const WEIGHTS: Record<string, number> = {
    body: 0.30, matchForm: 0.25, consistency: 0.20, activity: 0.15, hydration: 0.10,
  };
  const components = { body, matchForm, consistency, activity, hydration };
  let totalWeight = 0, weightedSum = 0;
  for (const [k, v] of Object.entries(components)) {
    if (v !== null) { const w = WEIGHTS[k]; weightedSum += v * w; totalWeight += w; }
  }
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  return { score, components };
}
