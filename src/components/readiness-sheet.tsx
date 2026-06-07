"use client";

import React, { useState, useEffect } from "react";
import {
  computeScores, loadScoringData, saveScoreSnapshot,
  type DailyCheckIn, type HydrationEntry, type NutritionEntry, type TrainingEntry, type HabitsEntry,
} from "@/lib/scoring";

type LogTab = "checkin" | "hydration" | "nutrition" | "training" | "wellbeing";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenLog: (tab: LogTab) => void;
}

const sleepLabel = (v: number) => ["Very poor", "Poor", "OK", "Good", "Excellent"][v - 1] ?? `${v}/5`;
const rateLabel  = (v: number) => ["Very low",  "Low",  "Moderate", "Good", "High"][v - 1] ?? `${v}/5`;

export default function ReadinessSheet({ open, onClose, onOpenLog }: Props) {
  const [checkIn, setCheckIn]     = useState<DailyCheckIn | null>(null);
  const [hydration, setHydration] = useState<HydrationEntry | null>(null);
  const [nutrition, setNutrition] = useState<NutritionEntry | null>(null);
  const [training, setTraining]   = useState<TrainingEntry | null>(null);
  const [habits, setHabits]       = useState<HabitsEntry | null>(null);
  const [matchDate, setMatchDate] = useState<string | null>(null);
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<LogTab | null>(null);

  function refresh() {
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    saveScoreSnapshot(s);
    setCheckIn(d.checkIn);
    setHydration(d.hydration);
    setNutrition(d.nutrition);
    setTraining(d.training);
    setHabits(d.habits);
    try {
      const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
      setMatchDate(m?.date ?? null);
      setMatchTime(m?.time ?? null);
    } catch {}
  }

  useEffect(() => {
    if (open) { refresh(); setExpanded(null); }
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [open]);

  if (!open) return null;

  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const daysToMatch = matchDate
    ? Math.round((new Date(matchDate).getTime() - new Date(todayStr).getTime()) / 86400000)
    : null;

  type State = "preparation" | "match-active" | "recovery";
  let state: State = "preparation";
  if (daysToMatch !== null && daysToMatch < 0) {
    state = "recovery";
  } else if (daysToMatch === 0 && matchTime) {
    const [mH, mM] = matchTime.split(":").map(Number);
    const matchStart = mH * 60 + mM;
    const matchEnd   = matchStart + 120;
    const nowMins    = now.getHours() * 60 + now.getMinutes();
    if (nowMins >= matchEnd)        state = "recovery";
    else if (nowMins >= matchStart) state = "match-active";
  }

  const stateLabel =
    state === "match-active" ? "Match Active" :
    state === "recovery"     ? "Recovery"     : "Readiness";

  const dayTypeLabel =
    daysToMatch === 0        ? "Match Day"    :
    state === "recovery"     ? "Recovery Day" : "Training Day";

  type Item = { label: string; logged: boolean; detail: string; tab: LogTab };
  const items: Item[] = [
    {
      label: "Morning Check-in", tab: "checkin", logged: !!checkIn,
      detail: checkIn
        ? `Sleep ${sleepLabel(checkIn.sleep)} · Soreness ${sleepLabel(checkIn.soreness)} · Stress ${rateLabel(checkIn.stress)}`
        : "Log sleep, energy and soreness to set your baseline.",
    },
    {
      label: "Hydration Target", tab: "hydration", logged: !!hydration,
      detail: hydration
        ? `${hydration.litres} · ${hydration.urine} urine · ${hydration.quality}`
        : "Aim for 2–3L. The single biggest lever on your energy.",
    },
    {
      label: "Nutrition", tab: "nutrition", logged: !!nutrition,
      detail: nutrition
        ? `${nutrition.quality === "great" ? "Good" : nutrition.quality === "bad" ? "Poor" : "OK"} quality · protein ${nutrition.proteinRating}`
        : "Log your meals to track protein and overall quality.",
    },
    {
      label: "Pre-Match Routine", tab: "training", logged: !!training,
      detail: training
        ? `${training.sessionType.join(" & ")} · ${training.duration} · ${training.intensity}`
        : "A short activation — drills, gym, or active recovery.",
    },
  ];

  // derive count from checklist so card and list are always in sync
  const done  = items.filter(i => i.logged).length;
  const total = items.length;

  const progressText =
    done === total     ? "Match Ready" :
    done === total - 1 ? "Almost Ready" :
    done >= 1          ? "Building" : "Getting Started";

  const progressColor =
    done === total     ? "#16a34a" :
    done === total - 1 ? "#d97706" : "#b0b8c1";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center"
      style={{ paddingTop: "calc(4rem + 24px)" }}
      onClick={onClose}
    >
      <style>{`@keyframes rsSlideDown{from{transform:translateY(-16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg mx-4 bg-[#f0f2f5] rounded-[28px] flex flex-col overflow-hidden"
        style={{
          animation: "rsSlideDown 0.25s cubic-bezier(0.22,1,0.36,1)",
          maxHeight: "calc(100dvh - 4rem - 24px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-[#d0d3d6] mx-auto mt-4 mb-3 flex-shrink-0" />

        {/* Header */}
        <div style={{ padding: "0 20px 16px", flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0, textAlign: "center" }}>Today · {dayTypeLabel}</p>
        </div>

        <div className="overflow-y-auto flex-1 overscroll-contain" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 32px" }}>

          {/* STATUS CARD */}
          <div style={{ background: "#fff", borderRadius: 24, padding: "36px 24px 32px", textAlign: "center" }}>
            {/* State name */}
            <p style={{ fontSize: 28, fontWeight: 800, color: "#1a1c1c", margin: "0 0 20px", lineHeight: 1.1 }}>
              {stateLabel}
            </p>

            {state === "preparation" && (
              <>
                <p style={{ fontSize: "clamp(64px, 20vw, 80px)", fontWeight: 800, color: "#1a1c1c", margin: 0, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {done}<span style={{ color: "#e2e5e9" }}>/{total}</span>
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: progressColor, margin: "16px 0 0" }}>{progressText}</p>
              </>
            )}

            {state === "match-active" && (
              <>
                <p style={{ fontSize: "clamp(64px, 20vw, 80px)", fontWeight: 800, color: "#2653d4", margin: 0, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {done}<span style={{ color: "#c7d3f7" }}>/{total}</span>
                </p>
                <p style={{ fontSize: 14, color: "#9aa5b0", margin: "16px 0 0", lineHeight: 1.5 }}>Warmup, hydrate, stay loose between sets.</p>
              </>
            )}

            {state === "recovery" && (
              <>
                <p style={{ fontSize: "clamp(64px, 20vw, 80px)", fontWeight: 800, color: "#7c3aed", margin: 0, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {done}<span style={{ color: "#ddd6fe" }}>/{total}</span>
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#7c3aed", margin: "16px 0 0" }}>Hydrate, foam roll, sleep well tonight.</p>
              </>
            )}
          </div>

          {/* CHECKLIST */}
          <div style={{ background: "#fff", borderRadius: 24, padding: "4px 20px" }}>
            {items.map((item, i) => (
              <div key={item.tab}>
                {i > 0 && <div style={{ height: 1, background: "#f4f4f6" }} />}
                <button
                  onClick={() => setExpanded(expanded === item.tab ? null : item.tab)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: item.logged ? "#f0fdf4" : "transparent",
                    border: item.logged ? "none" : "1.5px solid #dde0e4",
                  }}>
                    {item.logged && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: item.logged ? "#1a1c1c" : "#9aa5b0" }}>
                    {item.label}
                  </span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#c8ccd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transform: expanded === item.tab ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {expanded === item.tab && (
                  <div style={{ paddingBottom: 16, paddingLeft: 36 }}>
                    <p style={{ fontSize: 13, color: "#9aa5b0", margin: "0 0 12px", lineHeight: 1.5 }}>{item.detail}</p>
                    {!item.logged && (
                      <button
                        onClick={() => { onClose(); setTimeout(() => onOpenLog(item.tab), 200); }}
                        style={{ padding: "7px 18px", borderRadius: 999, background: "#2653d4", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff" }}
                      >
                        Log +
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
