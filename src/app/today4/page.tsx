"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";

const S = { fontFamily: "Inter, sans-serif" };

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
      { time: "07:00", title: "Wake up & hydrate",    subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",             subtitle: "Oats, eggs, fruit" },
      { time: "09:00", title: "Morning mobility",      subtitle: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Pre-game meal",        subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation",  subtitle: "Dynamic drills, 30 min" },
      { time: mt,                    title: "Match",                subtitle: "Game time" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",        subtitle: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down",             subtitle: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",    subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Light breakfast",       subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Recovery walk",         subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Foam roll & stretch",   subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Protein-rich lunch",    subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower",           subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",                subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Early wind down",       subtitle: "Sleep is your best recovery tool tonight" },
    ],
    rest: [
      { time: "07:00", title: "Wake up & hydrate",    subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",             subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",        subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "12:30", title: "Balanced lunch",        subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",       subtitle: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",                subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",         subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",             subtitle: "No screens, consistent bedtime" },
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

const DAY_TYPE_LABELS: Record<DayType, string> = { match: "Game Day", recovery: "Recovery Day", rest: "Rest Day" };
const DAY_TYPE_COLORS: Record<DayType, string> = { match: "#2653d4", recovery: "#7c3aed", rest: "#5a7055" };

function buildMonthCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function Today4() {
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
  const matchDayNum = matchDate?.startsWith(`${year}-${pad(month + 1)}`)
    ? parseInt(matchDate.split("-")[2])
    : null;
  const color = DAY_TYPE_COLORS[dayType];

  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 176px" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ ...S, fontSize: 26, fontWeight: 700, color: "#1a1c1c", margin: 0, letterSpacing: "-0.01em" }}>Today</p>
          <span style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 999, background: color + "18", color }}>
            {DAY_TYPE_LABELS[dayType]}
          </span>
        </div>
        <p style={{ ...S, fontSize: 14, color: "#8a9096", margin: "4px 0 0" }}>
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Full Day Schedule */}
      <div style={{ background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "20px 24px 12px", borderBottom: "1px solid #f4f4f4" }}>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a7055", margin: 0 }}>Today&apos;s Schedule</p>
        </div>
        <div style={{ padding: "8px 20px" }}>
          {schedule.map((item, i) => {
            const isPast = curMins > toMins(item.time) && i < currentIdx;
            const isCurrent = i === currentIdx;
            const isFuture = i > currentIdx;
            return (
              <div key={i} style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f4" : "none" }}>
                <div style={{ width: 48, flexShrink: 0, paddingTop: 2 }}>
                  <p style={{ ...S, fontSize: 12, fontWeight: 600, margin: 0, color: isCurrent ? color : isPast ? "#c4c7c7" : "#8a9096" }}>
                    {item.time}
                  </p>
                </div>
                <div style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: "8px 12px", ...(isCurrent ? { background: color + "0e", border: `1.5px solid ${color}30` } : {}) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isCurrent && (
                      <div className="animate-breathe" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: color, ["--glow" as string]: color }} />
                    )}
                    <p style={{ ...S, fontSize: 15, fontWeight: 700, margin: 0, color: isPast ? "#b0b4b8" : "#1a1c1c", lineHeight: 1.3 }}>{item.title}</p>
                  </div>
                  <p style={{ ...S, fontSize: 13, margin: "3px 0 0", lineHeight: 1.4, color: isPast ? "#c8cbcf" : isFuture ? "#8a9096" : "#4a5050" }}>{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month at a Glance */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a7055", margin: 0 }}>Month at a Glance</p>
          <p style={{ ...S, fontSize: 13, fontWeight: 600, color: "#6b7480", margin: 0 }}>{MONTH_NAMES[month]} {year}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {DOW.map(d => (
            <div key={d} style={{ textAlign: "center", padding: "4px 0" }}>
              <span style={{ ...S, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "#b0b4b8" }}>{d}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((day, i) => {
            const isToday = day === todayDate;
            const isMatch = day === matchDayNum;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
                {day ? (
                  <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", position: "relative", background: isToday ? "#2653d4" : "transparent" }}>
                    <span style={{ ...S, fontSize: 13, fontWeight: 600, color: isToday ? "#fff" : "#1a1c1c" }}>{day}</span>
                    {isMatch && !isToday && <span style={{ position: "absolute", bottom: 2, width: 6, height: 6, borderRadius: "50%", background: "#2653d4" }} />}
                    {isMatch && isToday && <span style={{ position: "absolute", bottom: 2, width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                ) : <div style={{ width: 32, height: 32 }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f4f4f4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4" }} />
            <span style={{ ...S, fontSize: 11, color: "#8a9096" }}>Today</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4", opacity: 0.4 }} />
            <span style={{ ...S, fontSize: 11, color: "#8a9096" }}>Match</span>
          </div>
        </div>
      </div>

      <Nav4 />
    </main>
  );
}
