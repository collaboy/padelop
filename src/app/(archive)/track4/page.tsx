"use client";

import React, { useState } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";

const S = { fontFamily: "Inter, sans-serif" };

const ITEMS = [
  { title: "Hydration", subtitle: "Log water intake", color: "#0891b2" },
  { title: "Energy", subtitle: "How do you feel today?", color: "#f59e0b" },
  { title: "Soreness", subtitle: "Rate body condition", color: "#7c3aed" },
  { title: "Sleep", subtitle: "Log last night", color: "#2653d4" },
];

export default function Track4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 176 }}>
      <p style={{ ...S, fontSize: 26, fontWeight: 700, color: "#1a1c1c", padding: "40px 16px 16px", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
        What do you want to track?
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
        {ITEMS.map((item) => (
          <button
            key={item.title}
            style={{ ...S, background: "#fff", borderRadius: 24, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", border: "none", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: item.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: item.color }} />
              </div>
              <div>
                <p style={{ ...S, fontSize: 17, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>{item.title}</p>
                <p style={{ ...S, fontSize: 13, color: "#6b7480", margin: "2px 0 0" }}>{item.subtitle}</p>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
          width: 56, height: 56, borderRadius: 28,
          background: "#c5e840",
          boxShadow: "0 4px 16px #c5e84055",
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
