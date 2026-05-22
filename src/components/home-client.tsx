"use client";

import { useState, useEffect, useRef } from "react";
import WeekStrip, { formatWeekRange } from "./week-strip";
import Recommendations from "./recommendations";

const STORAGE_KEY = "padelop:game-days";

function offsetYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

export default function HomeClient() {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const [gameDays, setGameDays] = useState<string[]>(getWeekGameDays());
  const [selectedYMD, setSelectedYMD] = useState(todayYMD);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [topSlide, setTopSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<"today" | "week" | null>("today");
  const topTouchStart = useRef(0);

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
  const todayDayType = gameDays.includes(todayYMD)
    ? "Game Day"
    : gameDays.includes(offsetYMD(todayYMD, -1))
    ? "Recovery Day"
    : "Training Day";


  const pct = 71;

  return (
    <div className="pb-8">
      {/* Optimization score card */}
      <div className="pt-[80px] px-5 md:px-12 pb-4 bg-[var(--bg)]">
      <div className="w-full bg-[var(--surface)] flex flex-col items-center border border-[var(--border)] rounded-2xl shadow-sm px-5 pt-3 pb-4">
        <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-2">Padel Optimization Score</p>
        <span
          className="text-6xl font-extrabold leading-none"
          style={{ color: "var(--green)", fontFamily: "var(--font-hanken)" }}
        >
          {pct}
        </span>
        <span className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mt-0.5">out of 100</span>
        <div className="w-full mt-3">
          <div className="relative">
            <div
              className="w-full h-6 rounded-full overflow-hidden"
              style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)" }}
            />
            <div className="absolute" style={{ left: `calc(${pct}% - 5px)`, top: "24px" }}>
              <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
                <polygon points="5,0 0,7 10,7" fill="#171c1f" />
              </svg>
            </div>
          </div>
        </div>
        <div className="w-full mt-5 rounded-xl px-3 py-3 flex flex-col items-center gap-3" style={{ background: "var(--bg)" }}>
          <p className="text-sm font-bold text-[var(--text)] leading-none flex items-center justify-center gap-1.5">
            Sleep 8h Tonight
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="0" y1="5" x2="13" y2="5" />
              <polyline points="9,1 13,5 9,9" />
            </svg>
            <span style={{ color: "var(--green)" }}>+7%</span>
          </p>
          <button
            className="px-4 py-1.5 rounded-full border border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--text)] bg-white shadow-sm active:scale-95 transition-transform flex items-center gap-1.5"
          >
            Optimize Me
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,1 8,5 3,9" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {/* Tab switcher card */}
      <div className="px-5 md:px-12 pt-2 bg-[var(--bg)]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex justify-center">
            <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)]">Things to do...</p>
          </div>
          <div className="flex">
            <button
              onClick={() => setActiveTab(activeTab === "today" ? null : "today")}
              className="flex-1 py-4 flex items-center justify-center gap-1.5 border-r border-[var(--border)] active:opacity-80 transition-opacity"
              style={{ background: activeTab === "today" ? "#2653d4" : "transparent" }}
            >
              <p className="text-sm font-bold leading-none" style={{ color: activeTab === "today" ? "#ffffff" : "var(--text)" }}>Today</p>
            </button>
            <button
              onClick={() => setActiveTab(activeTab === "week" ? null : "week")}
              className="flex-1 py-4 flex items-center justify-center gap-1.5 active:opacity-80 transition-opacity"
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
            {isSelectedGameDay ? (
              <GameDaySection />
            ) : (
              <Recommendations selectedYMD={selectedYMD} gameDays={gameDays} />
            )}
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

      {/* FAB */}
      <button
        className="fixed bottom-24 right-5 md:bottom-10 md:right-10 w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform z-40"
        style={{ background: "var(--lime)" }}
        aria-label="Add"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
