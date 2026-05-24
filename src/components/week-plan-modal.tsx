"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "padelop:game-days";
const GAME_TIMES_KEY = "padelop:game-times";
const WEEK_PLAN_PREFIX = "padelop:week-plan:";

const TIME_SLOTS = [
  { v: "morning",   label: "Morning",   hint: "Before 12" },
  { v: "afternoon", label: "Afternoon", hint: "12 – 17h" },
  { v: "evening",   label: "Evening",   hint: "17 – 20h" },
  { v: "night",     label: "Night",     hint: "After 20h" },
] as const;
type TimeSlot = typeof TIME_SLOTS[number]["v"];

function todayYMDStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetYMD(ymd: string, days: number): string {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMondayYMD(): string {
  const today = todayYMDStr();
  const dow = (new Date().getDay() + 6) % 7;
  return offsetYMD(today, -dow);
}

export default function WeekPlanModal() {
  const [open, setOpen] = useState(false);
  const [weekPlanDays, setWeekPlanDays] = useState<string[]>([]);
  const [weekPlanTimes, setWeekPlanTimes] = useState<Record<string, TimeSlot>>({});
  const mondayYMD = getMondayYMD();

  useEffect(() => {
    const handle = () => {
      try {
        const days = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[];
        const times = JSON.parse(localStorage.getItem(GAME_TIMES_KEY) || "{}") as Record<string, TimeSlot>;
        setWeekPlanDays(days);
        setWeekPlanTimes(times);
      } catch {
        setWeekPlanDays([]);
        setWeekPlanTimes({});
      }
      setOpen(true);
    };
    window.addEventListener("open-week-plan", handle);
    return () => window.removeEventListener("open-week-plan", handle);
  }, []);

  if (!open) return null;

  const missingTimes = weekPlanDays.filter((ymd) => !weekPlanTimes[ymd]);
  const canSave = weekPlanDays.length > 0 && missingTimes.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-[28px] shadow-2xl overflow-y-auto max-h-[88vh]"
        style={{ fontFamily: "var(--font-hanken)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#f4f4f4]">
          <div>
            <p className="text-[18px] font-bold text-[var(--text)]">Plan this week</p>
            <p className="text-[13px] text-[var(--muted)] mt-0.5">When are you playing? Tap the days.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-5 pb-8 flex flex-col gap-6">
          {/* Day tiles */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const ymd = offsetYMD(mondayYMD, i);
              const d = new Date(ymd);
              const selected = weekPlanDays.includes(ymd);
              const dayLetter = ["M", "T", "W", "T", "F", "S", "S"][i];
              return (
                <button
                  key={ymd}
                  onClick={() =>
                    setWeekPlanDays((prev) =>
                      prev.includes(ymd) ? prev.filter((x) => x !== ymd) : [...prev, ymd]
                    )
                  }
                  className="flex flex-col items-center rounded-xl py-3 gap-1 border-2 transition-all active:scale-95"
                  style={{
                    borderColor: selected ? "#2653d4" : "var(--border)",
                    background: selected ? "#2653d4" : "var(--bg)",
                  }}
                >
                  <span className="text-[9px] font-bold uppercase" style={{ color: selected ? "rgba(255,255,255,0.7)" : "var(--muted)" }}>
                    {dayLetter}
                  </span>
                  <span className="text-sm font-bold" style={{ color: selected ? "#fff" : "var(--text)" }}>
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time pickers for selected days */}
          {weekPlanDays.length > 0 && (
            <div className="flex flex-col gap-4">
              {weekPlanDays
                .slice()
                .sort()
                .map((ymd) => {
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
                            style={{
                              borderColor: selected === v ? "#2653d4" : "var(--border)",
                              background: selected === v ? "#eef2ff" : "var(--bg)",
                            }}
                          >
                            <span className="text-[11px] font-bold" style={{ color: selected === v ? "#2653d4" : "var(--text)" }}>
                              {label}
                            </span>
                            <span className="text-[9px] text-[var(--muted)]">{hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Validation hint */}
          {!canSave && weekPlanDays.length > 0 && (
            <p className="text-xs text-center text-[var(--muted)]">
              Pick a time for{" "}
              {missingTimes
                .map((ymd) => new Date(ymd).toLocaleDateString("en-US", { weekday: "long" }))
                .join(", ")}
            </p>
          )}

          <button
            disabled={!canSave}
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(weekPlanDays));
              localStorage.setItem(GAME_TIMES_KEY, JSON.stringify(weekPlanTimes));
              localStorage.setItem(WEEK_PLAN_PREFIX + mondayYMD, "1");
              window.dispatchEvent(new CustomEvent("week-plan-saved"));
              setOpen(false);
            }}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide transition-all"
            style={{
              background: canSave ? "#2653d4" : "var(--border)",
              color: canSave ? "#fff" : "var(--muted)",
              cursor: canSave ? "pointer" : "default",
            }}
          >
            Set my week
          </button>
        </div>
      </div>
    </div>
  );
}
