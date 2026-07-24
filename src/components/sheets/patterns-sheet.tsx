"use client";

import React from "react";
import type { ReviewEntry } from "@/lib/scoring";

function loadTagBreakdown() {
  const reviews: ReviewEntry[] = (() => { try { const raw = localStorage.getItem("padelop:match-reviews"); return raw ? JSON.parse(raw) as ReviewEntry[] : []; } catch { return []; } })();
  const wellCounts: Record<string, number> = {};
  const badCounts: Record<string, number> = {};
  reviews.forEach(r => {
    (r.wellDone ?? []).forEach(t => { wellCounts[t] = (wellCounts[t] ?? 0) + 1; });
    (r.improved ?? []).forEach(t => { badCounts[t] = (badCounts[t] ?? 0) + 1; });
  });
  const wellTags = Object.entries(wellCounts).sort((a, b) => b[1] - a[1]);
  const badTags = Object.entries(badCounts).sort((a, b) => b[1] - a[1]);
  return { wellTags, badTags };
}

export function getPatternsTagCount() {
  const { wellTags, badTags } = loadTagBreakdown();
  return wellTags.length + badTags.length;
}

export default function PatternsContent() {
  const { wellTags, badTags } = loadTagBreakdown();

  if (wellTags.length === 0 && badTags.length === 0) {
    return <p style={{ fontSize: 21, color: "#9aa0a6", margin: 0 }}>No tags yet — log match reviews to see your patterns.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {wellTags.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#16a34a" }}>What&apos;s Working</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {wellTags.map(([tag, count]) => (
              <span key={tag} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0fdf4", borderRadius: 999, padding: "6px 12px" }}>
                <span style={{ fontSize: 21, fontWeight: 600, color: "#15803d" }}>{tag}</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 999, padding: "1px 7px" }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {badTags.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#e11d48" }}>Needs Work</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {badTags.map(([tag, count]) => (
              <span key={tag} style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff1f2", borderRadius: 999, padding: "6px 12px" }}>
                <span style={{ fontSize: 21, fontWeight: 600, color: "#be123c" }}>{tag}</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#e11d48", background: "#ffe4e6", borderRadius: 999, padding: "1px 7px" }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
