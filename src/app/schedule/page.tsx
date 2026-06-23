"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getScheduleData, SCHEDULE_DETAILS, DRILL_LIBRARY, DEFAULT_DRILL, getTopNeedsWorkTag } from "@/lib/schedule-data";
import { hydrateFromSupabase } from "@/lib/sync";

export default function SchedulePage() {
  const [now, setNow] = useState(new Date());
  const [dayType, setDayType] = useState<"match" | "recovery" | "training">("training");
  const [schedule, setSchedule] = useState<ReturnType<typeof getScheduleData>["schedule"]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  useEffect(() => {
    hydrateFromSupabase();
    let lastSync = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 30_000) {
        lastSync = Date.now();
        hydrateFromSupabase();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    function load() {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      let type: "match" | "recovery" | "training" = "training";
      let mTime: string | null = null;

      try {
        const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
        if (m?.date === todayStr && m?.time) { type = "match"; mTime = m.time; }
      } catch {}
      if (type === "training") {
        try {
          const reviews: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
          if (reviews.some(r => r.ts.slice(0, 10) === yesterday)) type = "recovery";
        } catch {}
      }

      const tag = getTopNeedsWorkTag();
      setDrillTag(tag);
      setDayType(type);
      setMatchTime(mTime);
      const { schedule: s, currentIdx: ci } = getScheduleData(type, mTime, tag);
      setSchedule(s);
      setCurrentIdx(ci);
    }

    load();
    window.addEventListener("storage", load);
    window.addEventListener("padelop:sync-done", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("padelop:sync-done", load);
    };
  }, []);

  useEffect(() => {
    if (!schedule.length) return;
    const curMins = now.getHours() * 60 + now.getMinutes();
    let idx = 0;
    if (curMins >= (schedule[schedule.length - 1].time.split(":").reduce((a: number, b: string, i: number) => a + (i === 0 ? Number(b) * 60 : Number(b)), 0))) {
      idx = schedule.length - 1;
    } else {
      for (let i = 0; i < schedule.length - 1; i++) {
        const t1 = schedule[i].time.split(":").reduce((a: number, b: string, j: number) => a + (j === 0 ? Number(b) * 60 : Number(b)), 0);
        const t2 = schedule[i + 1].time.split(":").reduce((a: number, b: string, j: number) => a + (j === 0 ? Number(b) * 60 : Number(b)), 0);
        if (curMins >= t1 && curMins < t2) { idx = i; break; }
      }
    }
    setCurrentIdx(idx);
  }, [now, schedule]);

  const modalItem = modalIdx !== null ? schedule[modalIdx] : null;
  const detail = modalItem ? SCHEDULE_DETAILS[modalItem.title] : null;
  const drillSteps = modalItem?.isDrill ? (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).steps : null;

  const dayLabel = dayType === "match" ? "Match Day" : dayType === "recovery" ? "Recovery Day" : "Training Day";
  const dayColor = dayType === "match" ? "#2653d4" : dayType === "recovery" ? "#7c3aed" : "#16a34a";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f6" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 32px" }}>
        {/* Day type badge */}
        <div style={{ padding: "20px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: `${dayColor}18`, color: dayColor }}>
            {dayLabel}
          </span>
          <span style={{ fontSize: 13, color: "#b0b8c1", fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        {/* Schedule list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 12px" }}>
          {schedule.map((s, i) => {
            const isCur = i === currentIdx;
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const sMins = s.time.split(":").reduce((a: number, b: string, j: number) => a + (j === 0 ? Number(b) * 60 : Number(b)), 0);
            const isPast = !isCur && nowMins > sMins;
            const hasDetail = !!SCHEDULE_DETAILS[s.title] || s.isDrill;
            return (
              <div
                key={i}
                onClick={() => hasDetail && setModalIdx(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  borderRadius: 14,
                  padding: isCur ? "14px 14px 14px 16px" : "10px 10px 10px 14px",
                  cursor: hasDetail ? "pointer" : "default",
                  background: isCur ? `${s.color}0e` : "#fff",
                  boxShadow: isCur ? `0 0 0 2px ${s.color}, 0 2px 12px ${s.color}22` : "0 0 0 1px #f0f0f0",
                }}
              >
                <div style={{ width: isCur ? 40 : 32, height: isCur ? 40 : 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isPast ? "#f0f0f0" : `${s.color}22` }}>
                  <div style={{ width: isCur ? 13 : 10, height: isCur ? 13 : 10, borderRadius: "50%", background: isPast ? "#d0d3d6" : s.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color: isPast ? "#c4c7c7" : s.color }}>{s.time}</p>
                  <p style={{ fontSize: isCur ? "clamp(17px,4.4vw,20px)" : "clamp(15px,3.9vw,18px)", fontWeight: isCur ? 700 : 600, margin: 0, lineHeight: 1.25, color: isPast ? "#a0a5aa" : "#1a1c1c" }}>{s.title}</p>
                  {s.subtitle && <p style={{ fontSize: "clamp(12px,3.1vw,14px)", margin: "2px 0 0", color: isPast ? "#c4c7c7" : "#6b7480" }}>{s.subtitle}</p>}
                </div>
                {hasDetail && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isCur ? s.color : "#c4c7c7"} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      {modalItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => setModalIdx(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full bg-white rounded-[28px] overflow-hidden overflow-y-auto" style={{ maxHeight: "80vh", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4" style={{ background: `${modalItem.color}18` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: modalItem.color }} />
                <p className="text-[17px] font-bold tracking-widest uppercase" style={{ color: modalItem.color }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="text-[33px] font-bold text-[#1a1c1c] leading-tight">{modalItem.title}</h3>
              {modalItem.subtitle && <p className="text-[23px] text-[#6b7480] mt-0.5">{modalItem.subtitle}</p>}
            </div>
            {detail && (
              <div className="px-6 py-5">
                {detail.type === 'info' && <p className="text-[20px] text-[#2c3235] leading-relaxed">{detail.text}</p>}
                {detail.type === 'meal' && (
                  <>
                    <p className="text-[17px] font-bold uppercase tracking-widest text-[#8a9096] mb-4">{detail.focus}</p>
                    <div className="flex flex-col gap-3">
                      {detail.options.map((meal, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: `${modalItem.color}18` }}>
                            <span className="text-[13px] font-bold" style={{ color: modalItem.color }}>{i + 1}</span>
                          </div>
                          <p className="text-[23px] text-[#2c3235] leading-snug">{meal}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {detail.type === 'exercise' && (
                  <div className="flex flex-col gap-4">
                    {(drillSteps ?? detail.steps).map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${modalItem.color}18` }}>
                          <span className="text-[17px] font-bold" style={{ color: modalItem.color }}>{i + 1}</span>
                        </div>
                        <div>
                          <p className="text-[21px] font-semibold text-[#1a1c1c]">{s.step}</p>
                          <p className="text-[20px] text-[#6b7480] mt-0.5 leading-snug">{s.cue}</p>
                          <p className="text-[18px] font-semibold mt-1" style={{ color: modalItem.color }}>{s.reps}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="px-6 pb-6">
              <button onClick={() => setModalIdx(null)} className="w-full py-3.5 rounded-2xl font-bold text-white" style={{ background: modalItem.color }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
