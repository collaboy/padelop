"use client";

import React, { useRef, useState } from "react";
import {
  SCHEDULE_DETAILS, DRILL_LIBRARY, DEFAULT_DRILL,
  type ScheduleItem,
} from "@/lib/schedule-data";
import { saveNutritionToDb } from "@/lib/db";

// Local (device) calendar date as YYYY-MM-DD — NOT toISOString(), which is UTC and
// drifts a day off from the local date for several hours around local midnight
// in timezones ahead of UTC.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function persistMealEntry(item: ScheduleItem, description: string) {
  const text = description.trim();
  if (!text) return;
  try {
    const entry = { id: Date.now().toString(), date: localToday(), time: item.time, description: text };
    const existing = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
    localStorage.setItem("padelop:meal-log", JSON.stringify([...existing, entry]));
    window.dispatchEvent(new Event("storage"));
  } catch {}
  saveNutritionToDb({ date: localToday(), meal_type: item.title, description: text });
}

// Shared by the homepage's "Complete" modal and the full Schedule sheet's
// item-detail modal — both surfaces show the exact same meal/exercise/drill/info
// detail for a schedule item, at the same text sizes.
const SIZES = {
  timeLabel: 17,
  title: "clamp(24px, 6.2vw, 28px)",
  subtitle: "clamp(24px, 6.2vw, 28px)",
  focusLabel: 15,
  bodyText: 21,
  optionTitle: 21,
  optionDetail: 18,
  textareaFont: "clamp(20px, 5.04vw, 22px)",
  infoText: 21,
  stepTitle: 24, stepCue: 20, stepReps: 15,
  swipeLabel: 20, doneLabel: 21,
  detailsLabel: 21,
};

interface Props {
  item: ScheduleItem;
  endTime?: string;
  drillTag: string | null;
  isComplete: boolean;
  onComplete: () => void;
  onClosed: () => void;
  swipeLabelText?: string;
  zIndex?: number;
}

export default function ScheduleItemModal({ item, endTime, drillTag, isComplete, onComplete, onClosed, swipeLabelText = "Swipe to complete", zIndex = 200 }: Props) {
  const v = SIZES;
  const [closing, setClosing] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedMealIdx, setExpandedMealIdx] = useState<number | null>(null);
  const [checkedMeals, setCheckedMeals] = useState<Set<number>>(new Set());
  const [mealSuggestionsOpen, setMealSuggestionsOpen] = useState(false);
  const [mealLogOpen, setMealLogOpen] = useState(false);
  const [mealText, setMealText] = useState("");
  const swipeTrackRef = useRef<HTMLDivElement>(null);
  const swipeStartXRef = useRef(0);

  const detail = SCHEDULE_DETAILS[item.title];
  const isMeal = detail?.type === "meal";
  const isExercise = detail?.type === "exercise";
  const isInfo = detail?.type === "info";
  const isDrill = !!item.isDrill;
  const drillDef = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;

  function requestClose() {
    setClosing(true);
    setSwipeX(0);
    setTimeout(onClosed, 320);
  }

  function handleDoneClick() {
    const wasComplete = isComplete;
    onComplete();
    if (!wasComplete) { setTimeout(requestClose, 350); } else { requestClose(); }
  }

  const renderSteps = (stepList: { step: string; cue: string; reps: string }[]) => (
    <div className="flex flex-col gap-3 mt-3">
      {stepList.map((s, i) => (
        <div key={i} className="flex flex-col items-start p-3">
          <p style={{ margin: 0, fontSize: v.stepTitle, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3 }}>{s.step}</p>
          <p style={{ margin: 0, fontSize: v.stepCue, color: "#6b7480", marginTop: 4, lineHeight: 1.3 }}>{s.cue}</p>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: v.stepReps, background: "#2653d420", color: "#2653d4" }}>{s.reps}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex }} onClick={requestClose} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      <style>{`@keyframes scheditem-pop-in{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}@keyframes scheditem-pop-out{from{transform:scale(1);opacity:1}to{transform:scale(0.94);opacity:0}}@keyframes scheditem-fade-out{from{opacity:1}to{opacity:0}}`}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: closing ? "scheditem-fade-out 0.28s cubic-bezier(0.4,0,1,1) both" : undefined }} />
      <div
        className="relative w-full bg-white flex flex-col"
        style={{ maxWidth: 420, borderRadius: 28, maxHeight: "80dvh", animation: closing ? "scheditem-pop-out 0.22s cubic-bezier(0.4,0,1,1) both" : "scheditem-pop-in 0.26s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
        <div className="overflow-y-auto flex-1 px-6 pb-6" style={{ minHeight: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${item.color}18`, borderRadius: 999, padding: "6px 14px", margin: "20px 0 12px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: v.timeLabel, fontWeight: 700, color: item.color }}>{item.time}{endTime ? ` – ${endTime}` : ""}</span>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: v.title, fontWeight: 800, color: "#1a1c1c", lineHeight: 1.25 }}>{item.title}</p>
          {item.subtitle && (
            // Keep a non-breaking space after em dashes so "—" never ends up
            // orphaned alone at the end of a wrapped line at this larger size.
            <p style={{ margin: "0 0 20px", fontSize: v.subtitle, fontWeight: 500, color: "#8a9096", lineHeight: 1.25 }}>{item.subtitle.replace(/ — /g, " — ")}</p>
          )}

          {isComplete ? (
            <button
              onClick={handleDoneClick}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 56, borderRadius: 28, border: `2px solid ${item.color}`, background: "transparent", cursor: "pointer" }}
            >
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: item.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
              </div>
              <span style={{ fontSize: v.doneLabel, fontWeight: 600, color: item.color }}>Completed</span>
            </button>
          ) : (
            <div
              ref={swipeTrackRef}
              style={{ position: "relative", height: 56, borderRadius: 28, background: "#f0f1f3", overflow: "hidden", touchAction: "none" }}
              onTouchStart={e => { swipeStartXRef.current = e.touches[0].clientX - swipeX; }}
              onTouchMove={e => {
                const track = swipeTrackRef.current;
                if (!track) return;
                const maxX = track.offsetWidth - 56;
                setSwipeX(Math.max(0, Math.min(maxX, e.touches[0].clientX - swipeStartXRef.current)));
              }}
              onTouchEnd={() => {
                const track = swipeTrackRef.current;
                if (!track) return;
                const maxX = track.offsetWidth - 56;
                if (swipeX >= maxX * 0.82) { handleDoneClick(); }
                setSwipeX(0);
              }}
            >
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: swipeX, background: item.color, transition: swipeX === 0 ? "width 0.3s" : "none" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span style={{ fontSize: v.swipeLabel, fontWeight: 600, color: "#8a9096", opacity: Math.max(0, 1 - swipeX / 80), transition: "opacity 0.1s" }}>{swipeLabelText}</span>
              </div>
              <div style={{ position: "absolute", top: 4, left: 4 + swipeX, width: 48, height: 48, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: swipeX === 0 ? "left 0.3s" : "none", pointerEvents: "none" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M13 6l6 6-6 6"/></svg>
              </div>
            </div>
          )}

          <div style={{ height: 1, background: "#f0f0f0", margin: "20px 0 0" }} />
          <button
            onClick={() => setDetailsOpen(x => !x)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", background: "none", border: "none", cursor: "pointer" }}
          >
            <span style={{ fontSize: v.detailsLabel, fontWeight: 700, color: "#1a1c1c" }}>Details</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {detailsOpen && (
            <div style={{ paddingBottom: 8 }}>
              {isMeal && detail?.type === "meal" && (
                <div className="flex flex-col">
                  <p className="font-bold uppercase tracking-widest pb-3" style={{ fontSize: v.focusLabel, color: "#8a9096" }}>{detail.focus}</p>
                  <p style={{ fontSize: v.bodyText, color: "#4a5050", lineHeight: 1.6, margin: "0 0 16px" }}>{detail.goal}</p>
                  <button
                    onClick={() => setMealSuggestionsOpen(x => !x)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 14, padding: "12px 14px", background: "#fff", boxShadow: "0 0 0 1px #f0f0f0", border: "none", cursor: "pointer", marginBottom: mealSuggestionsOpen ? 8 : 0 }}
                  >
                    <span style={{ fontSize: v.bodyText, fontWeight: 700, color: "#1a1c1c" }}>Suggestions</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: mealSuggestionsOpen ? "rotate(90deg)" : "rotate(0deg)" }}><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                  {mealSuggestionsOpen && (
                    <>
                      {detail.options.map((meal, i) => (
                        <div key={i}>
                          <button
                            onClick={() => setExpandedMealIdx(expandedMealIdx === i ? null : i)}
                            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                              <div
                                onClick={e => { e.stopPropagation(); setCheckedMeals(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; }); }}
                                style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${checkedMeals.has(i) ? "#16a34a" : "#c4c7c7"}`, background: checkedMeals.has(i) ? "#16a34a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                              >
                                {checkedMeals.has(i) && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>}
                              </div>
                              <span style={{ fontSize: v.optionTitle, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3, textAlign: "left" }}>{meal.title}</span>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: expandedMealIdx === i ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {expandedMealIdx === i && meal.detail && (
                            <p style={{ margin: "0 0 8px", fontSize: v.optionDetail, color: "#6b7480", lineHeight: 1.5 }}>{meal.detail}</p>
                          )}
                          {i < detail.options.length - 1 && <div style={{ height: 1, background: "#f0f0f0" }} />}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          checkedMeals.forEach(i => persistMealEntry(item, detail.options[i].title));
                          setDetailsOpen(false); setMealSuggestionsOpen(false); setExpandedMealIdx(null); setCheckedMeals(new Set());
                        }}
                        style={{ width: "100%", height: 48, borderRadius: 24, border: "none", background: item.color, color: "#fff", fontWeight: 700, fontSize: v.bodyText, cursor: "pointer", marginTop: 16 }}
                      >
                        Save
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setMealLogOpen(x => !x)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 14, padding: "12px 14px", background: "#fff", boxShadow: "0 0 0 1px #f0f0f0", border: "none", cursor: "pointer", marginTop: 8, marginBottom: mealLogOpen ? 8 : 0 }}
                  >
                    <span style={{ fontSize: v.bodyText, fontWeight: 700, color: "#1a1c1c" }}>Add manually</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: mealLogOpen ? "rotate(90deg)" : "rotate(0deg)" }}><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                  {mealLogOpen && (
                    <>
                      <textarea
                        value={mealText}
                        onChange={e => setMealText(e.target.value)}
                        placeholder="What did you eat?"
                        rows={3}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: v.textareaFont, color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box", background: "#f8f9fa" }}
                      />
                      <button
                        onClick={() => {
                          persistMealEntry(item, mealText);
                          setDetailsOpen(false); setMealLogOpen(false); setMealText("");
                        }}
                        style={{ width: "100%", height: 48, borderRadius: 24, border: "none", background: item.color, color: "#fff", fontWeight: 700, fontSize: v.bodyText, cursor: "pointer", marginTop: 16 }}
                      >
                        Save
                      </button>
                    </>
                  )}
                </div>
              )}
              {isInfo && detail?.type === "info" && (
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: v.focusLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{detail.focus}</p>
                  <p style={{ margin: 0, fontSize: v.infoText, color: "#4a5050", lineHeight: 1.7 }}>{detail.text}</p>
                </div>
              )}
              {isExercise && detail?.type === "exercise" && (
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: v.focusLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{detail.focus}</p>
                  {renderSteps(detail.steps)}
                </div>
              )}
              {isDrill && (
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: v.focusLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{drillDef.focus}</p>
                  {renderSteps(drillDef.steps)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
