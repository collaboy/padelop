"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getScheduleData, getDayType, getTopNeedsWorkTag,
  SCHEDULE_DETAILS, DRILL_LIBRARY, DEFAULT_DRILL,
  type DayType, type ScheduleItem,
} from "@/lib/schedule-data";
import { saveScheduleDoneToDb } from "@/lib/db";

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
  const [modalClosing, setModalClosing] = useState(false);
  const [expandedMealIdx, setExpandedMealIdx] = useState<number | null>(null);
  const [checkedMeals, setCheckedMeals] = useState<Set<number>>(new Set());
  const [swipeX, setSwipeX] = useState(0);
  const swipeTrackRef = useRef<HTMLDivElement & { _startX?: number }>(null);

  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function load() {
      const todayStr = new Date().toISOString().slice(0, 10);
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

  if (!open) return null;

  const todayKey = new Date().toISOString().slice(0, 10);
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

  function closeModal() {
    setModalClosing(true);
    setTimeout(() => { setModalIdx(null); setModalClosing(false); }, 320);
  }

  function handleSchedDone() {
    if (modalIdx === null) return;
    const item = schedule[modalIdx];
    const isComplete = (schedDone[todayKey] ?? []).includes(item.title);
    toggleDone(item.title);
    if (!isComplete) { setTimeout(closeModal, 350); } else { closeModal(); }
  }

  const toMins = (t: string) => t.split(":").reduce((a, b, i) => a + (i === 0 ? Number(b) * 60 : Number(b)), 0);
  const curMins = now.getHours() * 60 + now.getMinutes();

  const modalItem = modalIdx !== null ? schedule[modalIdx] : null;
  const modalDetail = modalItem ? SCHEDULE_DETAILS[modalItem.title] : undefined;
  const modalIsMeal = modalDetail?.type === "meal";
  const modalIsInfo = modalDetail?.type === "info";
  const modalIsExercise = modalDetail?.type === "exercise";
  const modalIsDrill = !!modalItem?.isDrill;
  const drillDef = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
  const modalIsComplete = modalItem ? (schedDone[todayKey] ?? []).includes(modalItem.title) : false;

  const renderSteps = (stepList: { step: string; cue: string; reps: string }[]) => (
    <div className="flex flex-col gap-3 mt-3">
      {stepList.map((s, i) => (
        <div key={i} className="flex flex-col items-start p-3">
          <p className="text-[17px] font-semibold text-[#1a1c1c] leading-snug" style={{ margin: 0 }}>{s.step}</p>
          <p className="text-[14px] text-[#6b7480] mt-1 leading-snug" style={{ margin: 0 }}>{s.cue}</p>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#2653d420", color: "#2653d4" }}>{s.reps}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => { e.stopPropagation(); setDayTypeExpanded(false); }}>
          <div style={{ background: "#16a34a14", flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#16a34a40", margin: "12px auto 10px" }} />
            <div style={{ padding: "0 18px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#16a34a" }}>Schedule</p>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", background: "#16a34a20", borderRadius: 999, padding: "3px 12px" }}>{done}/{total}</span>
            </div>
            <div style={{ padding: "0 18px 16px" }}>
              <div onClick={e => { e.stopPropagation(); setDayTypeExpanded(v => !v); }} style={{ display: "inline-block", cursor: "pointer" }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: meta.color, background: "#fff", borderRadius: 999, padding: "6px 16px" }}>{meta.label}</span>
              </div>
              {dayTypeExpanded && (
                <div style={{ marginTop: 12, background: "#fff", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  {DAY_TYPE_INFO.map(dt => (
                    <div key={dt.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: dt.color, background: `${dt.color}18`, borderRadius: 5, padding: "2px 8px", alignSelf: "flex-start" }}>{dt.label}</span>
                      <span style={{ fontSize: 16, color: "#5a6270", lineHeight: 1.4 }}>{dt.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px" }}>
            {schedule.map((item, i) => {
              const isDone = (schedDone[todayKey] ?? []).includes(item.title);
              const isCurrent = toMins(item.time) <= curMins && (i === schedule.length - 1 || toMins(schedule[i + 1].time) > curMins);
              const isPast = !isDone && !isCurrent && toMins(item.time) < curMins;
              const hasDetail = !!(SCHEDULE_DETAILS[item.title] || item.isDrill);
              return (
                <div key={item.title}
                  onClick={() => { if (hasDetail) { setModalIdx(i); setExpandedMealIdx(null); setCheckedMeals(new Set()); } }}
                  style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: hasDetail ? "pointer" : "default", borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f6" : "none", opacity: isPast ? 0.45 : 1 }}>
                  {isCurrent && (
                    <div style={{ position: "absolute", left: -16, top: 0, bottom: 0, width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                    </div>
                  )}
                  <button onClick={e => { e.stopPropagation(); toggleDone(item.title); }}
                    style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isDone ? item.color : "#d0d4da"}`, background: isDone ? item.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", cursor: "pointer" }}>
                    {isDone && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDone ? "#9aa0a6" : "#1a1c1c", textDecoration: isDone ? "line-through" : "none", flex: 1 }}>{item.title}</p>
                  <span style={{ fontSize: 15, color: "#b0b8c1", fontWeight: 500, flexShrink: 0 }}>{item.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalItem && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={closeModal} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          <style>{`@keyframes mgsheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes mgsheet-down{from{transform:translateY(0)}to{transform:translateY(100%)}}@keyframes mgsheet-fade-out{from{opacity:1}to{opacity:0}}`}</style>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: modalClosing ? "mgsheet-fade-out 0.28s cubic-bezier(0.4,0,1,1) both" : undefined }} />
          <div
            className="relative w-full bg-white flex flex-col"
            style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: modalClosing ? "mgsheet-down 0.28s cubic-bezier(0.4,0,1,1) both" : "mgsheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
            <div className="overflow-y-auto flex-1 px-6 pb-4" style={{ minHeight: 0 }}>
              <p style={{ margin: "20px 0 4px", fontSize: "clamp(22px, 6.5vw, 30px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15 }}>{modalItem.title}</p>
              {modalIsMeal && modalDetail?.type === "meal" && (
                <div className="flex flex-col pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest pb-3" style={{ color: "#8a9096" }}>{modalDetail.focus}</p>
                  <p style={{ fontSize: "clamp(17px, 4.4vw, 21px)", fontWeight: 600, color: "#1a1c1c", margin: "0 0 8px" }}>What did you eat?</p>
                  {modalDetail.options.map((meal, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setExpandedMealIdx(expandedMealIdx === i ? null : i)}
                        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                          <button
                            onClick={e => { e.stopPropagation(); setCheckedMeals(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; }); }}
                            style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${checkedMeals.has(i) ? "#16a34a" : "#c4c7c7"}`, background: checkedMeals.has(i) ? "#16a34a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                          >
                            {checkedMeals.has(i) && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>}
                          </button>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3, textAlign: "left" }}>{meal.title}</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: expandedMealIdx === i ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {expandedMealIdx === i && meal.detail && (
                        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7480", lineHeight: 1.5 }}>{meal.detail}</p>
                      )}
                      {i < modalDetail.options.length - 1 && <div style={{ height: 1, background: "#f0f0f0" }} />}
                    </div>
                  ))}
                </div>
              )}
              {modalIsInfo && modalDetail?.type === "info" && (
                <div className="pt-4">
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{modalDetail.focus}</p>
                  <p style={{ margin: 0, fontSize: 15, color: "#4a5050", lineHeight: 1.7 }}>{modalDetail.text}</p>
                </div>
              )}
              {modalIsExercise && modalDetail?.type === "exercise" && (
                <div className="pt-4">
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{modalDetail.focus}</p>
                  {renderSteps(modalDetail.steps)}
                </div>
              )}
              {modalIsDrill && (
                <div className="pt-4">
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{drillDef.focus}</p>
                  {renderSteps(drillDef.steps)}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 24px 40px", flexShrink: 0 }}>
              {modalIsComplete ? (
                <button
                  onClick={handleSchedDone}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 56, borderRadius: 28, border: "2px solid #00D455", background: "transparent", cursor: "pointer" }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#00D455", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#00D455" }}>Done</span>
                </button>
              ) : (
                <div
                  ref={swipeTrackRef}
                  style={{ position: "relative", height: 56, borderRadius: 28, background: "#f0f1f3", overflow: "hidden", touchAction: "none" }}
                  onTouchStart={e => { setSwipeX(0); const track = swipeTrackRef.current; if (track) track._startX = e.touches[0].clientX; }}
                  onTouchMove={e => {
                    const track = swipeTrackRef.current;
                    if (!track) return;
                    const maxX = track.offsetWidth - 56;
                    const startX = track._startX ?? e.touches[0].clientX;
                    setSwipeX(Math.max(0, Math.min(maxX, e.touches[0].clientX - startX)));
                  }}
                  onTouchEnd={() => {
                    const track = swipeTrackRef.current;
                    if (!track) return;
                    const maxX = track.offsetWidth - 56;
                    if (swipeX >= maxX * 0.82) { handleSchedDone(); }
                    setSwipeX(0);
                  }}
                >
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: swipeX, background: "#00D455", transition: swipeX === 0 ? "width 0.3s" : "none" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#8a9096", opacity: Math.max(0, 1 - swipeX / 80), transition: "opacity 0.1s" }}>Swipe to complete</span>
                  </div>
                  <div style={{ position: "absolute", top: 4, left: 4 + swipeX, width: 48, height: 48, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: swipeX === 0 ? "left 0.3s" : "none", pointerEvents: "none" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M13 6l6 6-6 6"/></svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
