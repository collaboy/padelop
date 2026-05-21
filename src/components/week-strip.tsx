"use client";

import { useRef, useState, useEffect } from "react";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getWeekDays(today: Date): Date[] {
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(days: Date[]): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${days[0].toLocaleDateString("en-US", opts)} – ${days[6].toLocaleDateString("en-US", opts)}`;
}

type Props = {
  gameDays: string[];
  onToggle: (ymd: string) => void;
};

export default function WeekStrip({ gameDays, onToggle }: Props) {
  const today = new Date();
  const todayYMD = toYMD(today);
  const todayIndex = (today.getDay() + 6) % 7;
  const weekDays = getWeekDays(today);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const todayCenterX = containerWidth > 0 ? ((todayIndex + 0.5) / 7) * containerWidth : 0;
  const labelCenterX = containerWidth / 2;
  const connectorH = 40;
  const connectorPath =
    Math.abs(todayCenterX - labelCenterX) < 8
      ? `M ${todayCenterX} 0 L ${todayCenterX} ${connectorH}`
      : `M ${todayCenterX} 0 L ${todayCenterX} ${connectorH / 2} L ${labelCenterX} ${connectorH / 2} L ${labelCenterX} ${connectorH}`;

  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-[var(--muted)] mb-3">
        This Week: {formatWeekRange(weekDays)}
      </p>

      <div ref={containerRef} className="flex gap-1.5">
        {weekDays.map((day, i) => {
          const ymd = toYMD(day);
          const isToday = ymd === todayYMD;
          const isGame = gameDays.includes(ymd);

          return (
            <button
              key={ymd}
              onClick={() => onToggle(ymd)}
              aria-pressed={isGame}
              aria-label={`${DAY_NAMES[i]} ${day.getDate()}${isGame ? ", game day — tap to remove" : " — tap to mark as game day"}`}
              className="flex-1 flex flex-col items-center pt-2.5 pb-3 rounded-xl transition-all active:scale-95"
              style={{
                background: isToday ? "var(--green-light)" : "var(--surface)",
                borderTop: isGame ? "3px solid var(--green)" : "3px solid transparent",
                cursor: "pointer",
              }}
            >
              <span
                className="text-[10px] font-medium tracking-widest mb-2"
                style={{ color: isToday ? "var(--green)" : "var(--muted)" }}
              >
                {DAY_LETTERS[i]}
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: isToday ? "var(--green)" : "var(--text)" }}
              >
                {day.getDate()}
              </span>
              <span
                className="mt-1.5 w-1 h-1 rounded-full transition-opacity"
                style={{
                  background: "var(--green)",
                  opacity: isGame ? 1 : 0,
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="relative" style={{ height: connectorH }}>
        {containerWidth > 0 && (
          <svg width="100%" height={connectorH} className="absolute inset-0" style={{ overflow: "visible" }}>
            <path
              d={connectorPath}
              fill="none"
              stroke="var(--green)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[var(--green)] mb-1">
          Today
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[var(--text)]">
          {DAY_NAMES[todayIndex]}
        </h2>
      </div>
    </div>
  );
}
