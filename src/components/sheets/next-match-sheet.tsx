"use client";

import React, { useState, useEffect } from "react";
import type { ReviewEntry } from "@/lib/scoring";

type StoredMatch = {
  date: string; time: string; club: string; court?: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};

function fmtCountdown(date: string, time: string) {
  const now = new Date();
  const diff = new Date(date + "T" + (time || "00:00")).getTime() - now.getTime();
  if (diff < 0) return "Past";
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRateMatch: () => void;
}

export default function NextMatchSheet({ open, onClose, onRateMatch }: Props) {
  const [nextMatch, setNextMatch] = useState<StoredMatch | null>(null);
  const [upcoming, setUpcoming] = useState<StoredMatch[]>([]);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    function load() {
      try {
        const raw = localStorage.getItem("padelop:next-match");
        const m = raw ? (JSON.parse(raw) as StoredMatch) : null;
        const isFuture = m?.date && m?.time && new Date(`${m.date}T${m.time}`).getTime() > Date.now();
        setNextMatch(isFuture ? m : null);
      } catch { setNextMatch(null); }
      try { setUpcoming(JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]")); } catch { setUpcoming([]); }
      try { setReviews(JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")); } catch { setReviews([]); }
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

  const reviewedDates = new Set(
    reviews.map(r => (r as ReviewEntry & { matchDate?: string }).matchDate ?? r.ts?.slice(0, 10)).filter(Boolean)
  );
  const seen = new Set<string>();
  const needsRating = ([...upcoming, nextMatch] as (StoredMatch | null)[])
    .filter((m): m is StoredMatch => !!m)
    .filter(m => {
      if (!m.date || !m.time || seen.has(m.date)) return false;
      seen.add(m.date);
      return new Date(`${m.date}T${m.time}:00`).getTime() < Date.now() && !reviewedDates.has(m.date);
    });

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ background: "#2653d414", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#2653d440", margin: "12px auto 10px" }} />
          <div style={{ padding: "0 18px 16px" }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#2653d4" }}>Next Match</p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
          {needsRating.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: "0 4px", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>NEEDS RATING</p>
              {needsRating.map((m, i) => (
                <button
                  key={i}
                  onClick={() => { onClose(); onRateMatch(); }}
                  style={{ width: "100%", background: "#f0f4ff", border: "none", borderRadius: 16, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                >
                  <div style={{ flexShrink: 0, width: 44, textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#2653d4", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: "#1a1c1c", lineHeight: 1 }}>{new Date(m.date + "T12:00").getDate()}</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>{m.time}{m.club ? ` · ${m.club}` : ""}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#2653d4", fontWeight: 600 }}>Tap to rate this match</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {nextMatch ? (() => {
            const players = [nextMatch.player_1, nextMatch.player_2, nextMatch.player_3, nextMatch.player_4].filter(Boolean);
            const countdown = fmtCountdown(nextMatch.date, nextMatch.time);
            const isToday2 = countdown === "Today";
            return (
              <div style={{ background: "#fff", borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flexShrink: 0, width: 48, textAlign: "center", background: isToday2 ? "#eef2ff" : "#f8f9fa", borderRadius: 12, padding: "8px 4px" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(nextMatch.date + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: isToday2 ? "#2653d4" : "#1a1c1c", lineHeight: 1 }}>{new Date(nextMatch.date + "T12:00").getDate()}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(nextMatch.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</p>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>{nextMatch.time || "—"}</span>
                    {nextMatch.club && <span style={{ fontSize: 15, color: "#8a9096", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {nextMatch.club}{nextMatch.court ? ` #${nextMatch.court}` : ""}</span>}
                  </div>
                  {players.length > 0 && <p style={{ margin: 0, fontSize: 15, color: "#8a9096", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{players.join(", ")}</p>}
                  <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isToday2 ? "#eef2ff" : "#f4f6f8", color: isToday2 ? "#2653d4" : "#8a9096" }}>{countdown}</span>
                </div>
              </div>
            );
          })() : (
            <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>No upcoming match</p>
              <p style={{ margin: 0, fontSize: 15, color: "#8a9096" }}>Schedule your next game to see it here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
