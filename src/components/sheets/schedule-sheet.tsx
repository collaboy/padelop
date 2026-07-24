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

const DAY_TYPE_INFO: { label: string; color: string; desc: string }[] = [
  { label: "Match Day",       color: "#2653d4", desc: "Game day. Trust your prep and enjoy every point." },
  { label: "Pre-Match Day",   color: "#d97706", desc: "Match tomorrow. Carb up, rest, and sleep early." },
  { label: "Recovery Day",    color: "#7c3aed", desc: "Day after a match. Light movement, protein, hydration." },
  { label: "Training Day",    color: "#16a34a", desc: "Build the habit. Small consistent actions compound." },
  { label: "Maintenance Day", color: "#0e7490", desc: "Between cycles. Stay loose and let the body absorb the work." },
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
  const [dayTypeExpanded, setDayTypeExpanded] = useState(false);
  const [modalIdx, setModalIdx] = useState<number | null>(null);
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function load() {
      const todayStr = localToday();
      let nm: StoredMatch | null = null;
      try { nm = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
      let upcoming: StoredMatch[] = [];
      try { upcoming = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]"); } catch {}
      let gameDays: string[] = [];
      try { gameDays = JSON.parse(localStorage.getItem("padelop:game-days") || "[]"); } catch {}
      const dt = getDayType(gameDays, nm, upcoming);
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
  const done = (schedDone[todayKey] ?? []).length;
  const total = schedule.length;
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

  const modalItem = modalIdx !== null ? schedule[modalIdx] : null;
  const modalEndTime = modalIdx !== null ? schedule[modalIdx + 1]?.time : undefined;
  const modalIsComplete = modalItem ? (schedDone[todayKey] ?? []).includes(modalItem.title) : false;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "55dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => { e.stopPropagation(); setDayTypeExpanded(false); }}>
          <div style={{ background: "#16a34a14", flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#16a34a40", margin: "12px auto 10px" }} />
            <div style={{ padding: "0 18px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: "-0.01em", color: "#16a34a" }}>Schedule</p>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", background: "#16a34a20", borderRadius: 999, padding: "3px 12px" }}>{done}/{total}</span>
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
          <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 8 }}>
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
          zIndex={300}
        />
      )}
    </>
  );
}
