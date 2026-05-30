"use client";

import React, { useState, useEffect } from "react";
import Nav2a from "@/components/nav2a";
import LogSheet from "@/components/log-sheet";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function getDayMsg(match: { date: string; time: string } | null, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
  if (match?.date === today) {
    const [mH, mM] = match.time.split(":").map(Number);
    const diffMins = mH * 60 + mM - now.getHours() * 60 - now.getMinutes();
    if (diffMins > 180) { const hrs = Math.floor(diffMins / 60); return `Match in ${hrs}h. Stay light, hydrate steadily, and eat your pre-game meal ${hrs > 4 ? "a few hours before" : "soon"}.`; }
    if (diffMins > 60) return "Time to warm up. Dynamic activation, no heavy food — just sip water and focus.";
    if (diffMins > 0) return "Almost game time. Breathe, visualise, and trust your prep.";
    return "Great match today. Prioritise recovery — stretch, eat protein, and rest up.";
  }
  if (match?.date === yesterday) return "Recovery day. Keep moving gently, drink plenty of water, and get your protein in.";
  return "Rest day. Let your body absorb the work. Hydrate, eat well, and take it easy.";
}

const READINESS = 85;

export default function Home6() {
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [doNowOpen, setDoNowOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) setMatchTime(`${m.date}T${m.time}`);
      }
    } catch {}
    const openLog = () => setLogOpen(true);
    window.addEventListener("open-log-sheet", openLog);
    return () => window.removeEventListener("open-log-sheet", openLog);
  }, []);

  const datePart = matchTime?.split("T")[0] ?? null;
  const timePart = matchTime?.split("T")[1] ?? null;
  const dateLabel = (() => {
    if (!datePart) return null;
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const d = new Date(datePart + "T12:00");
    if (datePart === today) return "Today";
    if (datePart === tomorrow) return "Tomorrow";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  })();

  const matchObj = matchTime
    ? { date: matchTime.split("T")[0], time: matchTime.split("T")[1] }
    : null;

  const S = {
    label: { fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 8px" },
    h2: { fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 700, color: "#1a1c1c", margin: "0 0 6px", letterSpacing: "-0.01em" },
    sub: { fontFamily: "Inter, sans-serif", fontSize: 15, color: "#6b7480", lineHeight: 1.5, margin: 0 },
    divider: { height: 1, background: "#e2e2e0" },
  };

  return (
    <main
      className="h1-font min-h-screen flex flex-col px-6 pt-16 pb-44"
      style={{ background: "#f5f5f3" }}
    >
      {/* Greeting — not clickable */}
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 6px" }}>
        {greeting()}
      </p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
        Eddie
      </p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: "#6b7480", lineHeight: 1.6, margin: "0 0 40px" }}>
        {getDayMsg(matchObj, new Date())}
      </p>

      <div style={{ ...S.divider, margin: "0 0 32px" }} />

      {/* Do This Now */}
      <button
        onClick={() => setDoNowOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "0 0 40px", display: "block", width: "100%" }}
        className="active:opacity-60 transition-opacity"
      >
        <p style={{ ...S.label, color: "#f59e0b" }}>Do This Now</p>
        <p style={S.h2}>Drink 500ml water</p>
        <p style={S.sub}>Before anything else this morning</p>
      </button>

      <div style={{ ...S.divider, margin: "0 0 32px" }} />

      {/* Next Match */}
      <button
        onClick={() => setMatchOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "0 0 40px", display: "block", width: "100%" }}
        className="active:opacity-60 transition-opacity"
      >
        <p style={{ ...S.label, color: "#8a9096" }}>Next Match</p>
        {dateLabel ? (
          <>
            <p style={S.h2}>{dateLabel}</p>
            <p style={{ ...S.sub, fontWeight: 600, color: "#2653d4" }}>{timePart}</p>
          </>
        ) : (
          <p style={{ ...S.sub, fontWeight: 600, color: "#2653d4" }}>+ Add a match</p>
        )}
      </button>

      <div style={{ ...S.divider, margin: "0 0 32px" }} />

      {/* Readiness */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-log-sheet"))}
        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, display: "block", width: "100%" }}
        className="active:opacity-60 transition-opacity"
      >
        <p style={{ ...S.label, color: "#8a9096" }}>Readiness</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 48, fontWeight: 800, color: "#2653d4", margin: "0 0 12px", lineHeight: 1, letterSpacing: "-0.03em" }}>
          {READINESS}
          <span style={{ fontSize: 18, fontWeight: 600, color: "#8a9096", marginLeft: 4 }}>/100</span>
        </p>
        {/* Bug */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e05c3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2h6M12 2v4M5 8l2 2M19 8l-2 2M3 13h3M18 13h3M5 20l2-2M19 20l-2-2M8 6a4 4 0 0 0-4 4v3a8 8 0 0 0 16 0v-3a4 4 0 0 0-4-4H8z"/>
          </svg>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#e05c3a", fontWeight: 600 }}>Sleep data missing — score may be lower</span>
        </div>
        {/* Add data */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#2653d4", fontWeight: 600 }} onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("open-log-sheet")); }}>Add data</span>
        </div>
      </button>

      <Nav2a />

      {/* Do This Now modal */}
      {doNowOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setDoNowOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4" style={{ background: "#f59e0b18" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#f59e0b" }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Wake up &amp; hydrate</h3>
              <p className="text-[15px] text-[#6b7480] mt-0.5">Drink 500ml water</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[17px] text-[#2c3235] leading-relaxed">
                Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Next Match modal */}
      {matchOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setMatchOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white rounded-[28px] px-6 py-7" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 700, color: "#1a1c1c", margin: "0 0 16px" }}>Next Match</p>
            {dateLabel ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>{dateLabel}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 600, color: "#2653d4", margin: 0 }}>{timePart}</p>
              </div>
            ) : (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 17, color: "#6b7480", margin: 0 }}>No match scheduled yet.</p>
            )}
          </div>
        </div>
      )}

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </main>
  );
}
