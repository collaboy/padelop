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
  timeLabel: 15,
  title: "clamp(24px, 6.2vw, 28px)",
  subtitle: "clamp(19px, 5vw, 22px)",
  focusLabel: 14,
  bodyText: 19,
  optionTitle: 19,
  optionDetail: 16,
  textareaFont: "clamp(18px, 4.6vw, 20px)",
  stepTitle: 21, stepCue: 18, stepReps: 14,
  buttonLabel: 20,
};

interface Props {
  item: ScheduleItem;
  endTime?: string;
  drillTag: string | null;
  isComplete: boolean;
  onComplete: () => void;
  onClosed: () => void;
  onCompleteRevealed?: () => void;
  doneLabelText?: string;
  zIndex?: number;
  // Looking ahead at an item that hasn't started: read-only, can't be completed or logged yet.
  preview?: boolean;
  // In preview: the item just marked done, so a mis-tap can be reversed from here.
  undoTitle?: string;
  onUndo?: () => void;
}

export default function ScheduleItemModal({ item, endTime, drillTag, isComplete, onComplete, onClosed, onCompleteRevealed, doneLabelText = "Done", zIndex = 200, preview = false, undoTitle, onUndo }: Props) {
  const v = SIZES;
  const [closing, setClosing] = useState(false);
  const [checkedMeals, setCheckedMeals] = useState<Set<number>>(new Set());
  const [mealText, setMealText] = useState("");
  const [elseOpen, setElseOpen] = useState(false);
  // Drag-the-handle-down-to-close (pointer events, so it works with touch and mouse)
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<number | null>(null);

  const detail = SCHEDULE_DETAILS[item.title];
  const isMeal = detail?.type === "meal";
  const isExercise = detail?.type === "exercise";
  const isInfo = detail?.type === "info";
  const isDrill = !!item.isDrill;
  const drillDef = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
  const hasMealInput = isMeal && (checkedMeals.size > 0 || mealText.trim().length > 0);

  function requestClose() {
    setClosing(true);
    setDragY(0);
    setTimeout(onClosed, 400);
  }

  function logMeals() {
    if (detail?.type !== "meal") return;
    checkedMeals.forEach(i => persistMealEntry(item, detail.options[i].title));
    persistMealEntry(item, mealText);
  }

  function handleDoneClick() {
    const wasComplete = isComplete;
    onComplete();
    if (!wasComplete) {
      // Start the reveal immediately so the checkmark celebration underneath
      // draws in WHILE this modal fades out, instead of after it's gone.
      onCompleteRevealed?.();
      setTimeout(requestClose, 80);
    } else {
      requestClose();
    }
  }

  function handlePrimary() {
    if (preview) { requestClose(); return; }
    if (isMeal && hasMealInput) logMeals();
    // Already done + new meal input → just log it and close, don't undo completion.
    if (isComplete && hasMealInput) { requestClose(); return; }
    handleDoneClick();
  }

  const primaryLabel = preview ? "Got it" : isComplete
    ? (hasMealInput ? "Log meal" : "Completed")
    : (hasMealInput ? "Log meal & done" : doneLabelText);

  const renderSteps = (stepList: { step: string; cue: string; reps: string }[]) => (
    <div className="flex flex-col gap-4 mt-3">
      {stepList.map((s, i) => (
        <div key={i} className="flex items-start gap-3">
          <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: `${item.color}22`, color: "#1a1c1c", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{i + 1}</span>
          <div className="flex flex-col items-start">
            <p style={{ margin: 0, fontSize: v.stepTitle, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3 }}>{s.step}</p>
            <p style={{ margin: 0, fontSize: v.stepCue, color: "#6b7480", marginTop: 4, lineHeight: 1.35 }}>{s.cue}</p>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: v.stepReps, background: "#2653d420", color: "#2653d4" }}>{s.reps}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const hasBody = isMeal || isExercise || isInfo || isDrill;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex }}
      onClick={() => requestClose()}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <style>{`@keyframes scheditem-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes scheditem-slide-down{from{transform:translateY(0)}to{transform:translateY(100%)}}@keyframes scheditem-fade-out{from{opacity:1}to{opacity:0}}`}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: closing ? "scheditem-fade-out 0.4s ease both" : undefined }} />
      <div
        className="relative w-full bg-white flex flex-col"
        style={{
          maxHeight: "85dvh", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 0.2s ease",
          animation: closing ? "scheditem-slide-down 0.3s ease both" : "scheditem-slide-up 0.28s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — pull down to close */}
        <div
          style={{ padding: "12px 0 8px", flexShrink: 0, cursor: "grab", touchAction: "none" }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragStartRef.current = e.clientY; setDragging(true); }}
          onPointerMove={e => { if (dragStartRef.current !== null) setDragY(Math.max(0, e.clientY - dragStartRef.current)); }}
          onPointerUp={() => {
            const shouldClose = dragY > 100;
            dragStartRef.current = null;
            setDragging(false);
            if (shouldClose) requestClose(); else setDragY(0);
          }}
          onPointerCancel={() => { dragStartRef.current = null; setDragging(false); setDragY(0); }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#d6d8da", margin: "0 auto" }} />
        </div>

        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "8px 24px 16px" }}>
          {preview && (
            <p style={{ margin: "0 0 10px", fontSize: v.timeLabel, fontWeight: 600, color: "#4a5050" }}>Up next — nothing to do until {item.time}.</p>
          )}
          <p style={{ margin: 0, fontSize: v.timeLabel, fontWeight: 700, color: "#8a9096", letterSpacing: "0.04em" }}>
            {item.time}{endTime ? ` – ${endTime}` : ""}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: v.title, fontWeight: 800, color: "#1a1c1c", lineHeight: 1.25 }}>{item.title}</p>
          {item.subtitle && (
            // Keep a non-breaking space after em dashes so "—" never ends up
            // orphaned alone at the end of a wrapped line.
            <p style={{ margin: "6px 0 0", fontSize: v.subtitle, fontWeight: 500, color: "#4a5050", lineHeight: 1.3 }}>{item.subtitle.replace(/ — /g, " —\xa0")}</p>
          )}

          {hasBody && <div style={{ height: 1, background: "#f0f0f0", margin: "18px 0 16px" }} />}

          {isMeal && detail?.type === "meal" && (
            <div className="flex flex-col">
              <p className="font-bold uppercase tracking-widest" style={{ fontSize: v.focusLabel, color: "#8a9096", margin: "0 0 12px" }}>{detail.focus}</p>
              <div className="flex flex-col gap-2">
                {detail.options.map((meal, i) => {
                  const on = checkedMeals.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setCheckedMeals(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                      aria-pressed={on}
                      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 16, cursor: "pointer", background: on ? `${item.color}1f` : "#fff", border: `2px solid ${on ? item.color : "#eceef0"}` }}
                    >
                      <span style={{ flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? item.color : "#c4c7c7"}`, background: on ? item.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: v.optionTitle, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3 }}>{meal.title}</span>
                        {on && meal.detail && <span style={{ fontSize: v.optionDetail, color: "#6b7480", lineHeight: 1.4 }}>{meal.detail}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {preview ? null : elseOpen || mealText ? (
                <textarea
                  value={mealText}
                  onChange={e => setMealText(e.target.value)}
                  placeholder="What else did you have?"
                  rows={2}
                  autoFocus={elseOpen && !mealText}
                  style={{ width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 16, border: "2px solid #eceef0", fontSize: v.textareaFont, color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.4, boxSizing: "border-box" }}
                />
              ) : (
                <button
                  onClick={() => setElseOpen(true)}
                  style={{ alignSelf: "flex-start", marginTop: 8, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontSize: v.optionDetail + 1, fontWeight: 600, color: "#6b7480" }}
                >
                  + Something else
                </button>
              )}
            </div>
          )}
          {isInfo && detail?.type === "info" && (
            <div>
              <p style={{ margin: "0 0 10px", fontSize: v.focusLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8a9096" }}>{detail.focus}</p>
              <p style={{ margin: 0, fontSize: v.bodyText, color: "#4a5050", lineHeight: 1.6 }}>{detail.text}</p>
            </div>
          )}
          {isExercise && detail?.type === "exercise" && (
            <div>
              <p style={{ margin: "0 0 4px", fontSize: v.focusLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8a9096" }}>{detail.focus}</p>
              {renderSteps(detail.steps)}
            </div>
          )}
          {isDrill && (
            <div>
              <p style={{ margin: "0 0 4px", fontSize: v.focusLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8a9096" }}>{drillDef.focus}</p>
              {renderSteps(drillDef.steps)}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 24px calc(20px + env(safe-area-inset-bottom))", flexShrink: 0, borderTop: hasBody ? "1px solid #f0f0f0" : undefined }}>
          <button
            onClick={handlePrimary}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", height: 60, borderRadius: 30, cursor: "pointer",
              ...(preview || (isComplete && !hasMealInput)
                ? { border: `2px solid ${item.color}`, background: "transparent", color: item.color }
                : { border: "none", background: item.color, color: "#fff" }),
              fontSize: v.buttonLabel, fontWeight: 700,
            }}
          >
            {!preview && isComplete && !hasMealInput && (
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: item.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
              </span>
            )}
            {primaryLabel}
          </button>
          {preview && undoTitle && onUndo && (
            <button
              onClick={() => { onUndo(); requestClose(); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6b7480" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
              Go back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
