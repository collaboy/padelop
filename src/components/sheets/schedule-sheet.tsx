"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getScheduleData, getDayType, getTopNeedsWorkTag, pad,
  SCHEDULE_DETAILS,
  type DayType, type ScheduleItem,
} from "@/lib/schedule-data";
import { saveScheduleDoneToDb } from "@/lib/db";
import ScheduleItemModal from "./schedule-item-modal";

// Local (device) calendar date as YYYY-MM-DD — NOT toISOString(), which is UTC and
// drifts a day off from the local date for several hours around local midnight
// in timezones ahead of UTC.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type StoredMatch = { date: string; time: string };

// Same rotation logic as getDayType() in schedule-data.ts, generalized to any
// date (that function is hardcoded to "today") so the month view can classify
// every day in the grid, not just the current one.
function dayTypeForDate(dateStr: string, gameDays: string[], upcoming: StoredMatch[]): DayType {
  const next = (() => { const d = new Date(dateStr + "T12:00"); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  if (gameDays.includes(dateStr) || upcoming.some(m => m.date === dateStr)) return "match";
  if (gameDays.includes(next) || upcoming.some(m => m.date === next)) return "pre-match";
  const matchDates = [...new Set(gameDays)].filter(d => d <= dateStr).sort().reverse();
  if (matchDates.length === 0) return "baseline";
  const lastMatchDate = matchDates[0];
  const daysSince = Math.round((new Date(dateStr + "T12:00").getTime() - new Date(lastMatchDate + "T12:00").getTime()) / 86400000);
  if (daysSince <= 1) return "recovery";
  return (daysSince - 2) % 2 === 0 ? "maintenance" : "training";
}

const DAY_TYPE_INFO: { label: string; color: string; desc: string; type: DayType }[] = [
  { label: "Match Day",       color: "#2653d4", desc: "Game day. Trust your prep and enjoy every point.", type: "match" },
  { label: "Pre-Match Day",   color: "#d97706", desc: "Match tomorrow. Carb up, rest, and sleep early.", type: "pre-match" },
  { label: "Recovery Day",    color: "#7c3aed", desc: "Day after a match. Light movement, protein, hydration.", type: "recovery" },
  { label: "Training Day",    color: "#16a34a", desc: "Build the habit. Small consistent actions compound.", type: "training" },
  { label: "Maintenance Day", color: "#0e7490", desc: "Between cycles. Stay loose and let the body absorb the work.", type: "maintenance" },
];

const DAY_META: Record<DayType, { label: string; color: string }> = {
  match:        { label: "Match Day",       color: "#2653d4" },
  "pre-match":  { label: "Pre-Match Day",   color: "#d97706" },
  recovery:     { label: "Recovery Day",    color: "#7c3aed" },
  training:     { label: "Training Day",    color: "#16a34a" },
  maintenance:  { label: "Maintenance Day", color: "#0e7490" },
  baseline:     { label: "Training Day",    color: "#16a34a" },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ScheduleSheet({ open, onClose }: Props) {
  const [now, setNow] = useState(new Date());
  const [dayType, setDayType] = useState<DayType>("training");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [schedDone, setSchedDone] = useState<Record<string, string[]>>({});
  const [gameDays, setGameDays] = useState<string[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<StoredMatch[]>([]);
  const [dayTypeExpanded, setDayTypeExpanded] = useState(false);
  const [modalIdx, setModalIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayTypeFilter, setDayTypeFilter] = useState<DayType | "all">("all");
  const monthTouchStartXRef = useRef(0);
  const currentItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setDayTypeExpanded(false);
    setModalIdx(null);
    setMonthOffset(0);
    setDayTypeFilter("all");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function load() {
      const todayStr = localToday();
      let nm: StoredMatch | null = null;
      try { nm = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
      let upcoming: StoredMatch[] = [];
      try { upcoming = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]"); } catch {}
      setUpcomingMatches(upcoming);
      let gd: string[] = [];
      try { gd = JSON.parse(localStorage.getItem("padelop:game-days") || "[]"); } catch {}
      setGameDays(gd);
      const dt = getDayType(gd, nm, upcoming);
      setDayType(dt);
      const matchTime = nm?.date === todayStr ? nm.time : null;
      const tag = getTopNeedsWorkTag();
      setDrillTag(tag);
      const { schedule: s } = getScheduleData(dt === "baseline" ? "training" : dt, matchTime, tag);
      setSchedule(s);
      try { setSchedDone(JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}")); } catch {}
    }
    load();
    window.addEventListener("storage", load);
    window.addEventListener("padelop:sync-done", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("padelop:sync-done", load);
    };
  }, [open]);

  useEffect(() => {
    if (!open || schedule.length === 0) return;
    const id = setTimeout(() => {
      currentItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 300);
    return () => clearTimeout(id);
  }, [open, schedule]);

  if (!open) return null;

  const todayKey = localToday();
  const meta = DAY_META[dayType];

  function toggleDone(title: string) {
    const titles = schedDone[todayKey] ?? [];
    const next = titles.includes(title) ? titles.filter(t => t !== title) : [...titles, title];
    const updated = { ...schedDone, [todayKey]: next };
    setSchedDone(updated);
    try {
      localStorage.setItem("padelop:schedule-done", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch {}
    saveScheduleDoneToDb(todayKey, next);
  }

  const toMins = (t: string) => t.split(":").reduce((a, b, i) => a + (i === 0 ? Number(b) * 60 : Number(b)), 0);
  const curMins = now.getHours() * 60 + now.getMinutes();
  const isSleepytime = schedule.length > 0 && (now.getHours() < 7 || curMins >= toMins(schedule[schedule.length - 1].time));

  const modalItem = modalIdx !== null ? schedule[modalIdx] : null;
  const modalEndTime = modalIdx !== null ? schedule[modalIdx + 1]?.time : undefined;
  const modalIsComplete = modalItem ? (schedDone[todayKey] ?? []).includes(modalItem.title) : false;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, height: "85dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => { e.stopPropagation(); setDayTypeExpanded(false); }}>
          <div style={{ background: "#16a34a14", flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#16a34a40", margin: "12px auto 10px" }} />
            <div style={{ padding: "0 18px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: "-0.01em", color: "#16a34a" }}>Schedule</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => setViewMode("week")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 17, fontWeight: 700, color: viewMode === "week" ? "#16a34a" : "#9aa0a6" }}>Today</button>
                <span style={{ fontSize: 17, color: "#c8ccd0" }}>|</span>
                <button onClick={() => setViewMode("month")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 17, fontWeight: 700, color: viewMode === "month" ? "#16a34a" : "#9aa0a6" }}>Month</button>
              </div>
            </div>
            <div style={{ padding: "0 18px 16px" }}>
              <div onClick={e => { e.stopPropagation(); setDayTypeExpanded(v => !v); }} style={{ display: "inline-block", cursor: "pointer" }}>
                <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: meta.color, background: "#fff", borderRadius: 999, padding: "6px 16px" }}>{meta.label}</span>
              </div>
              {dayTypeExpanded && (
                <div style={{ marginTop: 12, background: "#fff", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  {DAY_TYPE_INFO.map(dt => (
                    <div key={dt.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: dt.color, background: `${dt.color}18`, borderRadius: 5, padding: "2px 8px", alignSelf: "flex-start" }}>{dt.label}</span>
                      <span style={{ fontSize: 22, color: "#5a6270", lineHeight: 1.4 }}>{dt.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
            {viewMode === "week" ? (
              <>
                {isSleepytime && (
                  <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(10,12,30,0.72)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9d6ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    <p style={{ margin: 0, fontSize: "clamp(28px, 8vw, 38px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", textAlign: "center" }}>Rest up</p>
                    <p style={{ margin: 0, fontSize: "clamp(15px, 4vw, 18px)", fontWeight: 500, color: "rgba(200,210,255,0.75)", textAlign: "center" }}>See you at 7 AM</p>
                  </div>
                )}
                {schedule.map((item, i) => {
                  const isDone = (schedDone[todayKey] ?? []).includes(item.title);
                  const isCurrent = toMins(item.time) <= curMins && (i === schedule.length - 1 || toMins(schedule[i + 1].time) > curMins);
                  const isPast = !isDone && !isCurrent && toMins(item.time) < curMins;
                  const hasDetail = !!(SCHEDULE_DETAILS[item.title] || item.isDrill);
                  return (
                    <div key={item.title}
                      ref={isCurrent ? currentItemRef : undefined}
                      onClick={() => { if (hasDetail) setModalIdx(i); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: isCurrent ? "24px 14px" : "12px 14px", background: "#fff", boxShadow: isCurrent ? `0 0 0 1.5px ${item.color}` : "0 0 0 1px #f0f0f0", cursor: hasDetail ? "pointer" : "default", opacity: isPast ? 0.45 : 1 }}>
                      <button onClick={e => { e.stopPropagation(); toggleDone(item.title); }}
                        style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${item.color}1e`, border: "none", cursor: "pointer" }}>
                        {isDone
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                          : <div style={{ width: 13, height: 13, borderRadius: "50%", background: item.color }} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "clamp(21px, 5.6vw, 24px)", fontWeight: 700, color: isDone ? "#9aa0a6" : "#1a1c1c", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.25 }}>{item.title}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 18, color: "#8a9096" }}>{isCurrent ? "Now · " : ""}{item.time}</p>
                      </div>
                      {hasDetail && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (() => {
              const cursor = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
              const year = cursor.getFullYear();
              const month = cursor.getMonth();
              const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
              const firstOfMonth = new Date(year, month, 1);
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Monday-start offset
              const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
              return (
                <div
                  style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 0 0 1px #f0f0f0" }}
                  onTouchStart={e => { monthTouchStartXRef.current = e.touches[0].clientX; }}
                  onTouchEnd={e => {
                    const dx = e.changedTouches[0].clientX - monthTouchStartXRef.current;
                    if (dx < -50) setMonthOffset(o => o + 1);
                    else if (dx > 50) setMonthOffset(o => o - 1);
                  }}
                >
                  <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700, color: "#1a1c1c", textAlign: "center" }}>{monthLabel}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <span key={i} style={{ fontSize: 13, fontWeight: 700, color: "#9aa0a6", textAlign: "center" }}>{d}</span>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {cells.map((dayNum, i) => {
                      if (dayNum === null) return <div key={i} />;
                      const dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
                      const isToday = dateStr === todayKey;
                      const dt = dayTypeForDate(dateStr, gameDays, upcomingMatches);
                      const isMatched = dayTypeFilter === "all" || dayTypeFilter === dt;
                      const color = isMatched ? DAY_META[dt].color : "transparent";
                      const isCompleted = (schedDone[dateStr] ?? []).length > 0;
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0" }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: color,
                            boxShadow: isToday ? "0 0 0 2px #fff, 0 0 0 3.5px #1a1c1c" : "none",
                          }}>
                            <span style={{ fontSize: 15, fontWeight: isMatched ? 700 : 500, color: isMatched ? "#fff" : "#c0c4c8" }}>{dayNum}</span>
                          </div>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: isCompleted ? "#1a1c1c" : "transparent" }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
                    <button
                      onClick={() => setDayTypeFilter("all")}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: dayTypeFilter === "all" ? "#f0f1f3" : "none", border: "none", borderRadius: 999, padding: "4px 12px", cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 14, fontWeight: dayTypeFilter === "all" ? 700 : 500, color: dayTypeFilter === "all" ? "#1a1c1c" : "#6b7480" }}>All</span>
                    </button>
                    {DAY_TYPE_INFO.map(dt => (
                      <button
                        key={dt.label}
                        onClick={() => setDayTypeFilter(f => f === dt.type ? "all" : dt.type)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: dayTypeFilter === dt.type ? "#f0f1f3" : "none", border: "none", borderRadius: 999, padding: "4px 10px 4px 4px", cursor: "pointer" }}
                      >
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: dt.color }} />
                        <span style={{ fontSize: 14, fontWeight: dayTypeFilter === dt.type ? 700 : 500, color: dayTypeFilter === dt.type ? "#1a1c1c" : "#6b7480" }}>{dt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {modalItem && (
        <ScheduleItemModal
          item={modalItem}
          endTime={modalEndTime}
          drillTag={drillTag}
          isComplete={modalIsComplete}
          onComplete={() => toggleDone(modalItem.title)}
          onClosed={() => setModalIdx(null)}
          swipeLabelText="Swipe to complete (+1 pt)"
          zIndex={300}
        />
      )}
    </>
  );
}
