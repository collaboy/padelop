export type DailyCheckIn = {
  date: string; // YYYY-MM-DD — only today's entry is used
  sleep: number;     // 1–5 (5 = excellent)
  energy: number;    // 1–5 (5 = high energy)
  soreness: number;  // 1–5 (5 = no soreness)
  hydration: number; // 1–5 (5 = well hydrated)
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

export type Scores = {
  overall: number;
  recovery: number;
  hydration: number;
  energy: number;
  mobility: number;
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
): Scores {
  const ci = checkIn ?? { sleep: 3, energy: 3, soreness: 3, hydration: 3, date: "" };

  // Recovery: sleep quality, muscle soreness, injury status, hydration quality
  let recovery = 65;
  recovery += (ci.sleep - 3) * 8;     // ±16
  recovery += (ci.soreness - 3) * 6;  // ±12 (5 = no soreness = good)
  if (hydration) {
    recovery += hydration.quality === "great" ? 8 : hydration.quality === "bad" ? -8 : 0;
    if (hydration.urine === "clear" || hydration.urine === "pale") recovery += 4;
    else if (hydration.urine === "dark") recovery -= 6;
    else if (hydration.urine === "brown") recovery -= 12;
  }
  if (review) {
    recovery += review.injury === "no" ? 5 : review.injury === "yes" ? -15 : review.injury === "minor" ? -5 : 0;
  }

  // Hydration: logged litres, urine colour, subjective quality, check-in self-rating
  let hydr = 65;
  hydr += (ci.hydration - 3) * 7;  // ±14
  if (hydration) {
    hydr += LITRE_DELTA[hydration.litres] ?? 0;  // ±20
    hydr += hydration.quality === "great" ? 6 : hydration.quality === "bad" ? -6 : 0;
    if (hydration.urine === "clear" || hydration.urine === "pale") hydr += 6;
    else if (hydration.urine === "yellow") hydr += 0;
    else if (hydration.urine === "dark") hydr -= 10;
    else if (hydration.urine === "brown") hydr -= 18;
  }

  // Energy: check-in energy + sleep (sleep debt tanks energy), nutrition quality
  let energy = 65;
  energy += (ci.energy - 3) * 9;   // ±18
  energy += (ci.sleep - 3) * 5;    // ±10 — sleep heavily affects energy
  if (nutrition) {
    energy += nutrition.quality === "great" ? 6 : nutrition.quality === "bad" ? -6 : 0;
    energy += nutrition.proteinRating === "high" ? 4 : nutrition.proteinRating === "low" ? -4 : 0;
  }
  if (review) {
    energy += review.energy === "high" ? 5 : review.energy === "low" ? -5 : 0;
  }

  // Mobility: soreness (primary driver), injury, activity frequency this week
  let mobility = 65;
  mobility += (ci.soreness - 3) * 8;  // ±16
  mobility += (ci.energy - 3) * 2;    // low energy usually means stiff
  if (review) {
    mobility += review.injury === "yes" ? -14 : review.injury === "minor" ? -6 : review.injury === "no" ? 5 : 0;
  }
  // Active players maintain mobility better (capped at 2 game days to avoid over-inflation)
  mobility += Math.min(gameDaysThisWeek, 2) * 3;

  // Habit contributions
  if (habits) {
    if (habits.sleep)        { recovery += 10; energy += 8;  mobility += 4; }
    if (habits.mobility)     { mobility += 8; }
    if (habits.visualise)    { energy += 4;   recovery += 2; }
    if (habits.boxBreathing) { recovery += 6; energy += 4; }
    if (habits.foamRoll)     { recovery += 8; mobility += 6; }
    if (habits.lightWalk)    { recovery += 5; mobility += 3; }
    if (habits.coldShower)   { recovery += 7; }
  }

  const r = clamp(recovery);
  const h = clamp(hydr);
  const e = clamp(energy);
  const m = clamp(mobility);

  // Overall: weighted average — recovery and energy are the biggest drivers of match readiness
  const overall = clamp(r * 0.30 + h * 0.25 + e * 0.30 + m * 0.15);

  return { overall, recovery: r, hydration: h, energy: e, mobility: m };
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
    // Use if logged within the last 36 hours
    if (recent && Date.now() - new Date(recent.ts).getTime() < 36 * 3600_000) {
      hydration = recent;
    }
  } catch {}

  let review: ReviewEntry | null = null;
  try {
    const logs = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[];
    if (logs.length > 0) review = logs[0];
  } catch {}

  let nutrition: NutritionEntry | null = null;
  try {
    const logs = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]") as NutritionEntry[];
    if (logs.length > 0) nutrition = logs[0];
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

  return { checkIn, hydration, review, nutrition, gameDaysThisWeek, habits };
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
    if (len === 0) return { overall: 65, recovery: 65, hydration: 65, energy: 65, mobility: 65 };

    const all: Scores[] = [];
    for (let i = 0; i < len; i++) {
      all.push(computeScores(null, hydLogs[i] ?? null, revLogs[i] ?? null, nutLogs[i] ?? null, 1));
    }

    const avg = (vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return {
      overall:   avg(all.map(s => s.overall)),
      recovery:  avg(all.map(s => s.recovery)),
      hydration: avg(all.map(s => s.hydration)),
      energy:    avg(all.map(s => s.energy)),
      mobility:  avg(all.map(s => s.mobility)),
    };
  } catch {
    return { overall: 65, recovery: 65, hydration: 65, energy: 65, mobility: 65 };
  }
}
