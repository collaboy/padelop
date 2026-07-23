"use client";

import React from "react";

function Row({ color, title, value, sub, onTap }: { color: string; title: string; value: React.ReactNode; sub: string; onTap?: () => void }) {
  return (
    <div
      onClick={onTap}
      style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: "12px 14px", background: "#fff", boxShadow: "0 0 0 1px #f0f0f0", cursor: onTap ? "pointer" : "default" }}
    >
      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1e` }}>
        <div style={{ width: 13, height: 13, borderRadius: "50%", background: color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color }}>{title}</p>
        <p style={{ fontSize: "clamp(17px, 4.4vw, 20px)", fontWeight: 700, margin: 0, lineHeight: 1.25, color: "#1a1c1c" }}>{value}</p>
        <p style={{ fontSize: "clamp(12px, 3.1vw, 14px)", margin: "2px 0 0", color: "#6b7480" }}>{sub}</p>
      </div>
      {onTap && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  points: number;
  streak: number;
  winRate: number | null;
  insightsCount: number;
  patternsCount: number;
  onOpenStreak: () => void;
  onOpenMatches: () => void;
  onOpenInsights: () => void;
  onOpenPatterns: () => void;
}

export default function StatsSheet({ open, onClose, points, streak, winRate, insightsCount, patternsCount, onOpenStreak, onOpenMatches, onOpenInsights, onOpenPatterns }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ background: "#1a1c1c0d", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#1a1c1c30", margin: "12px auto 10px" }} />
          <div style={{ padding: "0 18px 16px" }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#1a1c1c" }}>Stats</p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Row color="#1a1c1c" title="Padla Pts" value={points > 0 ? points : "—"} sub="completed today" />
          <Row color="#f59e0b" title="Streak" value={streak > 0 ? streak : "—"} sub={streak > 0 ? "days in a row" : "start today"} onTap={onOpenStreak} />
          <Row color="#dc2626" title="Win Rate" value={winRate !== null ? `${winRate}%` : "—"} sub={winRate !== null ? (winRate >= 60 ? "strong" : winRate >= 40 ? "building" : "keep going") : "no matches logged"} onTap={onOpenMatches} />
          <Row color="#f59e0b" title="Insights" value={insightsCount > 0 ? insightsCount : "—"} sub="available" onTap={onOpenInsights} />
          <Row color="#e11d48" title="Patterns" value={patternsCount > 0 ? patternsCount : "—"} sub="tags logged" onTap={onOpenPatterns} />
        </div>
      </div>
    </div>
  );
}
