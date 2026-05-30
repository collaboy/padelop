"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";

const S = { fontFamily: "Inter, sans-serif" };

function matchLabel(date: string, time: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const d = new Date(date + "T12:00");
  const dayNum = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const dateStr = date === today ? "Today" : date === tomorrow ? "Tomorrow" : `${weekday} ${dayNum} ${month}`;
  return dateStr;
}

const PREP_OFFSETS = [
  { label: "Pre-game meal", offsetMins: -360 },
  { label: "Warmup", offsetMins: -60 },
  { label: "Match", offsetMins: 0 },
  { label: "Cool down", offsetMins: 90 },
];

const pad = (n: number) => String(n).padStart(2, "0");
function addMins(timeStr: string, delta: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

export default function Matches4() {
  const [match, setMatch] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) setMatch(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "40px 16px 176px" }}>
      {/* Next Match */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 12px" }}>Next Match</p>
        {match ? (
          <>
            <p style={{ ...S, fontSize: 22, fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1.2 }}>{matchLabel(match.date, match.time)}</p>
            <p style={{ ...S, fontSize: 18, fontWeight: 600, color: "#2653d4", margin: "4px 0 0" }}>{match.time}</p>
          </>
        ) : (
          <button style={{ ...S, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 17, fontWeight: 600, color: "#2653d4" }}>
            + Add a match
          </button>
        )}
      </div>

      {/* Match Prep Timeline */}
      {match && (
        <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Match Prep Timeline</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PREP_OFFSETS.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ ...S, fontSize: 13, color: "#8a9096", fontVariantNumeric: "tabular-nums", width: 48, flexShrink: 0 }}>
                  {addMins(match.time, row.offsetMins)}
                </span>
                <span style={{ ...S, fontSize: 16, fontWeight: 500, color: "#1a1c1c" }}>{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Match button (always shown) */}
      <button
        style={{ ...S, background: "#fff", borderRadius: 24, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", border: "none", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <span style={{ ...S, fontSize: 16, fontWeight: 700, color: "#2653d4" }}>Add Match +</span>
      </button>

      <Nav4 />
    </main>
  );
}
