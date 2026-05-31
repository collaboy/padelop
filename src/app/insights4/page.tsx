"use client";

import React, { useState } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";

const S = { fontFamily: "Inter, sans-serif" };

const BREAKDOWN = [
  { label: "Hydration", value: 84, color: "#0891b2" },
  { label: "Recovery",  value: 76, color: "#7c3aed" },
  { label: "Energy",    value: 89, color: "#f59e0b" },
  { label: "Sleep",     value: 91, color: "#2653d4" },
];

const overall = Math.round(BREAKDOWN.reduce((s, r) => s + r.value, 0) / BREAKDOWN.length);

const IMPROVE = ["Drink water", "Mobility session", "Early dinner"];

export default function Insights4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "40px 16px 176px" }}>
      {/* Match Readiness score */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 12px" }}>Match Readiness</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span style={{ ...S, fontSize: 64, fontWeight: 700, lineHeight: 1, color: "#2653d4" }}>{overall}</span>
          <span style={{ ...S, fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#2653d4" }}>%</span>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Breakdown</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {BREAKDOWN.map((row) => (
            <div key={row.label}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ ...S, fontSize: 15, fontWeight: 500, color: "#1a1c1c" }}>{row.label}</span>
                <span style={{ ...S, fontSize: 15, fontWeight: 700, color: "#1a1c1c" }}>{row.value}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: "#f0f0f0", overflow: "hidden" }}>
                <div style={{ height: 4, borderRadius: 999, background: row.color, width: `${row.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Improve Score */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Improve Score</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {IMPROVE.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4", flexShrink: 0 }} />
              <span style={{ ...S, fontSize: 15, fontWeight: 500, color: "#1a1c1c" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
          width: 56, height: 56, borderRadius: 28,
          background: "#2653d4",
          boxShadow: "0 4px 16px #2653d455",
        }}
        aria-label="Log activity"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <Nav4 />
      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
    </main>
  );
}
