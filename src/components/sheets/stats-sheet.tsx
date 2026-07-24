"use client";

import React, { useEffect, useState } from "react";
import FormScoreContent from "./form-score-sheet";
import StreakContent from "./streak-sheet";
import MatchesContent from "./matches-sheet";
import InsightsContent, { getInsightsPool } from "./insights-sheet";
import PatternsContent, { getPatternsTagCount } from "./patterns-sheet";

const MILESTONES = [10, 25, 50, 75, 100, 250, 500, 1000];

function ExpandableRow({ color, icon, title, value, sub, expanded, dim, onToggle, children }: { color: string; icon?: React.ReactNode; title: string; value: React.ReactNode; sub: string; expanded: boolean; dim?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, background: "#fff", boxShadow: "0 0 0 1px #f0f0f0", overflow: "hidden", flexShrink: 0, opacity: dim ? 0.4 : 1, transition: "opacity 0.25s" }} onClick={e => e.stopPropagation()}>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" }}
      >
        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1e` }}>
          {icon ?? <div style={{ width: 13, height: 13, borderRadius: "50%", background: color }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color }}>{title}</p>
          <p style={{ fontSize: "clamp(24px, 6.16vw, 28px)", fontWeight: 700, margin: 0, lineHeight: 1.25, color: "#1a1c1c" }}>{value}</p>
          <p style={{ fontSize: "clamp(17px, 4.34vw, 20px)", margin: "2px 0 0", color: "#6b7480" }}>{sub}</p>
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

function SectionHeader({ title, first }: { title: string; first?: boolean }) {
  return (
    <p style={{ margin: first ? "0 4px 0" : "12px 4px 0", fontSize: 15, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9aa0a6" }}>{title}</p>
  );
}

function PadlaPtsRow({ points, expanded, dim, onToggle }: { points: number; expanded: boolean; dim?: boolean; onToggle: () => void }) {
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
    <ExpandableRow
      color="#1a7a3f"
      icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="#1a7a3f" stroke="none"><path d="M12 2l2.9 6.26L21.5 9.27l-4.75 4.63L17.8 21 12 17.77 6.2 21l1.05-7.1L2.5 9.27l6.6-1.01L12 2z"/></svg>}
      title="Padla Points"
      value={lifetimeScore > 0 ? lifetimeScore : "—"}
      sub={points > 0 ? `${points} completed today` : "lifetime points"}
      expanded={expanded}
      dim={dim}
      onToggle={onToggle}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 0 14px" }}>
        <div style={{ flexShrink: 0, width: 60, height: 60, borderRadius: "50%", background: "#1a7a3f", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1 }}>{lifetimeScore}</span>
        </div>
        <p style={{ margin: 0, fontSize: 17, color: "#9aa0a6", lineHeight: 1.4 }}>Every positive action earns a point.</p>
      </div>
      {nextMilestone !== null && (
        <div style={{ margin: "0 0 14px", padding: "10px 16px", borderRadius: 999, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a7a3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H3.5a2.5 2.5 0 0 0 0 5H6"/><path d="M18 9h2.5a2.5 2.5 0 0 1 0 5H18"/><path d="M6 3h12v10a6 6 0 0 1-12 0V3z"/><path d="M9 21h6"/><path d="M12 17v4"/></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1a7a3f" }}>{toNext} points until your next milestone</span>
        </div>
      )}
      <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 10px" }}>Activity breakdown</p>
      {entries.length === 0 ? (
        <p style={{ fontSize: 20, color: "#9aa0a6", margin: 0 }}>No activities yet. Start completing tasks on the home screen.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(([title, count]) => (
            <div key={title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: "#1a1c1c" }}>{title}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#6b7480", background: "#f0f1f4", borderRadius: 999, padding: "2px 10px" }}>×{count}</span>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={e => { e.stopPropagation(); setShowAll(p => !p); }}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "#8a9096", fontSize: 18, fontWeight: 600 }}
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
  useEffect(() => {
    if (!open) setExpandedKey(null);
  }, [open]);
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
            <p style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: "-0.01em", color: "#1a1c1c" }}>Stats</p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 8 }} onClick={() => setExpandedKey(null)}>
          <SectionHeader title="Performance" first />
          <ExpandableRow
            color="#7c3aed"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            title="Overall Form"
            value={`${readiness}%`}
            sub="readiness"
            expanded={expandedKey === "form"}
            dim={expandedKey !== null && expandedKey !== "form"}
            onToggle={() => toggle("form")}
          >
            <FormScoreContent />
          </ExpandableRow>
          <ExpandableRow
            color={matchesColor}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={matchesColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H3.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h2.5a2.5 2.5 0 0 0 0-5H18"/><path d="M6 3h12v10a6 6 0 0 1-12 0V3z"/><path d="M9 21h6"/><path d="M12 17v4"/></svg>}
            title="Matches"
            value={winRate !== null ? `${winRate}%` : "—"}
            sub={winRate !== null ? "win rate" : "no matches logged"}
            expanded={expandedKey === "matches"}
            dim={expandedKey !== null && expandedKey !== "matches"}
            onToggle={() => toggle("matches")}
          >
            <MatchesContent />
          </ExpandableRow>
          <ExpandableRow
            color="#0d9488"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>}
            title="Patterns"
            value={patternsCount > 0 ? patternsCount : "—"}
            sub="tags logged"
            expanded={expandedKey === "patterns"}
            dim={expandedKey !== null && expandedKey !== "patterns"}
            onToggle={() => toggle("patterns")}
          >
            <PatternsContent />
          </ExpandableRow>

          <SectionHeader title="Consistency" />
          <PadlaPtsRow points={points} expanded={expandedKey === "padla"} dim={expandedKey !== null && expandedKey !== "padla"} onToggle={() => toggle("padla")} />
          <ExpandableRow
            color="#d97706"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="#d97706" stroke="none"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>}
            title="Streak"
            value={streak > 0 ? streak : "—"}
            sub={streak > 0 ? "days in a row" : "start today"}
            expanded={expandedKey === "streak"}
            dim={expandedKey !== null && expandedKey !== "streak"}
            onToggle={() => toggle("streak")}
          >
            <StreakContent streak={streak} />
          </ExpandableRow>

          <SectionHeader title="Learning" />
          <ExpandableRow
            color="#2563eb"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z"/></svg>}
            title="Insights"
            value={insightsCount > 0 ? insightsCount : "—"}
            sub="available"
            expanded={expandedKey === "insights"}
            dim={expandedKey !== null && expandedKey !== "insights"}
            onToggle={() => toggle("insights")}
          >
            <InsightsContent streak={streak} />
          </ExpandableRow>
        </div>
      </div>
    </div>
  );
}
