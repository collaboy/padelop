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

const MIN_SIZE = 44;
const MAX_SIZE = 84;
const COL_WIDTH = 88;

function TagBubble({ tag, count, maxCount, color, bg }: { tag: string; count: number; maxCount: number; color: string; bg: string }) {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const size = Math.round(MIN_SIZE + ratio * (MAX_SIZE - MIN_SIZE));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: COL_WIDTH, flexShrink: 0 }}>
      <div
        style={{
          width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ fontSize: size >= 64 ? 40 : 32, fontWeight: 800, color, lineHeight: 1 }}>{count}</span>
      </div>
      <span style={{ fontSize: 26, fontWeight: 600, color: "#4a5050", lineHeight: 1.25, textAlign: "center" }}>{tag}</span>
    </div>
  );
}

export default function PatternsContent() {
  const { wellTags, badTags } = loadTagBreakdown();

  if (wellTags.length === 0 && badTags.length === 0) {
    return <p style={{ fontSize: 30, color: "#9aa0a6", margin: 0 }}>No tags yet — log match reviews to see your patterns.</p>;
  }

  const wellMax = wellTags.length > 0 ? wellTags[0][1] : 0;
  const badMax = badTags.length > 0 ? badTags[0][1] : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {wellTags.length > 0 && (
        <div>
          <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#16a34a" }}>What&apos;s Working</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {wellTags.map(([tag, count]) => (
              <TagBubble key={tag} tag={tag} count={count} maxCount={wellMax} color="#15803d" bg="#dcfce7" />
            ))}
          </div>
        </div>
      )}
      {badTags.length > 0 && (
        <div>
          <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#e11d48" }}>Needs Work</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {badTags.map(([tag, count]) => (
              <TagBubble key={tag} tag={tag} count={count} maxCount={badMax} color="#be123c" bg="#ffe4e6" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
