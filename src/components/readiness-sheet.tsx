"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  computeScores, loadScoringData, saveScoreSnapshot,
  type DailyCheckIn, type HydrationEntry, type NutritionEntry, type TrainingEntry, type HabitsEntry,
} from "@/lib/scoring";

type LogTab = "checkin" | "hydration" | "nutrition" | "training" | "wellbeing";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenLog: (tab: LogTab) => void;
  onOpenLogScreen?: () => void;
}

const sleepLabel = (v: number) => ["Very poor", "Poor", "OK", "Good", "Excellent"][v - 1] ?? `${v}/5`;
const rateLabel  = (v: number) => ["Very low",  "Low",  "Moderate", "Good", "High"][v - 1] ?? `${v}/5`;

export default function ReadinessSheet({ open, onClose, onOpenLog, onOpenLogScreen }: Props) {
  const [checkIn, setCheckIn]     = useState<DailyCheckIn | null>(null);
  const [hydration, setHydration] = useState<HydrationEntry | null>(null);
  const [nutrition, setNutrition] = useState<NutritionEntry | null>(null);
  const [training, setTraining]   = useState<TrainingEntry | null>(null);
  const [habits, setHabits]       = useState<HabitsEntry | null>(null);
  const [matchDate, setMatchDate] = useState<string | null>(null);
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<LogTab | null>(null);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [mealLogOpen, setMealLogOpen] = useState(false);
  const [mealForm, setMealForm]       = useState({ type: "meal" as "meal" | "snack", time: "", description: "" });

  function openMealLog() {
    const now = new Date();
    setMealForm({ type: "meal", time: `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`, description: "" });
    setMealLogOpen(true);
  }

  function saveMeal() {
    if (!mealForm.description.trim()) return;
    const entry = { id: Date.now().toString(), date: todayKey, time: mealForm.time, type: mealForm.type, description: mealForm.description.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
      localStorage.setItem("padelop:meal-log", JSON.stringify([...existing, entry]));
    } catch {}
    setMealLogOpen(false);
  }
  const gaugeRef    = useRef<HTMLDivElement>(null);
  const dragStartX  = useRef(0);
  const dragStartMl = useRef(0);

  const GOAL_ML  = 2500;
  const MAX_ML   = 3000;
  const todayKey = new Date().toISOString().slice(0, 10);

  function loadHydrationMl() {
    try {
      const raw = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
      setHydrationMl(raw?.date === todayKey ? (raw.ml ?? 0) : 0);
    } catch { setHydrationMl(0); }
  }

  function saveHydration(ml: number) {
    localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayKey, ml }));
  }

  function onDotTouchStart(e: React.TouchEvent) {
    dragStartX.current  = e.touches[0].clientX;
    dragStartMl.current = hydrationMl;
  }

  function onDotTouchMove(e: React.TouchEvent) {
    e.stopPropagation();
    const dx      = e.touches[0].clientX - dragStartX.current;
    const barW    = gaugeRef.current?.offsetWidth ?? 1;
    const deltaMl = (dx / barW) * MAX_ML;
    const snapped = Math.round((dragStartMl.current + deltaMl) / 250) * 250;
    const clamped = Math.max(0, Math.min(MAX_ML, snapped));
    setHydrationMl(clamped);
    saveHydration(clamped);
  }

  function refresh() {
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    saveScoreSnapshot(s);
    setCheckIn(d.checkIn);
    setHydration(d.hydration);
    setNutrition(d.nutrition);
    setTraining(d.training);
    setHabits(d.habits);
    loadHydrationMl();
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
      label: "Hydration", tab: "hydration", logged: hydrationMl >= GOAL_ML,
      detail: hydration
        ? `${hydration.litres} · ${hydration.urine} urine · ${hydration.quality}`
        : "Aim for 2–3L. The single biggest lever on your energy.",
    },
    {
      label: "Nutrition", tab: "nutrition", logged: !!nutrition,
      detail: nutrition
        ? `${nutrition.quality === "great" ? "Good" : nutrition.quality === "bad" ? "Poor" : "OK"} quality · protein ${nutrition.proteinRating}`
        : "Log a meal or snack",
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
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "16px 0 4px", textAlign: "center" }}>Match Checklist</p>
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
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "#1a1c1c" }}>
                    {item.label}
                    {item.tab === "hydration" && hydrationMl > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#2653d4", marginLeft: 8 }}>
                        {Math.min(100, Math.round(hydrationMl / GOAL_ML * 100))}%
                      </span>
                    )}
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
                  <div style={{ paddingBottom: 16, paddingLeft: 36, paddingRight: 4 }}>
                    {item.tab === "hydration" ? (
                      <div>
                        {/* Amount label */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1c1c" }}>
                            {hydrationMl >= 1000 ? `${+(hydrationMl / 1000).toFixed(1)}L` : `${hydrationMl}ml`}
                            <span style={{ fontWeight: 400, color: "#c8ccd0" }}> / 2.5L</span>
                          </span>
                          {hydrationMl >= GOAL_ML && <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Goal reached</span>}
                        </div>

                        {/* Gauge with draggable dot */}
                        <div ref={gaugeRef} style={{ position: "relative", height: 8, borderRadius: 999, background: "#e8eaed", marginBottom: 20 }}>
                          {/* Fill */}
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 999, background: "#2653d4", width: `${Math.min(100, (hydrationMl / MAX_ML) * 100)}%`, transition: "width 0.15s" }} />
                          {/* Goal marker */}
                          <div style={{ position: "absolute", top: -4, left: `${(GOAL_ML / MAX_ML) * 100}%`, width: 2, height: 16, background: "#b0b8c1", borderRadius: 1 }} />
                          {/* Draggable dot */}
                          <div
                            onTouchStart={onDotTouchStart}
                            onTouchMove={onDotTouchMove}
                            style={{
                              position: "absolute", top: "50%", left: `${Math.min(100, (hydrationMl / MAX_ML) * 100)}%`,
                              transform: "translate(-50%, -50%)",
                              width: 22, height: 22, borderRadius: "50%",
                              background: "#fff", border: "2.5px solid #2653d4",
                              boxShadow: "0 1px 6px rgba(38,83,212,0.25)",
                              cursor: "grab", touchAction: "none",
                            }}
                          />
                        </div>

                        {/* Scale labels */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "#c8ccd0" }}>0</span>
                          <span style={{ fontSize: 10, color: "#b0b8c1" }}>2.5L</span>
                          <span style={{ fontSize: 10, color: "#c8ccd0" }}>3L+</span>
                        </div>
                      </div>
                    ) : item.tab === "nutrition" ? (
                      <>
                        <p style={{ fontSize: 13, color: "#9aa5b0", margin: "0 0 12px", lineHeight: 1.5 }}>{item.detail}</p>
                        <button
                          onClick={openMealLog}
                          style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#2653d4" }}
                        >
                          Log a meal or snack +
                        </button>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, color: "#9aa5b0", margin: "0 0 12px", lineHeight: 1.5 }}>{item.detail}</p>
                        <button
                          onClick={() => { onClose(); setTimeout(() => onOpenLog(item.tab), 200); }}
                          style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: item.logged ? "#c0c5ca" : "#2653d4" }}
                        >
                          {item.logged ? "Edit" : "Log +"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Log screen link */}
          {onOpenLogScreen && (
            <button
              onClick={() => { onClose(); setTimeout(onOpenLogScreen, 200); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#b0b8c1", padding: "4px 0 8px", textAlign: "center", width: "100%" }}
            >
              Complete or edit in log screen →
            </button>
          )}

        </div>
      </div>

      {/* Meal / snack log modal */}
      {mealLogOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center" onClick={() => setMealLogOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-[#d0d3d6] mx-auto mt-4 mb-5" />

            <div style={{ padding: "0 20px 28px" }}>
              {/* Type toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["meal", "snack"] as const).map(t => (
                  <button key={t} onClick={() => setMealForm(f => ({ ...f, type: t }))} style={{ flex: 1, padding: "9px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: mealForm.type === t ? "#2653d4" : "#f4f4f6", color: mealForm.type === t ? "#fff" : "#6b7480", textTransform: "capitalize" }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Time */}
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", display: "block", marginBottom: 6 }}>Time</label>
              <input
                type="time"
                value={mealForm.time}
                onChange={e => setMealForm(f => ({ ...f, time: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: 15, color: "#1a1c1c", marginBottom: 16, outline: "none" }}
              />

              {/* Description */}
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", display: "block", marginBottom: 6 }}>What did you have?</label>
              <textarea
                value={mealForm.description}
                onChange={e => setMealForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. chicken rice bowl, protein shake…"
                rows={3}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: 15, color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", marginBottom: 20 }}
              />

              <button
                onClick={saveMeal}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: mealForm.description.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: mealForm.description.trim() ? "pointer" : "default", fontSize: 15, fontWeight: 700, color: mealForm.description.trim() ? "#fff" : "#b0b8c1" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
