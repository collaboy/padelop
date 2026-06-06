export type DailyCheckIn = {
  date: string;
  sleep: number;      // 1–5 (5 = excellent)
  energy: number;     // 1–5 (5 = high energy)
  soreness: number;   // 1–5 (5 = no soreness)
  hydration: number;  // 1–5 subjective feeling (5 = well hydrated)
  stress: number;     // 1–5 (5 = low stress = good)
  motivation: number; // 1–5 (5 = high motivation)
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
    if (recent && Date.now() - new Date(recent.ts).getTime() < 36 * 3600_000) hydration = recent;
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
    if (recent && Date.now() - new Date(recent.ts).getTime() < 24 * 3600_000) nutrition = recent;
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

export function saveCheckIn(ci: Omit<DailyCheckIn, "date">): void {
  const entry: DailyCheckIn = { ...ci, date: new Date().toISOString().slice(0, 10) };
  localStorage.setItem("padelop:daily-checkin", JSON.stringify(entry));
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
