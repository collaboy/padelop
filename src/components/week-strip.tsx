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

function formatWeekRange(days: Date[]): string {
  const month = days[0].toLocaleDateString("en-US", { month: "short" });
  return `${month} ${days[0].getDate()}-${days[6].getDate()}`;
}

function buildWeekSummary(weekDays: Date[], gameDays: string[]): React.ReactNode {
  const gameNames = weekDays
    .filter((d) => gameDays.includes(toYMD(d)))
    .map((d) => DAY_NAMES[(d.getDay() + 6) % 7]);

  const nonGameWeekdays = weekDays
    .slice(0, 5)
    .filter((d) => !gameDays.includes(toYMD(d)));
  const restDay = nonGameWeekdays.length > 0
    ? DAY_NAMES[(nonGameWeekdays[Math.floor(nonGameWeekdays.length / 2)].getDay() + 6) % 7]
    : null;

  const bold = (name: string) => <span key={name} className="font-bold text-[var(--text)]">{name}</span>;

  const objective = <> This weeks off court focus is: <span className="font-bold text-[var(--text)]">knee strength</span>.</>;

  if (gameNames.length === 0) return <>No games scheduled this week. Focus on training and recovery.{objective}</>;

  const gameParts: React.ReactNode[] = gameNames.length === 1
    ? ["You have a game on ", bold(gameNames[0]), "."]
    : ["You have games on ", ...gameNames.slice(0, -1).flatMap((n, i) => [bold(n), i < gameNames.length - 2 ? ", " : ""]), " and ", bold(gameNames[gameNames.length - 1]), "."];

  return <>{objective}</>;
}

type Props = {
  gameDays: string[];
  selectedYMD: string;
  onToggle: (ymd: string) => void;
  onSelect: (ymd: string) => void;
};

export default function WeekStrip({ gameDays, selectedYMD, onToggle, onSelect }: Props) {
  const today = new Date();
  const todayYMD = toYMD(today);
  const todayIndex = (today.getDay() + 6) % 7;

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
  }, []);

  const selectedIndex = weekDays.findIndex((d) => toYMD(d) === selectedYMD);
  const effectiveIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const boxWidth = containerWidth > 0 ? containerWidth / 7 : 0;
  const selectedCenterX = containerWidth > 0 ? effectiveIndex * boxWidth + boxWidth / 2 : 0;
  const connectorEndX = containerWidth / 2;

  const connectorPath = containerWidth > 0
    ? `M ${selectedCenterX} 4 V 12 H ${connectorEndX} V 24`
    : "";

  const isSelectedGameDay = gameDays.includes(selectedYMD);
  const isCurrentWeek = weekOffset === 0;
  const selectedDayName = isCurrentWeek && selectedYMD === todayYMD
    ? "Today"
    : DAY_NAMES[effectiveIndex];

  return (
    <div>

      {/* Week summary */}
      <div className="pt-3 pb-1 text-center">
        <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)]" style={{ fontFamily: "monospace" }}>My Padel Week: {formatWeekRange(weekDays)}</p>
      </div>

      {/* Day cubes — full width, shared 2px borders, swipeable */}
      <div ref={containerRef} className="grid grid-cols-7" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {weekDays.map((day, i) => {
          const ymd = toYMD(day);
          const isToday = ymd === todayYMD;
          const isSelected = ymd === selectedYMD && !isToday;
          const isGame = gameDays.includes(ymd);

          return (
            <button
              key={ymd}
              onClick={() => onSelect(ymd)}
              className="aspect-square flex flex-col items-center justify-center transition-all active:scale-95"
              style={{
                background: "#2653d4",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                borderLeft: "1px solid var(--border)",
                borderRight: i === 6 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
            >
              <span
                className="text-[11px] md:text-sm font-extrabold tracking-wider uppercase"
                style={{ color: "#ffffff" }}
              >
                {DAY_ABBREVS[i]}
              </span>
              <span
                className="text-base md:text-xl font-bold mt-0.5 leading-none"
                style={{ color: "#ffffff", fontFamily: "var(--font-hanken)" }}
              >
                {isGame ? "🎾" : day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Game labels */}
      <div className="grid grid-cols-7">
        {weekDays.map((day) => {
          const ymd = toYMD(day);
          const isGame = gameDays.includes(ymd);
          return (
            <div key={ymd} className="flex items-center justify-center h-4">
              {isGame && <span className="text-[8px] font-bold tracking-widest uppercase text-[var(--muted)]">GAME</span>}
            </div>
          );
        })}
      </div>

      {/* Connector SVG */}
      <div className="relative w-full h-6 overflow-visible">
        {connectorPath && (
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${containerWidth} 24`} preserveAspectRatio="none" fill="none">
            <path
              d={connectorPath}
              stroke="#2653d4"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {/* Today heading */}
      <div className="text-center">
        <h2
          className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text)] leading-tight"
          style={{ fontFamily: "var(--font-hanken)" }}
        >
          {selectedDayName}
        </h2>
        {isSelectedGameDay && (
          <p className="flex items-center justify-center gap-2 text-2xl md:text-[2.5rem] font-bold tracking-tight leading-tight" style={{ color: "var(--text)", fontFamily: "var(--font-hanken)" }}>
            GAME DAY
          </p>
        )}
      </div>
      <div className="px-5 md:px-12 mt-2">
        <p className="text-sm font-bold tracking-widest uppercase text-[var(--muted)]">Today's Objectives</p>
        <p className="text-xs tracking-widest uppercase text-[var(--muted)] mt-0.5">Pre-Game:</p>
      </div>
    </div>
  );
}
