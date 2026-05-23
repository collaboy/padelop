"use client";

import { useState, useEffect } from "react";
import WeekStrip, { formatWeekRange } from "./week-strip";
import Recommendations from "./recommendations";

const STORAGE_KEY = "padelop:game-days";

type HydrationEntry = { ts: string; litres: string; timing: string[]; quality: string; urine: string; };

function FaceIcon({ mood, size = 28, color = "currentColor" }: { mood: "bad" | "ok" | "great"; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      {mood === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
      {mood === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
      {mood === "great" && <path d="M8 14c1 2 6 2 8 0" />}
      <circle cx="9" cy="9.5" r="0.8" fill={color} stroke="none" />
      <circle cx="15" cy="9.5" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

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

const LITRE_MAP: Record<string, number> = {
  "<1L": 0.8, "1–1.5L": 1.25, "1.5–2L": 1.75, "2–2.5L": 2.25, "2.5–3L": 2.75, "3L+": 3.5,
};
const HYDRATION_TARGET = 3.5;

export default function RecoveryClient() {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const [gameDays, setGameDays] = useState<string[]>(getWeekGameDays());
  const [selectedYMD, setSelectedYMD] = useState(todayYMD);
  const [planOpen, setPlanOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "week" | null>(null);
  const [hydrationOpen, setHydrationOpen] = useState(false);
  const [hydrationLog, setHydrationLog] = useState({ litres: "", timing: [] as string[], quality: "", urine: "" });
  const [lastHydration, setLastHydration] = useState<HydrationEntry | null>(null);

  useEffect(() => {
    try {
      const logs = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
      if (logs.length > 0) setLastHydration(logs[0]);
    } catch {}
  }, []);

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
            <Recommendations selectedYMD={selectedYMD} gameDays={gameDays} doneItems={new Set()} onToggle={() => {}} />
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

      {/* Hydration card */}
      {(() => {
        const current = lastHydration ? (LITRE_MAP[lastHydration.litres] ?? 0) : 0;
        const pct = lastHydration ? Math.round(Math.min(current / HYDRATION_TARGET * 100, 100)) : 0;
        const remaining = Math.max(0, Math.round((HYDRATION_TARGET - current) * 10) / 10);
        return (
          <div className="px-5 md:px-12 pt-4 pb-3 bg-[var(--bg)]">
            <button onClick={() => setHydrationOpen(true)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 text-left active:opacity-80 transition-opacity shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-0.5">Hydration</p>
                  {lastHydration
                    ? <p className="text-base font-bold text-[var(--text)]">{lastHydration.litres} <span className="text-sm font-normal text-[var(--muted)]">/ {HYDRATION_TARGET}L</span></p>
                    : <p className="text-base font-bold text-[var(--muted)]">Not logged yet</p>
                  }
                </div>
                <span className="text-2xl font-extrabold" style={{ color: "#2653d4", fontFamily: "var(--font-hanken)" }}>{pct}%</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#2653d4" }} />
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-xs text-[var(--muted)]">Target: {HYDRATION_TARGET}L today</p>
                {lastHydration && <p className="text-xs font-bold" style={{ color: "#2653d4" }}>+{remaining}L to go</p>}
              </div>
            </button>
          </div>
        );
      })()}

      {/* Hydration Modal */}
      {hydrationOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setHydrationOpen(false)}>
          <div className="w-full max-w-[640px] bg-white rounded-t-3xl shadow-2xl px-6 pt-5 pb-10 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5" />
            <p className="text-lg font-extrabold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-hanken)" }}>Hydration Check</p>
            <p className="text-xs text-[var(--muted)] mb-6">Log your water intake today</p>

            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">How much have you drunk today?</p>
              <div className="flex gap-3">
                {["<1L", "1–1.5L", "1.5–2L", "2–2.5L", "2.5–3L", "3L+"].map((n) => {
                  const selected = hydrationLog.litres === n;
                  return (
                    <button key={n} onClick={() => setHydrationLog((l) => ({ ...l, litres: n }))}
                      className="flex-1 py-2.5 rounded-2xl border-2 text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)", color: selected ? "#2653d4" : "var(--muted)" }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">What did you drink?</p>
              <div className="flex flex-wrap gap-2">
                {["Water", "Sparkling water", "Sports drink", "Coconut water", "Tea / Coffee", "Juice", "Milk", "Protein shake"].map((drink) => {
                  const selected = hydrationLog.timing.includes(drink);
                  return (
                    <button key={drink}
                      onClick={() => setHydrationLog((l) => ({ ...l, timing: selected ? l.timing.filter((d) => d !== drink) : [...l.timing, drink] }))}
                      className="px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)", color: selected ? "#2653d4" : "var(--muted)" }}>
                      {drink}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-1">Urine colour check</p>
              <p className="text-[10px] text-[var(--muted)] mb-3">Best proxy for hydration status</p>
              <div className="flex gap-2">
                {[
                  { v: "clear", label: "Clear", bg: "#f0f9ff", border: "#bae6fd" },
                  { v: "pale", label: "Pale yellow", bg: "#fefce8", border: "#fde047" },
                  { v: "yellow", label: "Yellow", bg: "#fef9c3", border: "#facc15" },
                  { v: "dark", label: "Dark", bg: "#fef3c7", border: "#f59e0b" },
                  { v: "brown", label: "Brown", bg: "#fdf4dc", border: "#b45309" },
                ].map(({ v, label, bg, border }) => {
                  const selected = hydrationLog.urine === v;
                  return (
                    <button key={v} onClick={() => setHydrationLog((l) => ({ ...l, urine: v }))}
                      className="flex-1 py-2.5 rounded-2xl border-2 text-[10px] font-bold transition-all active:scale-95 text-center"
                      style={{ borderColor: selected ? border : "var(--border)", background: selected ? bg : "var(--bg)", color: "var(--muted)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">How do you feel?</p>
              <div className="flex gap-3">
                {([["bad", "Thirsty"], ["ok", "OK"], ["great", "Hydrated"]] as const).map(([v, label]) => {
                  const selected = hydrationLog.quality === v;
                  return (
                    <button key={v} onClick={() => setHydrationLog((l) => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: selected ? "#2653d4" : "var(--border)", background: selected ? "#eef2ff" : "var(--bg)" }}>
                      <FaceIcon mood={v} color={selected ? "#2653d4" : "var(--muted)"} />
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: selected ? "#2653d4" : "var(--muted)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                const entry: HydrationEntry = { ...hydrationLog, ts: new Date().toISOString() };
                try {
                  const prev = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
                  localStorage.setItem("padelop:hydration-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                } catch {}
                setLastHydration(entry);
                setHydrationOpen(false);
              }}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-white active:scale-95 transition-transform"
              style={{ background: "#2653d4" }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
