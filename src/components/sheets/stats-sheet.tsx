"use client";

import React, { useState } from "react";
import FormScoreContent from "./form-score-sheet";
import StreakContent from "./streak-sheet";
import MatchesContent from "./matches-sheet";
import InsightsContent, { getInsightsPool } from "./insights-sheet";
import PatternsContent, { getPatternsTagCount } from "./patterns-sheet";

const MILESTONES = [10, 25, 50, 75, 100, 250, 500, 1000];

function ExpandableRow({ color, title, value, sub, expanded, onToggle, children }: { color: string; title: string; value: React.ReactNode; sub: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, background: "#fff", boxShadow: "0 0 0 1px #f0f0f0", overflow: "hidden", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" }}
      >
        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1e` }}>
          <div style={{ width: 13, height: 13, borderRadius: "50%", background: color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color }}>{title}</p>
          <p style={{ fontSize: "clamp(34px, 8.8vw, 40px)", fontWeight: 700, margin: 0, lineHeight: 1.25, color: "#1a1c1c" }}>{value}</p>
          <p style={{ fontSize: "clamp(24px, 6.2vw, 28px)", margin: "2px 0 0", color: "#6b7480" }}>{sub}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}><path d="M9 18l6-6-6-6"/></svg>
      </div>
      {expanded && (
        <div style={{ padding: "14px 14px 16px", borderTop: "1px solid #f0f0f0" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function PadlaPtsRow({ points, expanded, onToggle }: { points: number; expanded: boolean; onToggle: () => void }) {
  const [showAll, setShowAll] = useState(false);

  const sd: Record<string, string[]> = (() => { try { return JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}"); } catch { return {}; } })();
  const allCompletions = Object.values(sd).flat();
  const breakdown: Record<string, number> = {};
  allCompletions.forEach(t => { breakdown[t] = (breakdown[t] ?? 0) + 1; });
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const visible = showAll ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5;
  const lifetimeScore = allCompletions.length;
  const nextMilestone = MILESTONES.find(m => m > lifetimeScore) ?? null;
  const toNext = nextMilestone !== null ? nextMilestone - lifetimeScore : null;

  return (
    <ExpandableRow color="#1a1c1c" title="Padla Pts" value={lifetimeScore > 0 ? lifetimeScore : "—"} sub={points > 0 ? `${points} completed today` : "lifetime points"} expanded={expanded} onToggle={onToggle}>
      <p style={{ margin: "0 0 14px", fontSize: 24, color: "#9aa0a6", lineHeight: 1.4 }}>Every positive action earns a point.</p>
      {nextMilestone !== null && (
        <div style={{ margin: "0 0 14px", padding: "10px 16px", borderRadius: 999, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a7a3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H3.5a2.5 2.5 0 0 0 0 5H6"/><path d="M18 9h2.5a2.5 2.5 0 0 1 0 5H18"/><path d="M6 3h12v10a6 6 0 0 1-12 0V3z"/><path d="M9 21h6"/><path d="M12 17v4"/></svg>
          <span style={{ fontSize: 26, fontWeight: 600, color: "#1a7a3f" }}>{toNext} points until your next milestone</span>
        </div>
      )}
      <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 10px" }}>Activity breakdown</p>
      {entries.length === 0 ? (
        <p style={{ fontSize: 28, color: "#9aa0a6", margin: 0 }}>No activities yet. Start completing tasks on the home screen.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(([title, count]) => (
            <div key={title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 28, fontWeight: 500, color: "#1a1c1c" }}>{title}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#6b7480", background: "#f0f1f4", borderRadius: 999, padding: "2px 10px" }}>×{count}</span>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={e => { e.stopPropagation(); setShowAll(p => !p); }}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "#8a9096", fontSize: 26, fontWeight: 600 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: showAll ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
              {showAll ? "Show less" : `Show all ${entries.length}`}
            </button>
          )}
        </div>
      )}
    </ExpandableRow>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  points: number;
  streak: number;
  winRate: number | null;
  readiness: number;
}

export default function StatsSheet({ open, onClose, points, streak, winRate, readiness }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  if (!open) return null;

  const toggle = (key: string) => setExpandedKey(k => k === key ? null : key);
  const insightsCount = getInsightsPool(streak).length;
  const patternsCount = getPatternsTagCount();
  const matchesColor = winRate === null ? "#9aa0a6" : winRate >= 60 ? "#16a34a" : winRate >= 40 ? "#d97706" : "#dc2626";

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "55dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ background: "#1a1c1c0d", flexShrink: 0 }} onClick={() => setExpandedKey(null)}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#1a1c1c30", margin: "12px auto 10px" }} />
          <div style={{ padding: "0 18px 16px" }}>
            <p style={{ margin: 0, fontSize: 52, fontWeight: 800, letterSpacing: "-0.01em", color: "#1a1c1c" }}>Stats</p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 8 }} onClick={() => setExpandedKey(null)}>
          <PadlaPtsRow points={points} expanded={expandedKey === "padla"} onToggle={() => toggle("padla")} />
          <ExpandableRow color="#7c3aed" title="Overall Form" value={`${readiness}%`} sub="readiness" expanded={expandedKey === "form"} onToggle={() => toggle("form")}>
            <FormScoreContent />
          </ExpandableRow>
          <ExpandableRow color="#d97706" title="Streak" value={streak > 0 ? streak : "—"} sub={streak > 0 ? "days in a row" : "start today"} expanded={expandedKey === "streak"} onToggle={() => toggle("streak")}>
            <StreakContent streak={streak} />
          </ExpandableRow>
          <ExpandableRow color={matchesColor} title="Matches" value={winRate !== null ? `${winRate}%` : "—"} sub={winRate !== null ? "win rate" : "no matches logged"} expanded={expandedKey === "matches"} onToggle={() => toggle("matches")}>
            <MatchesContent />
          </ExpandableRow>
          <ExpandableRow color="#2563eb" title="Insights" value={insightsCount > 0 ? insightsCount : "—"} sub="available" expanded={expandedKey === "insights"} onToggle={() => toggle("insights")}>
            <InsightsContent streak={streak} />
          </ExpandableRow>
          <ExpandableRow color="#0d9488" title="Patterns" value={patternsCount > 0 ? patternsCount : "—"} sub="tags logged" expanded={expandedKey === "patterns"} onToggle={() => toggle("patterns")}>
            <PatternsContent />
          </ExpandableRow>
        </div>
      </div>
    </div>
  );
}
