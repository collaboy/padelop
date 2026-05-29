"use client";

import React, { useState, useEffect } from "react";
import Nav2a from "@/components/nav2a";

const pad = (n: number) => String(n).padStart(2, "0");
const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

type ScheduleItem = { time: string; title: string; subtitle: string; color?: string };
type DayType = "match" | "recovery" | "rest";

function buildSchedule(dayType: DayType, matchTime: string | null): ScheduleItem[] {
  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 18;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "18:30";

  const schedules: Record<DayType, ScheduleItem[]> = {
    match: [
      { time: "07:00", title: "Wake up & hydrate",   subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",            subtitle: "Oats, eggs, fruit" },
      { time: "09:00", title: "Morning mobility",     subtitle: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Pre-game meal",       subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation", subtitle: "Dynamic drills, 30 min" },
      { time: mt,                    title: "Match",               subtitle: "Game time" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down",subtitle: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",       subtitle: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down",            subtitle: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",   subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Light breakfast",      subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Recovery walk",        subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Foam roll & stretch",  subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Protein-rich lunch",   subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower",          subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",               subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Early wind down",      subtitle: "Sleep is your best recovery tool tonight" },
    ],
    rest: [
      { time: "07:00", title: "Wake up & hydrate",   subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",            subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",       subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "12:30", title: "Balanced lunch",       subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",      subtitle: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",               subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",        subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",            subtitle: "No screens, consistent bedtime" },
    ],
  };
  return schedules[dayType];
}

function getCurrentIndex(schedule: ScheduleItem[]): number {
  const curMins = new Date().getHours() * 60 + new Date().getMinutes();
  if (curMins >= toMins(schedule[schedule.length - 1].time)) return schedule.length - 1;
  for (let i = 0; i < schedule.length - 1; i++) {
    if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) return i;
  }
  return 0;
}

const DAY_TYPE_LABELS: Record<DayType, string> = {
  match: "Game Day",
  recovery: "Recovery Day",
  rest: "Rest Day",
};

const DAY_TYPE_COLORS: Record<DayType, string> = {
  match: "#2653d4",
  recovery: "#7c3aed",
  rest: "#5a7055",
};

function buildMonthCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Mon-start
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function Today2a() {
  const [dayType, setDayType] = useState<DayType>("rest");
  const [matchDate, setMatchDate] = useState<string | null>(null);
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        setMatchDate(m.date ?? null);
        setMatchTime(m.time ?? null);
        if (m.date === today) setDayType("match");
        else if (m.date === yesterday) setDayType("recovery");
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const schedule = buildSchedule(dayType, matchTime);
  const currentIdx = getCurrentIndex(schedule);
  const curMins = now.getHours() * 60 + now.getMinutes();

  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const cells = buildMonthCalendar(year, month);

  // Mark match days in this month
  const matchDayNum = matchDate?.startsWith(`${year}-${pad(month + 1)}`)
    ? parseInt(matchDate.split("-")[2])
    : null;

  const color = DAY_TYPE_COLORS[dayType];

  return (
    <main
      className="h1-font min-h-screen flex flex-col gap-4 px-4 pt-4 pb-44"
      style={{ background: "#e2e5e9" }}
    >
      {/* Header */}
      <div className="bg-white rounded-[24px] px-6 py-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-between">
          <p className="text-[26px] font-bold text-[#1a1c1c] leading-tight tracking-tight">Today</p>
          <span
            className="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full"
            style={{ background: color + "18", color }}
          >
            {DAY_TYPE_LABELS[dayType]}
          </span>
        </div>
        <p className="text-[14px] text-[#8a9096] mt-1">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Full Day Schedule */}
      <div className="bg-white rounded-[24px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div className="px-6 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid #f4f4f4" }}>
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055]">Today&apos;s Schedule</p>
        </div>
        <div className="px-5 py-2">
          {schedule.map((item, i) => {
            const isPast = curMins > toMins(item.time) && i < currentIdx;
            const isCurrent = i === currentIdx;
            const isFuture = i > currentIdx;
            return (
              <div
                key={i}
                className="flex gap-4 py-3"
                style={{ borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f4" : "none" }}
              >
                {/* Time + dot column */}
                <div className="flex flex-col items-center pt-0.5 w-12 flex-shrink-0">
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: isCurrent ? color : isPast ? "#c4c7c7" : "#8a9096" }}
                  >
                    {item.time}
                  </p>
                </div>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 rounded-2xl px-3 py-2"
                  style={isCurrent ? { background: color + "0e", border: `1.5px solid ${color}30` } : {}}
                >
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <div
                        className="w-2 h-2 rounded-full animate-breathe flex-shrink-0"
                        style={{ background: color, ["--glow" as string]: color }}
                      />
                    )}
                    <p
                      className="text-[14px] font-bold leading-tight"
                      style={{ color: isPast ? "#b0b4b8" : "#1a1c1c" }}
                    >
                      {item.title}
                    </p>
                  </div>
                  <p
                    className="text-[12px] mt-0.5 leading-snug"
                    style={{ color: isPast ? "#c8cbcf" : isFuture ? "#8a9096" : "#4a5050" }}
                  >
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month at a Glance */}
      <div className="bg-white rounded-[24px] px-5 pt-5 pb-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055]">Month at a Glance</p>
          <p className="text-[13px] font-semibold text-[#6b7480]">{MONTH_NAMES[month]} {year}</p>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map(d => (
            <div key={d} className="text-center text-[10px] font-bold tracking-wide text-[#b0b4b8] py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day === todayDate;
            const isMatch = day === matchDayNum;
            return (
              <div key={i} className="flex flex-col items-center py-1">
                {day ? (
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-semibold relative"
                    style={
                      isToday
                        ? { background: "#2653d4", color: "#fff" }
                        : { color: "#1a1c1c" }
                    }
                  >
                    {day}
                    {isMatch && !isToday && (
                      <span
                        className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: "#2653d4" }}
                      />
                    )}
                    {isMatch && isToday && (
                      <span
                        className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: "#fff" }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid #f4f4f4" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#2653d4" }} />
            <span className="text-[11px] text-[#8a9096]">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#2653d4", opacity: 0.4 }} />
            <span className="text-[11px] text-[#8a9096]">Match</span>
          </div>
        </div>
      </div>

      <Nav2a />
    </main>
  );
}
