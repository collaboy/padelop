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
}

type Action = { label: string; detail: string };
type Focus = { pillar: string; message: string; actions: Action[] };

function computeFocus(
  checkIn: DailyCheckIn | null,
  hydration: HydrationEntry | null,
  nutrition: NutritionEntry | null,
  training: TrainingEntry | null,
  habits: HabitsEntry | null,
  daysToMatch: number | null,
): Focus {
  if (daysToMatch === 0) return { pillar: "Recovery", message: "Match day — protect your energy.", actions: [
    { label: "Hydration",    detail: "Keep sipping — don't wait until you're thirsty" },
    { label: "Warm up well", detail: "Dynamic warmup before you step on court" },
    { label: "Stay loose",   detail: "Stretch between sets, don't let muscles tighten" },
  ]};
  if (daysToMatch === 1) return { pillar: "Recovery", message: "Match tomorrow — recover well tonight.", actions: [
    { label: "Hydration",   detail: "Aim for 2.5L through the day" },
    { label: "Sleep early", detail: "Target 8 hours — this is your biggest lever" },
    { label: "Mobility",    detail: "10 min light stretch before bed" },
  ]};
  if (!checkIn) return { pillar: "Check in", message: "Start your day with a quick check-in.", actions: [
    { label: "Morning check-in", detail: "Log sleep, energy and soreness to set your baseline" },
    { label: "Hydration",        detail: "Start the day with a full glass of water" },
    { label: "Nutrition",        detail: "Log what you eat — small habit, big picture" },
  ]};
  if (checkIn.sleep <= 2 || checkIn.soreness <= 2) return { pillar: "Recovery", message: "Take it easy today.", actions: [
    { label: "Hydration", detail: "Aim for 2.5L — helps flush out fatigue" },
    { label: "Mobility",  detail: "10 min foam roll or light stretch, nothing intense" },
    { label: "Sleep",     detail: "Target 8 hours tonight to reset properly" },
  ]};
  if (!hydration && !nutrition) return { pillar: "Nutrition", message: "Fuel and hydrate before the day gets away.", actions: [
    { label: "Hydration",   detail: "Log your intake — aim for 2–3L today" },
    { label: "Protein",     detail: "Hit your protein target to support muscle repair" },
    { label: "Track meals", detail: "Log what you eat tonight in the night check-in" },
  ]};
  if (checkIn.stress <= 2 || checkIn.motivation <= 2) return { pillar: "Mindset", message: "Reset before you push hard.", actions: [
    { label: "Box breathing", detail: "4 counts in, hold, out, hold — 5 rounds" },
    { label: "Visualise",     detail: "2 min eyes closed — picture yourself playing well" },
    { label: "Light walk",    detail: "20 min outside clears the head better than rest" },
  ]};
  if (!training) return { pillar: "Training", message: "A session today will lift your week.", actions: [
    { label: "Padel drills",    detail: "30–60 min focused drill work beats a full game" },
    { label: "Gym",             detail: "Legs and core — the foundation of your game" },
    { label: "Active recovery", detail: "Even a 20 min walk counts — stay in the habit" },
  ]};
  return { pillar: "Consistency", message: "You're on track. Keep the habits going.", actions: [
    { label: "Foam roll",   detail: "5–10 min on legs and back before bed" },
    { label: "Sleep early", detail: "Consistent bedtime is more important than duration" },
    { label: "Log tonight", detail: "Complete your night check-in to close the day" },
  ]};
}

const sleepLabel = (v: number) => ["Very poor", "Poor", "OK", "Good", "Excellent"][v - 1] ?? `${v}/5`;
const rateLabel  = (v: number) => ["Very low",  "Low",  "Moderate", "Good", "High"][v - 1] ?? `${v}/5`;

export default function ReadinessSheet({ open, onClose, onOpenLog }: Props) {
  const whyRef = useRef<HTMLDivElement>(null);
  const [checkIn, setCheckIn]     = useState<DailyCheckIn | null>(null);
  const [hydration, setHydration] = useState<HydrationEntry | null>(null);
  const [nutrition, setNutrition] = useState<NutritionEntry | null>(null);
  const [training, setTraining]   = useState<TrainingEntry | null>(null);
  const [habits, setHabits]       = useState<HabitsEntry | null>(null);
  const [matchDate, setMatchDate] = useState<string | null>(null);

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
    } catch {}
  }

  useEffect(() => {
    if (open) refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [open]);

  if (!open) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysToMatch = matchDate
    ? Math.round((new Date(matchDate).getTime() - new Date(todayStr).getTime()) / 86400000)
    : null;

  const focus = computeFocus(checkIn, hydration, nutrition, training, habits, daysToMatch);

  type Row = { icon: string; iconColor: string; label: string; impact: "High" | "Medium"; logged: boolean; detail: string; tab: LogTab };
  const rows: Row[] = [
    {
      icon: "🌙", iconColor: "#7c3aed", label: "Morning Check-in", impact: "High",
      logged: !!checkIn,
      detail: checkIn ? `Sleep ${sleepLabel(checkIn.sleep)} · Soreness ${sleepLabel(checkIn.soreness)}` : "Not done — drives Recovery & Wellbeing",
      tab: "checkin",
    },
    {
      icon: "💧", iconColor: "#0891b2", label: "Hydration", impact: "High",
      logged: !!hydration,
      detail: hydration ? `${hydration.litres} · ${hydration.urine} urine · ${hydration.quality}` : "Not logged — biggest impact on Nutrition score",
      tab: "hydration",
    },
    {
      icon: "🥗", iconColor: "#16a34a", label: "Nutrition", impact: "Medium",
      logged: !!nutrition,
      detail: nutrition ? `${nutrition.quality === "great" ? "Good" : nutrition.quality === "bad" ? "Poor" : "OK"} quality · protein ${nutrition.proteinRating}` : "Not logged today",
      tab: "nutrition",
    },
    {
      icon: "🎾", iconColor: "#f59e0b", label: "Training", impact: "Medium",
      logged: !!training,
      detail: training ? `${training.sessionType.join(" & ")} · ${training.duration} · ${training.intensity}` : "No session logged today",
      tab: "training",
    },
    {
      icon: "🧠", iconColor: "#ec4899", label: "Night Check-in", impact: "Medium",
      logged: !!habits,
      detail: habits
        ? `Habits done · ${[habits.sleep && "Sleep", habits.foamRoll && "Foam roll", habits.mobility && "Mobility"].filter(Boolean).join(" · ") || "logged"}`
        : checkIn ? `Stress ${rateLabel(checkIn.stress)} · Motivation ${rateLabel(checkIn.motivation)} — log tonight` : "Do morning check-in first",
      tab: "wellbeing",
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center" style={{ paddingTop: "calc(4rem + 24px)" }} onClick={onClose}>
      <style>{`@keyframes rsSlideDown{from{transform:translateY(-16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-[#f0f2f5] rounded-[28px] flex flex-col overflow-hidden"
        style={{ animation: "rsSlideDown 0.25s cubic-bezier(0.22,1,0.36,1)", maxHeight: "calc(100dvh - 4rem - 24px)", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-[#d0d3d6] mx-auto mt-4 mb-3 flex-shrink-0" />

        {/* Header */}
        <div style={{ padding: "0 20px 16px", flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 2px" }}>Today</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#1a1c1c", margin: 0, lineHeight: 1.1 }}>Match Readiness</p>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 overscroll-contain" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 32px" }}>

          {/* YOUR FOCUS */}
          <div style={{ background: "#fff", borderRadius: 24, padding: "24px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b0b8c1", margin: "0 0 10px" }}>Your Focus</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#1a1c1c", margin: "0 0 6px", lineHeight: 1.1 }}>{focus.pillar}</p>
            <p style={{ fontSize: 14, color: "#6b7480", margin: 0, lineHeight: 1.4 }}>{focus.message}</p>
            <div style={{ height: 1, background: "#f0f0f0", margin: "20px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {focus.actions.map(action => (
                <div key={action.label}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1c1c", margin: "0 0 2px" }}>{action.label}</p>
                  <p style={{ fontSize: 13, color: "#9aa5b0", margin: 0, lineHeight: 1.4 }}>{action.detail}</p>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: "#f0f0f0", margin: "20px 0" }} />
            <button
              onClick={() => whyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2653d4" }}>See why</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>

          {/* What's driving it */}
          <div ref={whyRef} style={{ background: "#fff", borderRadius: 24, padding: "20px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>What&apos;s Driving It</p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((row, i) => (
                <div key={row.tab + row.label} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: i > 0 ? 14 : 0, marginTop: i > 0 ? 14 : 0, borderTop: i > 0 ? "1px solid #f4f4f6" : "none" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 14, background: `${row.iconColor}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
                    {row.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1c1c" }}>{row.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, color: row.impact === "High" ? "#dc2626" : "#d97706", background: row.impact === "High" ? "rgba(220,38,38,0.08)" : "rgba(217,119,6,0.08)" }}>
                        {row.impact}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: row.logged ? "#6b7480" : "#9aa5b0", margin: 0, lineHeight: 1.3 }}>{row.detail}</p>
                  </div>
                  {row.logged ? (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                  ) : (
                    <button
                      onClick={() => { onClose(); setTimeout(() => onOpenLog(row.tab), 200); }}
                      style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 999, background: "#2653d4", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff" }}
                    >
                      Log +
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
