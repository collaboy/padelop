"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";

const S = { fontFamily: "Inter, sans-serif" };
const card: React.CSSProperties = { boxShadow: "0px 4px 20px rgba(0,0,0,0.04)" };

type StoredMatch = {
  date: string; time: string; club: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};

type ReviewEntry = {
  ts: string; feeling: string; result: string; opponent: string;
  energy: string; wellDone: string[]; improved: string[];
};

type TrainingEntry = {
  ts: string; sessionType: string[]; drillFocus: string[];
  duration: string; intensity: string;
};

type ActivityItem =
  | { kind: "match"; ts: string; data: ReviewEntry }
  | { kind: "training"; ts: string; data: TrainingEntry };

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const TEAM_A = ["#2653d4", "#0891b2"];
const TEAM_B = ["#ea580c", "#dc2626"];

function PairAvatars({ names, colors, size }: { names: [string, string]; colors: [string, string]; size: "lg" | "sm" }) {
  const px = size === "lg" ? 44 : 30;
  const overlap = size === "lg" ? 14 : 10;
  const fontSize = size === "lg" ? 13 : 10;
  const border = size === "lg" ? 3 : 2;
  const total = px + px - overlap;
  return (
    <div style={{ position: "relative", width: total, height: px, flexShrink: 0 }}>
      {names.map((name, i) => (
        <div key={i} style={{
          position: "absolute", left: i * (px - overlap),
          width: px, height: px, borderRadius: "50%",
          background: colors[i], border: `${border}px solid #fff`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize, fontWeight: 800, color: "#fff", zIndex: i === 0 ? 1 : 0,
        }}>
          {initials(name)}
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function formatTs(ts: string) {
  return formatDate(ts.slice(0, 10));
}

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Tag cloud ─────────────────────────────────────────────────────────────

type TagEntry = { text: string; count: number; type: "good" | "bad" };

function buildTagCloud(reviews: ReviewEntry[]): TagEntry[] {
  const good: Record<string, number> = {};
  const bad: Record<string, number> = {};
  for (const r of reviews) {
    for (const t of r.wellDone) good[t] = (good[t] ?? 0) + 1;
    for (const t of r.improved) bad[t] = (bad[t] ?? 0) + 1;
  }
  return [
    ...Object.entries(good).map(([text, count]) => ({ text, count, type: "good" as const })),
    ...Object.entries(bad).map(([text, count]) => ({ text, count, type: "bad" as const })),
  ].sort((a, b) => b.count - a.count);
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function TagCloud({ reviews }: { reviews: ReviewEntry[] }) {
  const tags = buildTagCloud(reviews);
  if (tags.length === 0) return null;
  const maxCount = tags[0].count;
  return (
    <div className="bg-white rounded-[20px] border border-[#e2e2e2] px-5 py-5" style={card}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 14px" }}>Trending in your matches</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 12px", alignItems: "center" }}>
        {tags.map(({ text, count, type }) => {
          const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 1;
          const fontSize = Math.round(12 + ratio * 16);
          const color = type === "good" ? "#00a844" : "#ea580c";
          const bg = type === "good" ? "#e6fff1" : "#fef0e8";
          const rot = ((hashStr(text) % 11) - 5) * 0.8;
          return (
            <span key={text + type} style={{
              fontSize, fontWeight: ratio > 0.5 ? 700 : 500, color, background: bg,
              borderRadius: 999, padding: "3px 10px", display: "inline-block",
              transform: `rotate(${rot}deg)`, lineHeight: 1.4, whiteSpace: "nowrap",
            }}>
              {text}
              {count > 1 && <sup style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>{count}</sup>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Next Match card ───────────────────────────────────────────────────────

function NextMatchCard({ match }: { match: StoredMatch }) {
  const p1 = match.player_1 || "You";
  const p2 = match.player_2 || "Partner";
  const p3 = match.player_3 || "Opponent";
  const p4 = match.player_4 || "";
  const firstName = (n: string) => n.split(" ")[0];
  return (
    <div className="bg-white rounded-[24px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-5 pb-4 flex justify-between items-start gap-3">
        <div>
          <p className="text-[15px] font-bold text-[#496640] leading-snug uppercase tracking-wide">Friendly Match</p>
          <p className="text-[15px] text-[#1a1c1c] mt-1">{formatDate(match.date)}{match.time ? ` • ${formatTime(match.time)}` : ""}</p>
        </div>
        <span className="flex-shrink-0 text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-full uppercase" style={{ background: "#caecbc", color: "#496640" }}>Upcoming</span>
      </div>
      <div className="border-t border-[#ebebeb]" />
      <div className="flex items-center justify-around px-5 py-5">
        <div className="flex flex-col items-center gap-2">
          <PairAvatars names={[p1, p2]} colors={[TEAM_A[0], TEAM_A[1]]} size="lg" />
          <p className="text-[13px] text-[#1a1c1c] font-medium">{firstName(p1)} & {firstName(p2)}</p>
        </div>
        <span className="text-[13px] font-semibold text-[#9aab96] uppercase tracking-widest">vs</span>
        <div className="flex flex-col items-center gap-2">
          <PairAvatars names={[p3, p4 || "?"]} colors={[TEAM_B[0], TEAM_B[1]]} size="lg" />
          <p className="text-[13px] text-[#1a1c1c] font-medium">{firstName(p3)}{p4 ? ` & ${firstName(p4)}` : ""}</p>
        </div>
      </div>
      {match.club && (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="flex items-center px-5 py-4 gap-2 text-[14px] text-[#747878]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
            {match.club}
          </div>
        </>
      )}
    </div>
  );
}

// ── Activity cards ────────────────────────────────────────────────────────

function MatchCard({ review }: { review: ReviewEntry }) {
  const resultColor = review.result === "win" ? "#496640" : review.result === "loss" ? "#dc2626" : "#747878";
  const resultBg = review.result === "win" ? "#eef6eb" : review.result === "loss" ? "#fef2f2" : "#f4f4f6";
  const resultLabel = review.result === "win" ? "Win" : review.result === "loss" ? "Loss" : "Played";
  const hasTags = review.wellDone.length > 0 || review.improved.length > 0;
  return (
    <div className="bg-white rounded-[20px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-[#1a1c1c]">Match</p>
          <p className="text-[11px] text-[#9aab96] mt-0.5">{formatTs(review.ts)}</p>
        </div>
        <div className="flex items-center gap-2">
          {review.opponent && (
            <span className="text-[11px] font-semibold text-[#747878]">vs {review.opponent}</span>
          )}
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: resultBg, color: resultColor }}>
            {resultLabel}
          </span>
        </div>
      </div>
      {hasTags && (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="px-5 py-3 flex flex-col gap-2">
            {review.wellDone.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.wellDone.map(t => (
                  <span key={t} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#eef6eb", color: "#496640" }}>{t}</span>
                ))}
              </div>
            )}
            {review.improved.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.improved.map(t => (
                  <span key={t} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f9f9f9] text-[#747878] border border-[#ebebeb]">{t}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const INTENSITY_COLOR: Record<string, string> = { light: "#16a34a", moderate: "#2653d4", hard: "#dc2626" };

function TrainingCard({ entry }: { entry: TrainingEntry }) {
  const intensityColor = INTENSITY_COLOR[entry.intensity] ?? "#747878";
  return (
    <div className="bg-white rounded-[20px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-[#16a34a]">Training</p>
          <p className="text-[11px] text-[#9aab96] mt-0.5">{formatTs(entry.ts)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {entry.duration && (
            <span className="text-[11px] font-semibold text-[#747878]">{entry.duration}</span>
          )}
          {entry.intensity && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${intensityColor}15`, color: intensityColor }}>
              {entry.intensity.charAt(0).toUpperCase() + entry.intensity.slice(1)}
            </span>
          )}
        </div>
      </div>
      {(entry.sessionType.length > 0 || entry.drillFocus.length > 0) && (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="px-5 py-3 flex flex-col gap-2">
            {entry.sessionType.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.sessionType.map(t => (
                  <span key={t} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#f0f4ff] text-[#2653d4]">{t}</span>
                ))}
              </div>
            )}
            {entry.drillFocus.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.drillFocus.map(t => (
                  <span key={t} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f9f9f9] text-[#747878] border border-[#ebebeb]">{t}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

const TABS = ["All", "Matches", "Training"] as const;
type Tab = (typeof TABS)[number];

export default function Activity() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [nextMatch, setNextMatch] = useState<StoredMatch | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingEntry[]>([
    { ts: new Date(Date.now() - 86400000).toISOString(), sessionType: ["Padel", "Drills"], drillFocus: ["Bandeja", "Volleys", "Positioning"], duration: "60min", intensity: "moderate" },
  ]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restDays, setRestDays] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try { return new Set<string>(JSON.parse(localStorage.getItem("padelop:rest-days") || "[]")); } catch { return new Set<string>(); }
  });

  function loadData() {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      const m = raw ? JSON.parse(raw) as StoredMatch : null;
      const isFuture = m?.date && m?.time && new Date(`${m.date}T${m.time}`).getTime() > Date.now();
      setNextMatch(isFuture ? m : null);
    } catch { setNextMatch(null); }

    try {
      const raw = localStorage.getItem("padelop:match-reviews");
      setReviews(raw ? (JSON.parse(raw) as ReviewEntry[]).sort((a, b) => b.ts.localeCompare(a.ts)) : []);
    } catch { setReviews([]); }

    try {
      const raw = localStorage.getItem("padelop:training-logs");
      if (raw) setTrainingSessions((JSON.parse(raw) as TrainingEntry[]).sort((a, b) => b.ts.localeCompare(a.ts)));
    } catch { setTrainingSessions([]); }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  // Build unified feed
  const feed: ActivityItem[] = [
    ...reviews.map(r => ({ kind: "match" as const, ts: r.ts, data: r })),
    ...trainingSessions.map(t => ({ kind: "training" as const, ts: t.ts, data: t })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

  const visibleFeed = tab === "Matches"
    ? feed.filter(i => i.kind === "match")
    : tab === "Training"
    ? feed.filter(i => i.kind === "training")
    : feed;

  const totalMatches = reviews.length;
  const totalSessions = trainingSessions.length;
  const wins = reviews.filter(r => r.result === "win").length;

  const subtitle = totalMatches === 0 && totalSessions === 0
    ? "Nothing logged yet"
    : [
        totalMatches > 0 && `${wins}W–${totalMatches - wins}L`,
        totalSessions > 0 && `${totalSessions} training session${totalSessions !== 1 ? "s" : ""}`,
      ].filter(Boolean).join(" · ");

  return (
    <main style={{ ...S, background: "#ffffff", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 176px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ ...S, fontSize: 22, fontWeight: 700, color: "#1a1c1c", margin: 0, letterSpacing: "-0.01em" }}>Activity</h2>
          <p style={{ ...S, fontSize: 14, color: "#747878", margin: "4px 0 0" }}>{subtitle}</p>
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-white border border-[#e2e2e2] flex items-center justify-center active:scale-90 transition-transform relative"
          style={card}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {tab !== "All" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#496640]" />}
        </button>
      </div>

      {/* Filter modal */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-[24px] w-full max-w-xs overflow-hidden" style={card} onClick={e => e.stopPropagation()}>
            <p className="text-[11px] font-semibold text-[#747878] uppercase tracking-widest px-6 pt-5 pb-3">Show</p>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => { setTab(t); setFilterOpen(false); }}
                className="w-full flex items-center justify-between px-6 py-4 active:bg-[#f9f9f9] transition-colors"
                style={{ borderTop: i > 0 ? "1px solid #ebebeb" : "none" }}>
                <span className="text-[15px] font-medium text-[#1a1c1c]">{t}</span>
                {tab === t && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Schedule: week grid + month calendar */}
      {tab === "All" && (() => {
        const now = new Date();
        const todayYMD = now.toISOString().slice(0, 10);
        const dow = (now.getDay() + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - dow);
        const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          return { ymd: d.toISOString().slice(0, 10), date: d };
        });
        const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        const matchYMD = nextMatch?.date ?? null;
        const matchNextYMD = matchYMD ? (() => { const d = new Date(matchYMD); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })() : null;
        const yr = now.getFullYear();
        const mo = now.getMonth();
        const daysInMonth = new Date(yr, mo + 1, 0).getDate();
        const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7;
        const matchDates = new Set<string>();
        try { reviews.forEach(r => { if (r.ts) matchDates.add(r.ts.slice(0, 10)); }); } catch {}
        if (nextMatch?.date) matchDates.add(nextMatch.date);
        const recoveryDates = new Set<string>();
        matchDates.forEach(d => {
          const next = new Date(d + "T12:00:00");
          next.setDate(next.getDate() + 1);
          recoveryDates.add(next.toISOString().slice(0, 10));
        });
        const monthCells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
        while (monthCells.length % 7 !== 0) monthCells.push(null);
        const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        // Group month cells into rows of 7
        const rows: (number | null)[][] = [];
        for (let r = 0; r < monthCells.length / 7; r++) rows.push(monthCells.slice(r * 7, r * 7 + 7));
        const todayDay = parseInt(todayYMD.slice(8));
        const todayCell = monthCells.findIndex(d => d === todayDay && todayYMD.startsWith(`${yr}-${String(mo + 1).padStart(2, "0")}`));
        const currentWeekRow = todayCell >= 0 ? Math.floor(todayCell / 7) : -1;

        return (
          <>
            <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Schedule</p>
            <div className="bg-white rounded-[24px] border border-[#e2e2e2] overflow-hidden" style={card}>
              <div style={{ padding: "16px 14px 20px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#747878", marginBottom: 10, textTransform: "capitalize" }}>{monthLabel}</p>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", marginBottom: 2 }}>
                  <div />
                  {["M","T","W","T","F","S","S"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9aab96", paddingBottom: 4 }}>{d}</div>
                  ))}
                </div>
                {/* Rows with triangle indicator */}
                {rows.map((rowCells, rowIdx) => (
                  <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", alignItems: "center" }}>
                    {/* Triangle for current week */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
                      {rowIdx === currentWeekRow && (
                        <svg width="6" height="9" viewBox="0 0 6 9"><polygon points="0,0 6,4.5 0,9" fill="#2653d4"/></svg>
                      )}
                    </div>
                    {rowCells.map((day, colIdx) => {
                      if (day === null) return <div key={colIdx} style={{ height: 34 }} />;
                      const ymd = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isToday = ymd === todayYMD;
                      const isMatch = matchDates.has(ymd);
                      const isRecovery = !isMatch && recoveryDates.has(ymd);
                      const isPast = ymd < todayYMD;
                      const dotColor = isMatch ? "#496640" : isRecovery ? "#7c3aed" : "#2653d4";
                      const hasDot = (isMatch || isRecovery) && !isPast;
                      return (
                        <div key={colIdx} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 2 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "#2653d4" : "transparent", opacity: isPast ? 0.35 : 1 }}>
                            <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? "#fff" : "#1a1c1c" }}>{day}</span>
                          </div>
                          <div style={{ height: 4, width: 4, borderRadius: "50%", background: hasDot ? dotColor : "transparent", marginTop: 1 }} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Next Match + Improvement cloud */}
      {nextMatch && (tab === "All" || tab === "Matches") && (
        <>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Next Match</p>
          <NextMatchCard match={nextMatch} />
          {reviews.length > 0 && <TagCloud reviews={reviews} />}
        </>
      )}

      {/* Activity archive */}
      {(tab === "All" || tab === "Matches" || tab === "Training") && (
        <>
          <button
            onClick={() => setArchiveOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
          >
            <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Activity Archive</p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: archiveOpen ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          {archiveOpen && (
            visibleFeed.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visibleFeed.map(item =>
                  item.kind === "match"
                    ? <MatchCard key={item.ts + "m"} review={item.data as ReviewEntry} />
                    : <TrainingCard key={item.ts + "t"} entry={item.data as TrainingEntry} />
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[20px] border border-[#e2e2e2] px-5 py-8 text-center" style={card}>
                <p className="text-[15px] font-medium text-[#747878]">
                  {tab === "Training" ? "No training sessions logged yet" : tab === "Matches" ? "No match reviews yet" : "No activity logged yet"}
                </p>
                <p className="text-[13px] text-[#9aab96] mt-1">Tap + to log your first session</p>
              </div>
            )
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: "#496640", boxShadow: "0 4px 16px #49664055" }}
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
