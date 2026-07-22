"use client";

import React, { useState, useEffect } from "react";
import type { ReviewEntry } from "@/lib/scoring";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PatternsSheet({ open, onClose }: Props) {
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    function load() {
      try {
        const raw = localStorage.getItem("padelop:match-reviews");
        setReviews(raw ? JSON.parse(raw) as ReviewEntry[] : []);
      } catch { setReviews([]); }
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

  const wellCounts: Record<string, number> = {};
  const badCounts: Record<string, number> = {};
  reviews.forEach(r => {
    (r.wellDone ?? []).forEach(t => { wellCounts[t] = (wellCounts[t] ?? 0) + 1; });
    (r.improved ?? []).forEach(t => { badCounts[t] = (badCounts[t] ?? 0) + 1; });
  });
  const wellTags = Object.entries(wellCounts).sort((a, b) => b[1] - a[1]);
  const badTags = Object.entries(badCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ background: "#1a1c1c0d", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#1a1c1c30", margin: "12px auto 10px" }} />
          <div style={{ padding: "0 18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#1a1c1c" }}>Patterns</p>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7480", background: "#e8eaed", borderRadius: 999, padding: "3px 12px" }}>{reviews.length} matches</span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          {wellTags.length === 0 && badTags.length === 0 ? (
            <p style={{ fontSize: 16, color: "#9aa0a6", margin: 0 }}>No tags yet — log match reviews to see your patterns.</p>
          ) : (
            <>
              {wellTags.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#16a34a" }}>What&apos;s Working</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {wellTags.map(([tag, count]) => (
                      <span key={tag} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0fdf4", borderRadius: 999, padding: "6px 12px" }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: "#15803d" }}>{tag}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 999, padding: "1px 7px" }}>{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {badTags.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#e11d48" }}>Needs Work</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {badTags.map(([tag, count]) => (
                      <span key={tag} style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff1f2", borderRadius: 999, padding: "6px 12px" }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: "#be123c" }}>{tag}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#e11d48", background: "#ffe4e6", borderRadius: 999, padding: "1px 7px" }}>{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
