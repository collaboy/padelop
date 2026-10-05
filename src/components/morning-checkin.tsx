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

// Each row is 1–5 with 5 = good; `words` names the picked level so a tap reads back.
const ROWS: { key: Key; label: string; words: [string, string, string, string, string] }[] = [
  { key: "sleep",  label: "Sleep",  words: ["Terrible", "Poor", "OK", "Good", "Great"] },
  { key: "energy", label: "Energy", words: ["Empty", "Low", "OK", "Good", "Charged"] },
  { key: "body",   label: "Body",   words: ["Wrecked", "Sore", "OK", "Good", "Fresh"] },
  { key: "drive",  label: "Drive",  words: ["None", "Low", "OK", "Up for it", "Fired up"] },
  { key: "water",  label: "Water",  words: ["Dry", "Low", "OK", "Good", "Topped up"] },
];

const ACCENT = "#7c3aed"; // check-in colour (the match review is blue)
const eyebrow: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096" };
const pillButton: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 60, borderRadius: 30, border: "none", cursor: "pointer", fontSize: 20, fontWeight: 800, transition: "background 0.2s, color 0.2s" };
const quietButton: React.CSSProperties = { display: "block", width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6b7480" };

const PAIN_AREAS = ["Knee", "Shoulder", "Ankle", "Back", "Hip", "Elbow", "Wrist", "Neck", "Muscle"];

const WATER_GOAL_ML = 2500;
const WATER_STEP_ML = 500;

const DOT_COLOR: Record<TodayFocus["color"], string> = { green: "#22c55e", yellow: "#eab308", orange: "#f97316", red: "#ef4444" };

export default function MorningCheckin({ open, onClose, onDismiss, previewMode, onLogWater }: Props) {
  const [values, setValues] = useState<Partial<Record<Key, number>>>({});
  const [focus, setFocus] = useState<TodayFocus | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [pain, setPain] = useState<"none" | "minor" | "yes" | null>(null);
  const [painAreas, setPainAreas] = useState<string[]>([]);

  // Stay up once the focus is showing — saving flips the parent's nudge state off.
  if (!open && !focus) return null;

  // Pain is only asked when Body is rated low — one extra tap on the days it matters.
  const askPain = (values.body ?? 5) <= 2;
  const ready = ROWS.every(r => values[r.key]) && (!askPain || pain !== null);

  function close() {
    setFocus(null);
    setValues({});
    setPain(null);
    setPainAreas([]);
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
    const answers = { sleep: values.sleep!, energy: values.energy!, soreness: values.body!, motivation: values.drive!, hydration: values.water!, ...(askPain && pain ? { pain, painAreas: pain === "none" ? [] : painAreas } : {}) };
    let base: Omit<DailyCheckIn, "date"> = { sleep: 3, energy: 3, soreness: 3, hydration: 3, stress: 3, motivation: 3 };
    try {
      const prev = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      if (prev?.date === todayYMD) base = { ...base, ...prev };
      else base.stressUnasked = true;
    } catch { base.stressUnasked = true; }
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
      const { painAreas: areas, ...dbAnswers } = answers;
      saveCheckInToDb({ date: todayYMD, ...dbAnswers, ...(areas ? { pain_areas: areas } : {}) });
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

  const left = ROWS.filter(r => !values[r.key]).length + (askPain && pain === null ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ padding: 16 }}
      onClick={focus ? close : onDismiss}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <style>{`@keyframes mc-pop{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}@keyframes mc-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full"
        style={{ maxWidth: "calc(var(--app-w) - 32px)", animation: "mc-pop 0.22s cubic-bezier(0.22,1,0.36,1)" }}
        onClick={e => e.stopPropagation()}
      >
      <div
        className="relative w-full bg-white flex flex-col"
        style={{ maxHeight: "calc(100dvh - 32px)", borderRadius: 28, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}
      >
        {!focus ? (
          <>
            <div className="overflow-y-auto flex-1" style={{ position: "relative", minHeight: 0, padding: "76px 24px 8px" }}>
              {/* The home ball, peeking down from the top centre — scrolls away with the content */}
              <div aria-hidden style={{ position: "absolute", top: -64, left: "50%", marginLeft: -60, width: 120, height: 120, borderRadius: "50%", background: "#00D455", pointerEvents: "none" }} />
              <p style={eyebrow}>10 seconds</p>
              <p style={{ margin: "6px 0 0", fontSize: "clamp(28px, 7.5vw, 34px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                Daily check-in
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 16, fontWeight: 500, color: "#6b7480", lineHeight: 1.4 }}>Five taps.</p>
              <div className="flex flex-col" style={{ gap: 18, marginTop: 26 }}>
                {ROWS.map(row => {
                  const val = values[row.key] ?? 0;
                  return (
                    <div key={row.key}>
                      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1c1c" }}>{row.label}</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: val ? "#1a1c1c" : "#b0b8c1" }}>{val ? row.words[val - 1] : "Tap to rate"}</span>
                      </div>
                      <div className="flex justify-between">
                        {[1, 2, 3, 4, 5].map(v => (
                          <button
                            key={v}
                            aria-label={`${row.label}: ${row.words[v - 1]}`}
                            aria-pressed={val === v}
                            onClick={() => setValues(s => ({ ...s, [row.key]: v }))}
                            className="active:scale-90 transition-transform"
                            style={{ width: "clamp(44px, 13vw, 54px)", aspectRatio: "1", borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: val >= v ? ACCENT : "#eef0f2", transition: "background 0.15s" }}
                          />
                        ))}
                      </div>
                      {row.key === "body" && askPain && (
                        <div style={{ marginTop: 14, animation: "mc-rise 0.25s ease both" }}>
                          <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#1a1c1c" }}>Any pain?</p>
                          <div className="flex" style={{ gap: 8 }}>
                            {([["none", "None", ACCENT], ["minor", "Minor", "#d97706"], ["yes", "Yes", "#dc2626"]] as const).map(([v, label, color]) => (
                              <button
                                key={v}
                                aria-pressed={pain === v}
                                onClick={() => setPain(v)}
                                className="flex-1 active:scale-95 transition-transform"
                                style={{ height: 44, borderRadius: 22, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, background: pain === v ? color : "#eef0f2", color: pain === v ? "#fff" : "#4a5050", transition: "background 0.15s, color 0.15s" }}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {(pain === "minor" || pain === "yes") && (
                            <div style={{ marginTop: 14, animation: "mc-rise 0.25s ease both" }}>
                              <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#1a1c1c" }}>Where?</p>
                              <div className="flex flex-wrap" style={{ gap: 8 }}>
                                {PAIN_AREAS.map(area => {
                                  const sel = painAreas.includes(area);
                                  return (
                                    <button
                                      key={area}
                                      aria-pressed={sel}
                                      onClick={() => setPainAreas(a => sel ? a.filter(x => x !== area) : [...a, area])}
                                      className="active:scale-95 transition-transform"
                                      style={{ height: 38, padding: "0 14px", borderRadius: 19, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: sel ? ACCENT : "#eef0f2", color: sel ? "#fff" : "#4a5050", transition: "background 0.15s, color 0.15s" }}>
                                      {area}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: "16px 24px 16px", flexShrink: 0 }}>
              <button
                onClick={save}
                disabled={!ready}
                style={{ ...pillButton, background: ready ? ACCENT : "#E5E7EB", color: ready ? "#fff" : "rgba(0,0,0,0.4)", cursor: ready ? "pointer" : "default" }}>
                {ready ? "Done" : `${left} to go`}
              </button>
              <button onClick={onDismiss} style={quietButton}>Not now</button>
            </div>
          </>
        ) : (
          <>
            <div className="overflow-y-auto flex-1" style={{ position: "relative", minHeight: 0, padding: "76px 24px 8px" }}>
              {/* The home ball, peeking down from the top centre — scrolls away with the content */}
              <div aria-hidden style={{ position: "absolute", top: -64, left: "50%", marginLeft: -60, width: 120, height: 120, borderRadius: "50%", background: "#00D455", pointerEvents: "none" }} />
              <div className="flex items-center" style={{ gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: DOT_COLOR[focus.color] }} />
                <p style={eyebrow}>Today&apos;s focus</p>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: "clamp(32px, 9vw, 42px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.08, letterSpacing: "-0.02em" }}>{focus.headline}</p>
              {focus.matchLine && (
                <p style={{ display: "inline-block", margin: "16px 0 0", padding: "8px 14px", borderRadius: 999, background: "#1a1c1c", color: "#fff", fontSize: 15, fontWeight: 700 }}>{focus.matchLine}</p>
              )}
              <p style={{ margin: "16px 0 0", fontSize: 19, fontWeight: 500, color: "#4a5050", lineHeight: 1.4 }}>{focus.followUp}</p>
              {focus.reason && <p style={{ margin: "10px 0 0", fontSize: 15, color: "#8a9096", lineHeight: 1.4 }}>{focus.reason}</p>}
              {(values.water ?? 5) <= 3 && (
                <div className="flex items-center justify-between" style={{ gap: 12, marginTop: 22, padding: "14px 16px", borderRadius: 20, background: "#f4f4f6" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1c1c", lineHeight: 1.25 }}>
                      {waterMl === 0 ? "Start with a big glass of water" : waterMl >= WATER_GOAL_ML ? "Water goal hit" : "Keep the water going"}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 500, color: "#6b7480" }}>{(waterMl / 1000).toFixed(1)} of {WATER_GOAL_ML / 1000} L today</p>
                  </div>
                  <button
                    onClick={addWater}
                    className="flex-shrink-0 active:scale-95 transition-transform"
                    style={{ height: 44, padding: "0 16px", borderRadius: 22, border: "none", cursor: "pointer", background: "#0891b2", color: "#fff", fontSize: 15, fontWeight: 800 }}>
                    +{WATER_STEP_ML} ml
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding: "20px 24px 24px", flexShrink: 0 }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#8a9096", textAlign: "center" }}>Check-in done for today.</p>
              <button onClick={close} style={{ ...pillButton, background: ACCENT, color: "#fff" }}>Let&apos;s go</button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
