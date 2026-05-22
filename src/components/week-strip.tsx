"use client";

import React, { useRef, useState, useEffect } from "react";

const DAY_ABBREVS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getWeekDays(today: Date, offset = 0): Date[] {
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatWeekRange(days: Date[]): string {
  const month = days[0].toLocaleDateString("en-US", { month: "short" });
  return `${month} ${days[0].getDate()}-${days[6].getDate()}`;
}

type Props = {
  gameDays: string[];
  selectedYMD: string;
  onToggle: (ymd: string) => void;
  onSelect: (ymd: string) => void;
  optimizationPct?: number;
  planOpen: boolean;
  onPlanOpenChange: (v: boolean) => void;
  hideHeading?: boolean;
};

export default function WeekStrip({ gameDays, selectedYMD, onSelect, planOpen, onPlanOpenChange, hideHeading = false }: Props) {
  const today = new Date();
  const todayYMD = toYMD(today);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDays = getWeekDays(today, weekOffset);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const touchStartX = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) {
      setWeekOffset((o) => o + 1);
      onSelect(toYMD(getWeekDays(today, weekOffset + 1)[0]));
    } else if (delta > 50) {
      setWeekOffset((o) => o - 1);
      onSelect(toYMD(getWeekDays(today, weekOffset - 1)[0]));
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [planOpen]);

  const selectedIndex = weekDays.findIndex((d) => toYMD(d) === selectedYMD);
  const effectiveIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const boxWidth = containerWidth > 0 ? containerWidth / 7 : 0;
  const selectedCenterX = containerWidth > 0 ? effectiveIndex * boxWidth + boxWidth / 2 : 0;

  const isSelectedGameDay = gameDays.includes(selectedYMD);
  const prevYMD = toYMD(new Date(new Date(selectedYMD).getTime() - 86400000));
  const dayType = isSelectedGameDay
    ? "game day"
    : gameDays.includes(prevYMD)
    ? "recovery"
    : "training";

  return (
    <div>
      {/* Today heading */}
      {!hideHeading && (
        <div className="mt-4 px-5 md:px-12">
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)]">Today's Plan:</p>
          <h2
            className="text-xl font-bold tracking-tight text-[var(--text)] leading-snug mt-0.5"
            style={{ fontFamily: "var(--font-hanken)", textTransform: "capitalize" }}
          >
            {dayType} Day
          </h2>
        </div>
      )}

      <div className="mt-3 mx-5 md:mx-12 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center gap-4">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
        <div>
          <p className="text-sm font-normal text-[var(--text)]">Complete all objectives</p>
          <p className="text-base font-extrabold text-[var(--text)] mt-0.5">Optimization rises to 78%</p>
          <p className="text-xs font-bold mt-1" style={{ color: "var(--green)" }}>+7% improvement potential</p>
        </div>
      </div>

      {/* Modal */}
      {planOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => onPlanOpenChange(false)}
        >
          <div
            className="bg-[var(--surface)] border-b border-[var(--border)] shadow-2xl"
            style={{ marginTop: 64 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 md:px-12 h-10">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "monospace", color: "#171c1f" }}>
                Plan for {formatWeekRange(weekDays)}
              </p>
              <button
                onClick={() => onPlanOpenChange(false)}
                className="flex items-center justify-center active:scale-90 transition-transform"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#171c1f" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="2" x2="12" y2="12" />
                  <line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>

            <div
              ref={containerRef}
              className="grid grid-cols-7"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {weekDays.map((day, i) => {
                const ymd = toYMD(day);
                const isGame = gameDays.includes(ymd);
                const isPast = ymd < todayYMD;

                return (
                  <button
                    key={ymd}
                    onClick={() => { onSelect(ymd); onPlanOpenChange(false); }}
                    className="aspect-square flex flex-col items-center justify-center transition-all active:scale-95 relative overflow-hidden"
                    style={{
                      background: "#2653d4",
                      borderTop: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                      borderLeft: "1px solid var(--border)",
                      borderRight: i === 6 ? "1px solid var(--border)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {isPast && <div className="absolute inset-0 bg-black/55 pointer-events-none" />}
                    <span className="text-[11px] md:text-sm font-extrabold tracking-wider uppercase" style={{ color: "#ffffff" }}>
                      {DAY_ABBREVS[i]}
                    </span>
                    <span className="text-base md:text-xl font-bold mt-0.5 leading-none" style={{ color: "#ffffff", fontFamily: "var(--font-hanken)" }}>
                      {isGame ? "🎾" : day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full h-3">
              {containerWidth > 0 && (
                <div
                  className="absolute"
                  style={{
                    left: selectedCenterX,
                    top: 2,
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderBottom: "6px solid var(--text)",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
