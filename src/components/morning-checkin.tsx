"use client";

import React, { useState } from "react";
import {
  saveCheckIn, computeScores, loadScoringData, saveScoreSnapshot, computeTodayFocus,
  type DailyCheckIn, type TodayFocus,
} from "@/lib/scoring";
import { saveCheckInToDb, saveScoreSnapshotToDb } from "@/lib/db";
import { startPlusOne } from "@/lib/nav-events";

interface Props {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  previewMode?: boolean;
  onLogWater?: (ml: number) => void;
}

type Key = "sleep" | "energy" | "body" | "drive" | "water";

const ROWS: { key: Key; icon: string; label: string }[] = [
  { key: "sleep",  icon: "😴", label: "Sleep"  },
  { key: "energy", icon: "⚡", label: "Energy" },
  { key: "body",   icon: "🦵", label: "Body"   },
  { key: "drive",  icon: "🔥", label: "Drive"  },
  { key: "water",  icon: "💧", label: "Water"  },
];

const WATER_GOAL_ML = 2500;
const WATER_STEP_ML = 500;

const DOT_COLOR: Record<TodayFocus["color"], string> = { green: "#22c55e", yellow: "#eab308", orange: "#f97316", red: "#ef4444" };

export default function MorningCheckin({ open, onClose, onDismiss, previewMode, onLogWater }: Props) {
  const [values, setValues] = useState<Partial<Record<Key, number>>>({});
  const [focus, setFocus] = useState<TodayFocus | null>(null);
  const [waterMl, setWaterMl] = useState(0);

  // Stay up once the focus is showing — saving flips the parent's nudge state off.
  if (!open && !focus) return null;

  const ready = ROWS.every(r => values[r.key]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  let name = "";
  try { name = String(JSON.parse(localStorage.getItem("padelop:profile") || "null")?.name ?? "").trim().split(" ")[0]; } catch {}

  function close() {
    setFocus(null);
    setValues({});
    onClose();
  }

  function addWater() {
    const ml = waterMl + WATER_STEP_ML;
    setWaterMl(ml);
    if (!previewMode) onLogWater?.(ml);
  }

  function save() {
    if (!ready) return;
    const todayYMD = new Date().toISOString().slice(0, 10);
    // Padla already knows today's water — show it with the focus instead of asking.
    try {
      const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
      setWaterMl(hq?.date === todayYMD ? (hq.ml ?? 0) : 0);
    } catch { setWaterMl(0); }
    // All five are 5 = good, matching what scoring.ts expects (soreness 5 = no soreness).
    const answers = { sleep: values.sleep!, energy: values.energy!, soreness: values.body!, motivation: values.drive!, hydration: values.water! };
    let base: Omit<DailyCheckIn, "date"> = { sleep: 3, energy: 3, soreness: 3, hydration: 3, stress: 3, motivation: 3 };
    try {
      const prev = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      if (prev?.date === todayYMD) base = { ...base, ...prev };
    } catch {}
    let match: { date: string; time?: string | null } | null = null;
    try { match = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
    let dayType: string | null = null;
    try {
      const cached = JSON.parse(localStorage.getItem("padelop:day-type-cache") || "null");
      if (cached?.date === todayYMD) dayType = cached.type ?? null;
    } catch {}
    if (previewMode) {
      setFocus(computeTodayFocus({ ...base, ...answers, date: todayYMD }, match, dayType));
      return;
    }
    try {
      saveCheckIn({ ...base, ...answers });
      saveCheckInToDb({ date: todayYMD, ...answers });
      const d = loadScoringData();
      const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
      saveScoreSnapshot(s);
      saveScoreSnapshotToDb(todayYMD, s);
      setFocus(computeTodayFocus(d.checkIn, match, dayType));
    } catch {
      close();
      return;
    }
    startPlusOne();
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ paddingTop: "24px", paddingBottom: "24px" }}
      onClick={focus ? close : onDismiss}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {!focus ? (
          <>
            <div className="px-6 pt-8 pb-2">
              <p className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{greeting}{name ? `, ${name}` : ""}.</p>
              <p className="text-[15px] text-[#4a5050] mt-1 leading-snug">How are we looking?</p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-1">
              {ROWS.map(row => (
                <div key={row.key} className="flex items-center justify-between">
                  <span className="text-[16px] font-semibold text-[#1a1c1c]">
                    <span style={{ display: "inline-block", width: 28 }}>{row.icon}</span>{row.label}
                  </span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(v => {
                      const on = (values[row.key] ?? 0) >= v;
                      return (
                        <button
                          key={v}
                          aria-label={`${row.label} ${v} of 5`}
                          onClick={() => setValues(s => ({ ...s, [row.key]: v }))}
                          className="flex items-center justify-center active:scale-90 transition-transform"
                          style={{ width: 38, height: 44 }}
                        >
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: on ? "#2653d4" : "transparent", border: on ? "none" : "2px solid #dde0e4", transition: "background 0.15s" }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-8 flex flex-col gap-3">
              <button
                onClick={save}
                disabled={!ready}
                className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                style={{ background: ready ? "#2653d4" : "#c4c7c7" }}>
                Done →
              </button>
              <button onClick={onDismiss} className="w-full py-3 text-[14px] font-semibold text-[#6b7480]">
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-8 pb-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: DOT_COLOR[focus.color] }} />
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Today&apos;s focus</p>
              </div>
              <p className="text-[26px] font-bold text-[#1a1c1c] leading-tight">{focus.headline}</p>
              {focus.matchLine && <p className="text-[16px] font-semibold text-[#1a1c1c]">{focus.matchLine}</p>}
              <p className="text-[15px] text-[#4a5050] leading-snug">{focus.followUp}</p>
              {focus.reason && <p className="text-[13px] text-[#8a9096] leading-snug">{focus.reason}</p>}
              {(values.water ?? 5) <= 3 && <div className="flex items-center justify-between gap-3 mt-1 rounded-2xl" style={{ background: "#f0f9ff", padding: "12px 14px" }}>
                <div>
                  <p className="text-[15px] font-semibold text-[#1a1c1c] leading-tight">
                    💧 {waterMl === 0 ? "Start with a big glass of water" : waterMl >= WATER_GOAL_ML ? "Water goal hit" : "Keep the water going"}
                  </p>
                  <p className="text-[13px] text-[#4a5050] mt-0.5">{(waterMl / 1000).toFixed(1)} of {WATER_GOAL_ML / 1000} L today</p>
                </div>
                <button
                  onClick={addWater}
                  className="flex-shrink-0 rounded-full text-white text-[14px] font-bold active:scale-95 transition-transform"
                  style={{ background: "#0891b2", padding: "10px 14px" }}>
                  +{WATER_STEP_ML} ml
                </button>
              </div>}
            </div>
            <div className="px-6 pb-8">
              <button
                onClick={close}
                className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                style={{ background: "#2653d4" }}>
                Let&apos;s go
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
