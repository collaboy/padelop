// Central registry of all localStorage keys used in the app.
// Export/import reads and writes every key here.

export const KEYS = {
  gameDays:       "padelop:game-days",
  gameTimes:      "padelop:game-times",
  gameDetails:    "padelop:game-details",
  nextMatch:      "padelop:next-match",
  matchData:      "padelop:match-data",
  matchReviews:   "padelop:match-reviews",
  hydrationLogs:  "padelop:hydration-logs",
  nutritionLogs:  "padelop:nutrition-logs",
  statsGlasses:   "padelop:stats:glasses",
} as const;

// Week-plan flags are keyed by Monday YMD — collected dynamically on export.
const WEEK_PLAN_PREFIX = "padelop:week-plan:";

type Snapshot = Record<string, unknown>;

export function exportData(): Snapshot {
  const snap: Snapshot = {};
  // Fixed keys
  for (const key of Object.values(KEYS)) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { snap[key] = JSON.parse(raw); } catch { snap[key] = raw; }
    }
  }
  // Week-plan flags
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(WEEK_PLAN_PREFIX)) snap[k] = "1";
  }
  return snap;
}

export function importData(snap: Snapshot): void {
  // Clear existing padelop keys first
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("padelop:")) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));

  for (const [key, value] of Object.entries(snap)) {
    if (!key.startsWith("padelop:")) continue;
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}

export function downloadSnapshot(): void {
  const snap = exportData();
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `padelop-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
