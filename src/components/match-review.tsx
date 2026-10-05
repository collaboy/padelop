"use client";

import React, { useState } from "react";
import { saveMatchReview } from "@/lib/db";
import { startPlusOne } from "@/lib/nav-events";
import { DRILL_LIBRARY, getTopNeedsWorkTag } from "@/lib/schedule-data";

interface Props {
  open: boolean;
  matchDate: string | null;
  onClose: () => void;
  onDismiss: () => void;
  previewMode?: boolean;
}

const BLUE = "#2653d4"; // "Padla asks you" colour — shared with the daily check-in
const TAGS = ["Serve", "Bandeja", "Smash", "Volleys", "Defense", "Attack", "Positioning", "Communication", "Movement", "Mental strength"];

const EMPTY = { feeling: "", result: "", opponent: "", partnerName: "", opponentNames: "", energy: "", injury: "", wellDone: [] as string[], improved: [] as string[], mentalBefore: "", mentalDuring: "", mentalAfter: "", warmup: "", notes: "" };
type Review = typeof EMPTY;
type ChoiceKey = "result" | "energy" | "injury" | "mentalBefore" | "mentalDuring" | "mentalAfter";

const eyebrow: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096" };
const rowLabel: React.CSSProperties = { margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#1a1c1c" };
const pillButton: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 60, borderRadius: 30, border: "none", cursor: "pointer", fontSize: 20, fontWeight: 800, transition: "background 0.2s, color 0.2s" };
const quietButton: React.CSSProperties = { display: "block", width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6b7480" };
const textInput: React.CSSProperties = { width: "100%", padding: "12px 16px", borderRadius: 16, border: "none", background: "#eef0f2", fontSize: 16, fontWeight: 500, color: "#1a1c1c", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

export default function MatchReview(props: Props) {
  // Mounted only while open, so each opening starts from a fresh, pre-filled form.
  if (!props.open) return null;
  return <ReviewCard {...props} />;
}

function ReviewCard({ matchDate, onClose, onDismiss, previewMode }: Props) {
  const [review, setReview] = useState<Review>(() => {
    // Pre-fill partner/opponent names from the scheduled match — player_2 is
    // your partner, player_3/player_4 are the opponents.
    try {
      const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
      return { ...EMPTY, partnerName: m?.player_2 ?? "", opponentNames: [m?.player_3, m?.player_4].filter(Boolean).join(", ") };
    } catch { return EMPTY; }
  });
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saved, setSaved] = useState<{ headline: string; line: string } | null>(null);

  const ready = !!review.result;

  const close = onClose;

  function save() {
    if (!ready) return;
    if (!previewMode) {
      try {
        const { matchDateSaved, matchTimeSaved } = (() => { try { const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); return { matchDateSaved: m?.date ?? null, matchTimeSaved: m?.time ?? null }; } catch { return { matchDateSaved: null, matchTimeSaved: null }; } })();
        const entry = { ...review, resultImage: resultImage ?? undefined, ts: new Date().toISOString(), matchDate: matchDateSaved, matchTime: matchTimeSaved };
        const prev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
        localStorage.setItem("padelop:match-reviews", JSON.stringify([entry, ...prev].slice(0, 50)));
        saveMatchReview(entry);
      } catch {}
      startPlusOne();
      window.dispatchEvent(new Event("storage"));
    }
    // The drill on training days follows the most-picked "needs work" tag across all reviews.
    const tag = previewMode ? (review.improved[0] ?? getTopNeedsWorkTag()) : getTopNeedsWorkTag();
    setSaved({
      headline: review.result === "win" ? "Nice win." : "Tough one. On to the next.",
      line: tag && DRILL_LIBRARY[tag]
        ? `Your next training day drill: ${tag}.`
        : "Eat, hydrate and get a good night.",
    });
  }

  const choices = (key: ChoiceKey, opts: [string, string][], colors?: Record<string, string>) => (
    <div className="flex" style={{ gap: 8 }}>
      {opts.map(([v, label]) => {
        const sel = review[key] === v;
        return (
          <button
            key={v}
            aria-pressed={sel}
            onClick={() => setReview(r => ({ ...r, [key]: v }))}
            className="flex-1 active:scale-95 transition-transform"
            style={{ height: 48, borderRadius: 24, border: "none", cursor: "pointer", padding: "0 6px", fontSize: 15, fontWeight: 700, background: sel ? (colors?.[v] ?? BLUE) : "#eef0f2", color: sel ? "#fff" : "#4a5050", transition: "background 0.15s, color 0.15s" }}>
            {label}
          </button>
        );
      })}
    </div>
  );

  const tags = (key: "improved" | "wellDone") => (
    <div className="flex flex-wrap" style={{ gap: 8 }}>
      {TAGS.map(tag => {
        const sel = review[key].includes(tag);
        return (
          <button
            key={tag}
            aria-pressed={sel}
            onClick={() => setReview(r => ({ ...r, [key]: sel ? r[key].filter(t => t !== tag) : [...r[key], tag] }))}
            className="active:scale-95 transition-transform"
            style={{ height: 38, padding: "0 14px", borderRadius: 19, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: sel ? BLUE : "#eef0f2", color: sel ? "#fff" : "#4a5050", transition: "background 0.15s, color 0.15s" }}>
            {tag}
          </button>
        );
      })}
    </div>
  );

  const dateLabel = matchDate
    ? new Date(matchDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
    : "1 minute";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ padding: 16 }}
      onClick={saved ? close : onDismiss}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <style>{`@keyframes mr-pop{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}@keyframes mr-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full bg-white flex flex-col"
        style={{ maxWidth: "calc(var(--app-w) - 32px)", maxHeight: "calc(100dvh - 32px)", borderRadius: 28, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", animation: "mr-pop 0.22s cubic-bezier(0.22,1,0.36,1)" }}
        onClick={e => e.stopPropagation()}
      >
        {!saved ? (
          <>
            <div className="overflow-y-auto flex-1" style={{ position: "relative", minHeight: 0, padding: "76px 24px 8px" }}>
              {/* A ball peeking down from the top centre — blue here, green on the check-in; scrolls away with the content */}
              <div aria-hidden style={{ position: "absolute", top: -64, left: "50%", marginLeft: -60, width: 120, height: 120, borderRadius: "50%", background: BLUE, pointerEvents: "none" }} />
              <p style={eyebrow}>{dateLabel}</p>
              <p style={{ margin: "6px 0 0", fontSize: "clamp(28px, 7.5vw, 34px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15, letterSpacing: "-0.02em" }}>Great game!</p>
              <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 500, color: "#6b7480", lineHeight: 1.4 }}>Rate your match while it&apos;s fresh.</p>
              <div className="flex flex-col" style={{ gap: 20, marginTop: 24 }}>
                <div>
                  <p style={rowLabel}>Result</p>
                  {choices("result", [["win", "Win"], ["loss", "Loss"]], { win: "#16a34a", loss: "#dc2626" })}
                  {resultImage ? (
                    <div className="relative" style={{ marginTop: 10 }}>
                      <img src={resultImage} alt="Match result" className="w-full object-cover" style={{ maxHeight: 200, borderRadius: 16 }} />
                      <button onClick={() => setResultImage(null)} aria-label="Remove screenshot" className="absolute flex items-center justify-center" style={{ top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.5)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <label style={{ ...quietButton, fontSize: 15, textAlign: "left" }}>
                      + Add a result screenshot
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setResultImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
                <div>
                  <p style={rowLabel}>Energy going in</p>
                  {choices("energy", [["low", "Low"], ["mid", "Medium"], ["high", "High"]])}
                </div>
                <div>
                  <p style={rowLabel}>How you felt after</p>
                  {choices("mentalAfter", [["bad", "Frustrated"], ["ok", "OK"], ["great", "Satisfied"]])}
                </div>
                <div>
                  <p style={rowLabel}>Any pain or injury?</p>
                  {choices("injury", [["no", "None"], ["minor", "Minor"], ["yes", "Yes"]], { minor: "#d97706", yes: "#dc2626" })}
                </div>
                <div>
                  <p style={rowLabel}>What went well?</p>
                  {tags("wellDone")}
                </div>
                <div>
                  <p style={rowLabel}>What needs work?</p>
                  {tags("improved")}
                </div>

                {!detailOpen ? (
                  <button onClick={() => setDetailOpen(true)} style={{ ...quietButton, marginTop: 0, fontSize: 15, textAlign: "left" }}>+ Add detail</button>
                ) : (
                  <>
                    <div>
                      <p style={rowLabel}>Partner</p>
                      <input type="text" placeholder="e.g. Ana" value={review.partnerName} onChange={e => setReview(r => ({ ...r, partnerName: e.target.value }))} style={textInput} />
                    </div>
                    <div>
                      <p style={rowLabel}>Opponents</p>
                      <input type="text" placeholder="e.g. Marco & Luis" value={review.opponentNames} onChange={e => setReview(r => ({ ...r, opponentNames: e.target.value }))} style={textInput} />
                    </div>
                    <div>
                      <p style={rowLabel}>Head before</p>
                      {choices("mentalBefore", [["bad", "Nervous"], ["ok", "Calm"], ["great", "Confident"]])}
                    </div>
                    <div>
                      <p style={rowLabel}>Head during</p>
                      {choices("mentalDuring", [["bad", "Lost focus"], ["ok", "Steady"], ["great", "In the zone"]])}
                    </div>
                    <div>
                      <p style={rowLabel}>Notes</p>
                      <textarea value={review.notes} onChange={e => setReview(r => ({ ...r, notes: e.target.value }))} placeholder="Key moments, tactics, the players…" rows={3} style={{ ...textInput, resize: "none", lineHeight: 1.5 }} />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ padding: "16px 24px 16px", flexShrink: 0 }}>
              <button
                onClick={save}
                disabled={!ready}
                style={{ ...pillButton, background: ready ? BLUE : "#E5E7EB", color: ready ? "#fff" : "rgba(0,0,0,0.4)", cursor: ready ? "pointer" : "default" }}>
                {ready ? "Done" : "Pick a result"}
              </button>
              <button onClick={onDismiss} style={quietButton}>Not now</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ position: "relative", padding: "76px 24px 8px" }}>
              {/* A ball peeking down from the top centre — blue here, green on the check-in; scrolls away with the content */}
              <div aria-hidden style={{ position: "absolute", top: -64, left: "50%", marginLeft: -60, width: 120, height: 120, borderRadius: "50%", background: BLUE, pointerEvents: "none" }} />
              <p style={eyebrow}>Review saved</p>
              <p style={{ margin: "10px 0 0", fontSize: "clamp(32px, 9vw, 42px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.08, letterSpacing: "-0.02em" }}>{saved.headline}</p>
              <p style={{ margin: "16px 0 0", fontSize: 19, fontWeight: 500, color: "#4a5050", lineHeight: 1.4 }}>{saved.line}</p>
            </div>
            <div style={{ padding: "20px 24px 24px", flexShrink: 0 }}>
              <button onClick={close} style={{ ...pillButton, background: BLUE, color: "#fff" }}>Let&apos;s go</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
