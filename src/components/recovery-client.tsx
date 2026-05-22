"use client";

import { useState } from "react";
import WeekStrip, { formatWeekRange } from "./week-strip";
import Recommendations from "./recommendations";

const STORAGE_KEY = "padelop:game-days";

function offsetYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekGameDays(): string[] {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  return [monday, thursday].map((d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  );
}

export default function RecoveryClient() {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const [gameDays, setGameDays] = useState<string[]>(getWeekGameDays());
  const [selectedYMD, setSelectedYMD] = useState(todayYMD);
  const [planOpen, setPlanOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "week" | null>(null);

  const currentWeekRange = formatWeekRange((() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  })());

  function toggleGameDay(ymd: string) {
    setGameDays((prev) => {
      const next = prev.includes(ymd) ? prev.filter((d) => d !== ymd) : [...prev, ymd];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const isSelectedGameDay = gameDays.includes(selectedYMD);

  return (
    <div className="pt-[80px] pb-24">
      {/* Tab switcher card */}
      <div className="px-5 md:px-12 pt-4 bg-[var(--bg)]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex justify-center">
            <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)]">Things to do...</p>
          </div>
          <div className="flex">
            <button
              onClick={() => setActiveTab(activeTab === "today" ? null : "today")}
              className="flex-1 py-4 flex items-center justify-center border-r border-[var(--border)] active:opacity-80 transition-opacity"
              style={{ background: activeTab === "today" ? "#2653d4" : "transparent" }}
            >
              <p className="text-sm font-bold leading-none" style={{ color: activeTab === "today" ? "#ffffff" : "var(--text)" }}>Today</p>
            </button>
            <button
              onClick={() => setActiveTab(activeTab === "week" ? null : "week")}
              className="flex-1 py-4 flex items-center justify-center active:opacity-80 transition-opacity"
              style={{ background: activeTab === "week" ? "#2653d4" : "transparent" }}
            >
              <p className="text-sm font-bold leading-none" style={{ color: activeTab === "week" ? "#ffffff" : "var(--text)" }}>This Week</p>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "today" ? (
        <>
          <div className="mt-2 relative space-y-4 px-5 md:px-12 max-w-7xl mx-auto pb-2">
            <Recommendations selectedYMD={selectedYMD} gameDays={gameDays} />
          </div>
          <div className="flex justify-center pb-4">
            <button
              onClick={() => setActiveTab(null)}
              className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] active:opacity-60 transition-opacity"
            >
              Close
            </button>
          </div>
        </>
      ) : activeTab === "week" ? (
        <>
          <div className="w-full">
            <WeekStrip
              gameDays={gameDays}
              selectedYMD={selectedYMD}
              onToggle={toggleGameDay}
              onSelect={setSelectedYMD}
              planOpen={planOpen}
              onPlanOpenChange={setPlanOpen}
              hideHeading
            />
          </div>
          <div className="flex justify-center pb-4">
            <button
              onClick={() => setActiveTab(null)}
              className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] active:opacity-60 transition-opacity"
            >
              Close
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
