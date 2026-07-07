"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveGearToDb, uploadGearImageToStorage, deleteGearImageFromStorage, saveNutritionInsightToDb, saveUpcomingMatch, saveScheduleDoneToDb, saveScoreSnapshotToDb, saveNutritionToDb, saveNoteToDb, saveMatchReview } from "@/lib/db";
import LogSheet from "@/components/log-sheet";
import { hydrateFromSupabase } from "@/lib/sync";
import { startPlusOne, startPlusOneFast, openPadlaPanel } from "@/lib/nav-events";
import { analyzeMeals, compareMealsToSchedule, foodGrade, loadFoodHistory, type MealEntry } from "@/lib/food-scoring";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates, computeMatchReadiness, loadMorningLog, improveTips, buildInsightParagraph,
  computeFormScore,
  type MatchReadinessResult,
  type Scores, type ScoreSnapshot, type ReviewEntry, type PillarStates, type PillarStatus,
  type HydrationEntry, type NutritionEntry, type HabitsEntry, type FormScore,
} from "@/lib/scoring";
import { getScheduleData, getDayType, SCHEDULE_DETAILS, DRILL_LIBRARY, DEFAULT_DRILL, getTopNeedsWorkTag, type DayType } from "@/lib/schedule-data";

// ── Profile ───────────────────────────────────────────────────────────────

const PROFILE_KEY = "padelop:profile";

type Profile = { name: string; level: string; position: string; hand: string; avatar: string; playingSince: string };
const EMPTY: Profile = { name: "", level: "", position: "", hand: "", avatar: "", playingSince: "" };
const LEVELS    = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const POSITIONS = ["Left wall","Right wall","Both"];
const HANDS     = ["Right","Left"];

// ── Matches types ─────────────────────────────────────────────────────────

type StoredMatch = {
  date: string; time: string; club: string; court?: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};

type TrainingEntry = {
  ts: string; sessionType: string[]; drillFocus: string[];
  duration: string; intensity: string;
};


// ── Insights config ───────────────────────────────────────────────────────

const PILLARS: { key: keyof Omit<Scores, "overall">; label: string; color: string }[] = [
  { key: "recovery",  label: "Recovery",  color: "var(--c-purple)" },
  { key: "nutrition", label: "Nutrition", color: "var(--c-teal)" },
  { key: "training",  label: "Training",  color: "var(--c-green)" },
  { key: "wellbeing", label: "Wellbeing", color: "var(--c-amber)" },
];

const STATUS_META: Record<PillarStatus, { label: string; bg: string; text: string }> = {
  good:       { label: "Good",       bg: "var(--c-green-bg)", text: "var(--c-green)" },
  ok:         { label: "OK",         bg: "#fffbeb", text: "#d97706" },
  low:        { label: "Low",        bg: "var(--c-red-bg)", text: "var(--c-red)" },
  not_logged: { label: "Not logged", bg: "var(--c-bg)", text: "var(--c-hint)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const W = 56, H = 24;
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(max - min, 3);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * (H - 4) - 2;
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.5" fill={color}/>
    </svg>
  );
}

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const TEAM_A = ["var(--c-blue)", "var(--c-teal)"];
const TEAM_B = ["var(--c-orange)", "var(--c-red)"];

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

function formatTs(ts: string) { return formatDate(ts.slice(0, 10)); }

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

type TagEntry = { text: string; count: number; type: "good" | "bad" };

function buildTagCloud(reviews: ReviewEntry[]): TagEntry[] {
  const good: Record<string, number> = {};
  const bad:  Record<string, number> = {};
  for (const r of reviews) {
    for (const t of r.wellDone) good[t] = (good[t] ?? 0) + 1;
    for (const t of r.improved) bad[t]  = (bad[t]  ?? 0) + 1;
  }
  return [
    ...Object.entries(good).map(([text, count]) => ({ text, count, type: "good" as const })),
    ...Object.entries(bad) .map(([text, count]) => ({ text, count, type: "bad"  as const })),
  ].sort((a, b) => b.count - a.count);
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const card: React.CSSProperties = { boxShadow: "var(--shadow-card)" };

function TagCloud({ reviews }: { reviews: ReviewEntry[] }) {
  const tags = buildTagCloud(reviews);
  if (tags.length === 0) return null;
  const maxCount = tags[0].count;
  return (
    <div className="bg-white r-md border border-c-line px-5 py-5" style={card}>
      <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 14px" }}>Trending in your matches</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 12px", alignItems: "center" }}>
        {tags.map(({ text, count, type }) => {
          const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 1;
          const fontSize = Math.round(12 + ratio * 16);
          const color = type === "good" ? "#00a844" : "var(--c-orange)";
          const bg    = type === "good" ? "#e6fff1" : "#fef0e8";
          const rot   = ((hashStr(text) % 11) - 5) * 0.8;
          return (
            <span key={text + type} style={{
              fontSize, fontWeight: ratio > 0.5 ? 700 : 500, color, background: bg,
              borderRadius: "var(--r-pill)", padding: "3px 10px", display: "inline-block",
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

function NextMatchCard({ match }: { match: StoredMatch }) {
  const p1 = match.player_1 || "You";
  const p2 = match.player_2 || "Partner";
  const p3 = match.player_3 || "Opponent";
  const p4 = match.player_4 || "";
  const firstName = (n: string) => n.split(" ")[0];
  return (
    <div className="bg-white r-lg border border-c-line overflow-hidden" style={card}>
      <div className="px-5 pt-5 pb-4 flex justify-between items-start gap-3">
        <div>
          <p className="t-ui text-c-forest leading-snug uppercase tracking-wide">Friendly Match</p>
          <p className="t-ui font-normal text-c-text mt-1">{formatDate(match.date)}{match.time ? ` • ${formatTime(match.time)}` : ""}</p>
        </div>
        <span className="flex-shrink-0 t-tag px-3 py-1.5 rounded-full uppercase" style={{ background: "var(--c-blue-light)", color: "var(--c-blue)" }}>Upcoming</span>
      </div>
      <div className="border-t border-[#ebebeb]" />
      <div className="flex items-center justify-around px-5 py-5">
        <div className="flex flex-col items-center gap-2">
          <PairAvatars names={[p1, p2]} colors={[TEAM_A[0], TEAM_A[1]]} size="lg" />
          <p className="t-body-sm font-medium text-c-text">{firstName(p1)} & {firstName(p2)}</p>
        </div>
        <span className="t-body-sm font-semibold text-[#9aab96] uppercase tracking-widest">vs</span>
        <div className="flex flex-col items-center gap-2">
          <PairAvatars names={[p3, p4 || "?"]} colors={[TEAM_B[0], TEAM_B[1]]} size="lg" />
          <p className="t-body-sm font-medium text-c-text">{firstName(p3)}{p4 ? ` & ${firstName(p4)}` : ""}</p>
        </div>
      </div>
      {match.club && (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="flex items-center px-5 py-4 gap-2 t-body-sm text-c-text-sub">
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

function MatchCard({ review }: { review: ReviewEntry }) {
  const resultColor    = review.result === "win" ? "var(--c-forest)" : review.result === "loss" ? "var(--c-red)" : "var(--c-text-sub)";
  const resultBg       = review.result === "win" ? "#eef6eb" : review.result === "loss" ? "var(--c-red-bg)" : "var(--c-bg)";
  const resultLabel    = review.result === "win" ? "Win"     : review.result === "loss" ? "Loss"    : "Played";
  const opponentNames  = typeof review.opponentNames === "string" && review.opponentNames ? review.opponentNames : null;
  const hasTags = review.wellDone.length > 0 || review.improved.length > 0;
  return (
    <div className="bg-white r-md border border-c-line overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
        <div>
          <p className="t-body-sm font-bold text-c-text">{opponentNames ? `vs ${opponentNames}` : "Match"}</p>
          <p className="t-tag text-[#9aab96] mt-0.5">{formatTs(review.ts)}</p>
        </div>
        <span className="t-tag px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: resultBg, color: resultColor }}>{resultLabel}</span>
      </div>
      {hasTags && (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="px-5 py-3 flex flex-col gap-2">
            {review.wellDone.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.wellDone.map(t => <span key={t} className="t-tag px-2.5 py-0.5 rounded-full" style={{ background: "var(--c-blue-light)", color: "var(--c-blue)" }}>{t}</span>)}
              </div>
            )}
            {review.improved.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.improved.map(t => <span key={t} className="t-tag font-medium px-2.5 py-0.5 rounded-full bg-c-bg-input text-c-text-sub border border-[#ebebeb]">{t}</span>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const INTENSITY_COLOR: Record<string, string> = { light: "var(--c-green)", moderate: "var(--c-blue)", hard: "var(--c-red)" };

function TrainingCard({ entry }: { entry: TrainingEntry }) {
  const intensityColor = INTENSITY_COLOR[entry.intensity] ?? "var(--c-text-sub)";
  return (
    <div className="bg-white r-md border border-c-line overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
        <div>
          <p className="t-body-sm font-bold text-c-green">Training</p>
          <p className="t-tag text-[#9aab96] mt-0.5">{formatTs(entry.ts)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {entry.duration && <span className="t-tag font-semibold text-c-text-sub">{entry.duration}</span>}
          {entry.intensity && (
            <span className="t-tag px-2 py-0.5 rounded-full" style={{ background: `${intensityColor}15`, color: intensityColor }}>
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
                {entry.sessionType.map(t => <span key={t} className="t-tag px-2.5 py-0.5 rounded-full bg-[#f0f4ff] text-c-blue">{t}</span>)}
              </div>
            )}
            {entry.drillFocus.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.drillFocus.map(t => <span key={t} className="t-tag font-medium px-2.5 py-0.5 rounded-full bg-c-bg-input text-c-text-sub border border-[#ebebeb]">{t}</span>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


function topTag(tags: string[]): string | null {
  if (!tags.length) return null;
  const counts = tags.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ── Matches helpers ───────────────────────────────────────────────────────

type MatchForm = { date: string; time: string; club: string; court: string; p1: string; p2: string; p3: string; p4: string };
const EMPTY_FORM: MatchForm = { date: "", time: "", club: "", court: "", p1: "", p2: "", p3: "", p4: "" };

function fmtCountdown(date: string, time: string) {
  const now = new Date();
  const diff = new Date(date + "T" + (time || "00:00")).getTime() - now.getTime();
  if (diff < 0) return "Past";
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function mfInputStyle(filled: boolean): React.CSSProperties {
  return { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${filled ? "#2653d4" : "#e2e2e2"}`, background: filled ? "#f4f6ff" : "#fff", fontSize: 16, color: "#1a1c1c", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
}

function MatchFormWidget({ form, onChange, onSave, onDelete, saveLabel, saveColor }: {
  form: MatchForm; onChange: (f: MatchForm) => void; onSave: () => void;
  onDelete?: () => void; saveLabel: string; saveColor: string;
}) {
  const valid = !!(form.date && form.time);
  const set = (k: keyof MatchForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [k]: e.target.value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>DATE</p>
          <input type="date" value={form.date} onChange={set("date")} style={mfInputStyle(!!form.date)} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>TIME</p>
          <input type="time" value={form.time} onChange={set("time")} style={mfInputStyle(!!form.time)} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>CLUB</p>
        <input type="text" placeholder="e.g. Club Padel BCN" value={form.club} onChange={set("club")} style={mfInputStyle(!!form.club)} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>COURT</p>
        <input type="text" placeholder="e.g. 3" value={form.court} onChange={set("court")} style={mfInputStyle(!!form.court)} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>PLAYERS</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["p1","p2","p3","p4"] as const).map((k, i) => (
            <input key={k} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={form[k]} onChange={set(k)} style={mfInputStyle(!!form[k])} />
          ))}
        </div>
      </div>
      <button onClick={onSave} disabled={!valid} style={{ marginTop: 4, padding: "13px", borderRadius: 16, border: "none", cursor: valid ? "pointer" : "default", fontSize: 15, fontWeight: 700, color: "#fff", background: valid ? saveColor : "#c4c7c7" }}>{saveLabel}</button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: "10px", borderRadius: 16, border: "1.5px solid #fee2e2", background: "#fff5f5", fontSize: 14, fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>Delete match</button>
      )}
    </div>
  );
}

// ── PrevDaysList ──────────────────────────────────────────────────────────

function PrevDaysList({ days, schedDone, deduped, getScheduleData, loadScoringData, getTopNeedsWorkTag, pctColor }: {
  days: string[];
  schedDone: Record<string, string[]>;
  deduped: import("@/lib/scoring").ScoreSnapshot[];
  getScheduleData: typeof import("@/lib/schedule-data").getScheduleData;
  loadScoringData: typeof import("@/lib/scoring").loadScoringData;
  getTopNeedsWorkTag: typeof import("@/lib/schedule-data").getTopNeedsWorkTag;
  pctColor: (p: number | null) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = days.map(dateStr => {
    const snap = deduped.find(s => s.date === dateStr);
    const doneTitles = schedDone[dateStr] ?? [];
    let schedTotal = 0;
    let schedDoneCount = 0;
    try {
      const d = loadScoringData();
      const tag = getTopNeedsWorkTag();
      const items = getScheduleData("training", null, tag).schedule;
      schedTotal = items.length;
      schedDoneCount = items.filter(s => doneTitles.includes(s.title)).length;
    } catch {}
    const schedPct = schedTotal ? Math.round((schedDoneCount / schedTotal) * 100) : null;
    let meals: MealEntry[] = [];
    try { meals = (JSON.parse(localStorage.getItem("padelop:meal-log") || "[]") as MealEntry[]).filter(m => m.date === dateStr); } catch {}
    const hasData = doneTitles.length > 0 || snap || meals.length > 0;
    if (!hasData) return null;
    const label = new Date(dateStr + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const isOpen = expanded === dateStr;
    return (
      <div key={dateStr}>
        <button onClick={() => setExpanded(isOpen ? null : dateStr)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: "10px 0", textAlign: "left" }}>
          <div style={{ flex: 1 }}>
            <span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>{label}</span>
          </div>
          {schedPct !== null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(schedPct), background: `${pctColor(schedPct)}18`, padding: "2px 8px", borderRadius: 99 }}>{schedPct}%</span>
          )}
          {snap && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-hint)" }}>Score {snap.overall}</span>}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-hint)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
        </button>
        {isOpen && (
          <div style={{ paddingBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {schedTotal > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="t-caption" style={{ color: "var(--c-text-sub)" }}>Schedule</span>
                  <span className="t-caption" style={{ fontWeight: 700, color: pctColor(schedPct) }}>{schedDoneCount}/{schedTotal} tasks</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${schedPct ?? 0}%`, borderRadius: 99, background: pctColor(schedPct) }} />
                </div>
              </div>
            )}
            {meals.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {meals.map(m => (
                  <div key={m.id} style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                    <span className="t-caption" style={{ color: "var(--c-text-sub)", lineHeight: 1.4 }}>{m.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ height: 1, background: "#f4f4f6" }} />
      </div>
    );
  }).filter(Boolean);

  if (!rows.length) return null;
  return <div>{rows}</div>;
}

function panelGetMatchList(): StoredMatch[] {
  try {
    const raw = localStorage.getItem("padelop:upcoming-matches");
    if (raw) return JSON.parse(raw);
    const single = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
    if (single?.date) return [single];
  } catch {}
  return [];
}

function panelSaveMatchListLocal(list: StoredMatch[]) {
  const today = new Date().toISOString().slice(0, 10);
  const future = list.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  try {
    localStorage.setItem("padelop:upcoming-matches", JSON.stringify(future));
    if (future.length > 0) localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
    else localStorage.removeItem("padelop:next-match");
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  // Profile
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [navLoading, setNavLoading] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const isAdmin = userEmail.toLowerCase() === "evanderbijl@hotmail.com";

  // Matches
  const [logSheetOpen, setLogSheetOpen]       = useState(false);
  const [logTab, setLogTab]                   = useState<"checkin" | null>(null);
  const [checkinDone, setCheckinDone]         = useState<boolean | null>(null);
  const [nextMatch, setNextMatch]             = useState<StoredMatch | null>(null);
  const [reviews, setReviews]                 = useState<ReviewEntry[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingEntry[]>([]);
  const [partnerCount, setPartnerCount]       = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [journeyStart, setJourneyStart]       = useState<string | null>(null);

  // Insights
  const [matchReadiness, setMatchReadiness] = useState<MatchReadinessResult | null>(null);
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 });
  const [pillarStates, setPillarStates] = useState<PillarStates>({
    recovery:  { status: "not_logged", reason: "Morning check-in not done" },
    nutrition: { status: "not_logged", reason: "Night check-in not done yet" },
    training:  { status: "not_logged", reason: "No session logged today" },
    wellbeing: { status: "not_logged", reason: "Check-in not done yet" },
  });
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);
  const [streak, setStreak] = useState(0);
  const [foodHistory, setFoodHistory] = useState<Array<{ date: string; score: number }>>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [selectedFoodDate, setSelectedFoodDate] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<{ score: number; insight: string } | null>(null);

  // Matches tab state
  const [upcomingMatches, setUpcomingMatches] = useState<StoredMatch[]>([]);
  const [matchExpandedIdx, setMatchExpandedIdx] = useState<number | null>(null);
  const [matchAddOpen, setMatchAddOpen] = useState(false);
  const [matchEditForms, setMatchEditForms] = useState<Record<number, MatchForm>>({});
  const [matchAddForm, setMatchAddForm] = useState<MatchForm>(EMPTY_FORM);
  const [selectedReview, setSelectedReview] = useState<ReviewEntry | null>(null);

  // Schedule state
  const [schedNow, setSchedNow] = useState(new Date());
  const [gameDays, setGameDays] = useState<string[]>([]);
  const dayType = useMemo(() => getDayType(gameDays, nextMatch, upcomingMatches), [gameDays, nextMatch, upcomingMatches]);

  // Cache dayType per calendar day — read synchronously before first paint to avoid flash
  const readDayTypeCache = (): string | null => {
    try {
      const raw = localStorage.getItem("padelop:day-type-cache");
      if (!raw) return null;
      const { date, dayType: dt } = JSON.parse(raw);
      return date === new Date().toISOString().slice(0, 10) ? dt : null;
    } catch { return null; }
  };
  const [cachedDayType, setCachedDayType] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return readDayTypeCache();
  });
  useLayoutEffect(() => {
    if (cachedDayType === null) setCachedDayType(readDayTypeCache());
  }, []);
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#ffffff";
    return () => { document.body.style.background = prev; };
  }, []);
  const effectiveDayType = dayType === "baseline" ? (cachedDayType ?? dayType) : dayType;
  useEffect(() => {
    const known = ["match", "pre-match", "recovery", "maintenance", "training"];
    if (known.includes(dayType)) {
      localStorage.setItem("padelop:day-type-cache", JSON.stringify({ date: new Date().toISOString().slice(0, 10), dayType }));
    }
  }, [dayType]);
  const [schedule, setSchedule] = useState<ReturnType<typeof getScheduleData>["schedule"]>([]);
  const [schedCurrentIdx, setSchedCurrentIdx] = useState(0);
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [schedMatchTime, setSchedMatchTime] = useState<string | null>(null);
  const [schedModalIdx, setSchedModalIdx] = useState<number | null>(null);
  const [schedModalClosing, setSchedModalClosing] = useState(false);
  const [profileDetailOpen, setProfileDetailOpen] = useState(false);
  const [insightSheetOpen, setInsightSheetOpen] = useState(false);

  // Panel state (inline action panel below profile card)
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const nextMatchPanelOpen  = openPanel === 'nextMatch';
  const dayTypeInfoOpen     = openPanel === 'dayType';
  const panelSchedOpen      = openPanel === 'sched';
  const streakPanelOpen     = openPanel === 'streak';
  const formScorePanelOpen  = openPanel === 'formScore';
  const hydrationPanelOpen  = openPanel === 'hydration';
  const insightsPanelOpen   = openPanel === 'insights';
  const gearPanelOpen       = openPanel === 'gear';
  const matchesPanelOpen    = openPanel === 'matches';
  const togglePanel = (name: string) => setOpenPanel(p => p === name ? null : name);
  const [formScore, setFormScore] = useState<FormScore | null>(null);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [nextMatchInfoMode, setNextMatchInfoMode] = useState<'edit'|'add'|null>(null);
  const [nmMatchForm, setNmMatchForm] = useState<MatchForm>(EMPTY_FORM);
  const nmUploadRef = useRef<HTMLInputElement>(null);
  const [nmUploadError, setNmUploadError] = useState<string|null>(null);
  const [nmUploadExtracting, setNmUploadExtracting] = useState(false);
  const [panelUploadLoading, setPanelUploadLoading] = useState(false);
  const [panelUploadCategory, setPanelUploadCategory] = useState<string | null>(null);
  const [panelSmartResult, setPanelSmartResult] = useState<{ category: string; label: string; confidence: string; data: Record<string, string> } | null>(null);
  const [panelSmartError, setPanelSmartError] = useState<string | null>(null);
  const [panelUploadCatPickerOpen, setPanelUploadCatPickerOpen] = useState(false);
  const [panelMealTime, setPanelMealTime] = useState("");
  const [panelMealText, setPanelMealText] = useState("");
  const [panelMealsToday, setPanelMealsToday] = useState<{ id: string; time: string; description: string }[]>([]);
  const [panelNoteText, setPanelNoteText] = useState("");
  const [panelLogSub, setPanelLogSub] = useState<"nutrition" | "matchreview" | "upload-confirm" | null>(null);
  const [panelSchedModalIdx, setPanelSchedModalIdx] = useState<number | null>(null);
  const [panelSchedModalClosing, setPanelSchedModalClosing] = useState(false);
  const panelUploadRef = useRef<HTMLInputElement>(null);
  const [prevDaysOpen, setPrevDaysOpen] = useState(false);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [schedDone, setSchedDone] = useState<Record<string, string[]>>({});
  function toggleSchedDone(date: string, title: string) {
    setSchedDone(prev => {
      const titles = prev[date] ?? [];
      const next = titles.includes(title) ? titles.filter(t => t !== title) : [...titles, title];
      const updated = { ...prev, [date]: next };
      localStorage.setItem("padelop:schedule-done", JSON.stringify(updated));
      saveScheduleDoneToDb(date, next);
      return updated;
    });
  }

  function panelToggleDone(title: string) {
    if (!(schedDone[todayKey] ?? []).includes(title)) startPlusOneFast();
    toggleSchedDone(todayKey, title);
  }

  function panelCloseSchedModal() {
    setPanelSchedModalClosing(true);
    setTimeout(() => { setPanelSchedModalIdx(null); setPanelSchedModalClosing(false); }, 320);
  }

  function panelHandleSchedDone() {
    if (panelSchedModalIdx === null) return;
    const item = schedule[panelSchedModalIdx];
    const isComplete = (schedDone[todayKey] ?? []).includes(item.title);
    panelToggleDone(item.title);
    if (!isComplete) { setTimeout(panelCloseSchedModal, 350); } else { panelCloseSchedModal(); }
  }

  function panelSaveMealEntry(time: string, description: string) {
    if (!description.trim()) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const entry = { id: Date.now().toString(), date: dateStr, time, description: description.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
      localStorage.setItem("padelop:meal-log", JSON.stringify([...existing, entry]));
      window.dispatchEvent(new Event("storage"));
    } catch {}
    saveNutritionToDb({ date: dateStr, meal_type: time, description: description.trim() });
    setPanelMealsToday(prev => [...prev, entry]);
    setPanelMealText("");
  }

  function panelSaveNote(text: string) {
    if (!text.trim()) return;
    const date = new Date().toISOString().slice(0, 10);
    const entry = { id: Date.now().toString(), date, ts: new Date().toISOString(), text: text.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:notes") || "[]");
      localStorage.setItem("padelop:notes", JSON.stringify([entry, ...existing].slice(0, 200)));
      window.dispatchEvent(new Event("storage"));
    } catch {}
    saveNoteToDb({ date, body: text.trim() });
    setPanelNoteText("");
  }

  const panelDayLabel =
    effectiveDayType === "match"     ? "Match Day" :
    effectiveDayType === "pre-match" ? "Pre-Match Day" :
    effectiveDayType === "recovery"  ? "Recovery Day" :
    effectiveDayType === "maintenance" ? "Maintenance Day" :
    effectiveDayType === "training"  ? "Training Day" : "Today";
  const panelDayColor =
    effectiveDayType === "match"     ? "#2653d4" :
    effectiveDayType === "pre-match" ? "#d97706" :
    effectiveDayType === "recovery"  ? "#7c3aed" :
    effectiveDayType === "maintenance" ? "#0e7490" : "#16a34a";
  const panelInputSt: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 10, border: "1.5px solid #ffffff", fontSize: "clamp(14px, 3.6vw, 16px)", color: "#1a1c1c", outline: "none", fontFamily: "inherit", background: "#f8f9fa", boxSizing: "border-box" };
  const panelLabelSt: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096", marginBottom: 4, display: "block" };

  function readHydrationMl(): number {
    const today = new Date().toISOString().slice(0, 10);
    const LITRE_ML: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
    try {
      const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
      if (hq?.date === today && typeof hq.ml === "number" && hq.ml > 0) return hq.ml;
      const logs = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]") as HydrationEntry[];
      const todayLog = logs.find(e => new Date(e.ts).toISOString().slice(0, 10) === today);
      if (todayLog) return LITRE_ML[todayLog.litres] ?? 0;
      const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      if (ml?.date === today && ml?.waterOnWaking === true) return 500;
    } catch {}
    return 0;
  }

  function loadAll() {
    // Seal yesterday's schedule completion into padelop:schedule-history
    try {
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const history: { date: string; dayType: string; total: number; completed: number; pct: number; titles: string[] }[] =
        JSON.parse(localStorage.getItem("padelop:schedule-history") || "[]");
      if (!history.some(h => h.date === yesterday)) {
        const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
        const doneTitles = sd[yesterday] ?? [];
        let yDayType: DayType = "baseline";
        try {
          const nm = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
          const todayForSeal = new Date().toISOString().slice(0, 10);
          const revs: { ts?: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
          if (nm?.date === yesterday) {
            yDayType = "match";
          } else if (nm?.date === todayForSeal) {
            yDayType = "pre-match";
          } else {
            const matchDates = revs
              .map(r => r.ts?.slice(0, 10))
              .filter((d): d is string => !!d && d <= yesterday)
              .sort().reverse();
            if (matchDates.length > 0) {
              const daysSince = Math.round((new Date(yesterday + "T12:00").getTime() - new Date(matchDates[0] + "T12:00").getTime()) / 86400000);
              if (daysSince === 0) yDayType = "match";
              else if (daysSince === 1) yDayType = "recovery";
              else yDayType = (daysSince - 2) % 2 === 0 ? "maintenance" : "training";
            }
          }
        } catch {}
        const ySched = getScheduleData(yDayType, null, getTopNeedsWorkTag()).schedule;
        const total = ySched.length;
        const completed = ySched.filter(s => doneTitles.includes(s.title)).length;
        const pct = total ? Math.round((completed / total) * 100) : 0;
        history.unshift({ date: yesterday, dayType: yDayType, total, completed, pct, titles: doneTitles });
        localStorage.setItem("padelop:schedule-history", JSON.stringify(history.slice(0, 90)));
      }
    } catch {}

    // Profile
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
    try {
      const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
      setRacketName(g.racketName  ?? null);
      setRacketType(g.racketType  ?? null);
      setRacketImage(g.racketImage ?? null);
      setRacketSince(g.racketSince ?? null);
      setShoeImage(g.shoeImage   ?? null);
      setKitImage(g.kitImage    ?? null);
    } catch {}

    // Matches
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
      else setTrainingSessions([]);
    } catch { setTrainingSessions([]); }

    // Upcoming matches tab
    try {
      const all: StoredMatch[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
      const today2 = new Date().toISOString().slice(0, 10);
      const upcoming2 = all.filter(m => m.date >= today2).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      setUpcomingMatches(upcoming2);
      const forms: Record<number, MatchForm> = {};
      upcoming2.forEach((m, i) => { forms[i] = { date: m.date, time: m.time, club: m.club || "", court: m.court || "", p1: m.player_1 || "", p2: m.player_2 || "", p3: m.player_3 || "", p4: m.player_4 || "" }; });
      setMatchEditForms(forms);
    } catch {}

    // Journey stats
    try {
      const allMatches: StoredMatch[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
      const partners = new Set(allMatches.map(m => m.player_2).filter(Boolean));
      setPartnerCount(partners.size);
    } catch {}
    try {
      const t = JSON.parse(localStorage.getItem("padelop:tournaments") || "null");
      setTournamentCount(typeof t?.count === "number" ? t.count : 0);
    } catch {}
    try {
      const revs: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
      const trns: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]");
      const all = [...revs, ...trns].map(e => e.ts).filter(Boolean).sort();
      if (all.length > 0) {
        const d = new Date(all[0]);
        setJourneyStart(d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
      }
    } catch {}

    // Schedule done
    try {
      const sd = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
      setSchedDone(sd);
    } catch {}

    // Insights
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    setScores(s);
    const morningLog = loadMorningLog();
    setMatchReadiness(computeMatchReadiness(d.checkIn, morningLog, false, d.review));
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYMD = yesterday.toISOString().slice(0, 10);
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().from("matches").select("date").eq("date", yesterdayYMD).limit(1).maybeSingle().then(({ data }) => {
        setMatchReadiness(computeMatchReadiness(d.checkIn, morningLog, !!data, d.review));
      });
    });
    saveScoreSnapshot(s);
    saveScoreSnapshotToDb(new Date().toISOString().slice(0, 10), s);
    const hist = loadScoreHistory();
    setHistory(hist);
    const habits: { date: string }[] = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
    const dateset = new Set(habits.map(h => h.date));
    const cur = new Date();
    if (!dateset.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
    let streakCount = 0;
    while (dateset.has(cur.toISOString().slice(0, 10))) { streakCount++; cur.setDate(cur.getDate() - 1); }
    setStreak(streakCount);
    const todayStr = new Date().toISOString().slice(0, 10);
    let m2: { date: string } | null = null;
    try { m2 = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
    setPillarStates(computePillarStates(d.checkIn, d.hydration, d.nutrition, d.habits, d.training, m2?.date === todayStr));
    try { const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); setCheckinDone(ml?.date === todayStr); } catch {}
    // Food quality
    try {
      const allMeals: MealEntry[] = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
      setTodayMeals(allMeals.filter(m => m.date === todayStr));
      setFoodHistory(loadFoodHistory(7));
    } catch {}
    setHydrationMl(readHydrationMl());
    setFormScore(computeFormScore());
  }

  useEffect(() => {
    loadAll();
    hydrateFromSupabase().then(result => {
      if (result) { setGameDays(result.gameDays); setUpcomingMatches(result.upcoming as StoredMatch[]); setNextMatch(result.nextMatch as StoredMatch | null); }
      setHydrationMl(readHydrationMl());
      setFormScore(computeFormScore());
    });
    window.addEventListener("storage", loadAll);
    window.addEventListener("padelop:sync-done", loadAll);
    let lastSync = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 5_000) {
        lastSync = Date.now();
        hydrateFromSupabase().then(result => {
          if (result) { setGameDays(result.gameDays); setUpcomingMatches(result.upcoming as StoredMatch[]); setNextMatch(result.nextMatch as StoredMatch | null); }
          setHydrationMl(readHydrationMl());
          setFormScore(computeFormScore());
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", loadAll);
      window.removeEventListener("padelop:sync-done", loadAll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });
    });
  }, []);

  // Schedule clock tick
  useEffect(() => {
    const tick = setInterval(() => setSchedNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Build schedule for today
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    let mTime: string | null = null;
    try {
      const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
      if (m?.date === todayStr && m?.time) mTime = m.time;
    } catch {}
    const tag = getTopNeedsWorkTag();
    setDrillTag(tag);
    setSchedMatchTime(mTime);
  }, []);

  // Recompute schedule when dayType or drill changes
  useEffect(() => {
    const { schedule: s, currentIdx: ci } = getScheduleData(dayType, schedMatchTime, drillTag);
    setSchedule(s);
    setSchedCurrentIdx(ci);
  }, [dayType, schedMatchTime, drillTag]);

  // Update current schedule item as time passes
  useEffect(() => {
    if (!schedule.length) return;
    const curMins = schedNow.getHours() * 60 + schedNow.getMinutes();
    let idx = 0;
    const toMins = (t: string) => t.split(":").reduce((a: number, b: string, i: number) => a + (i === 0 ? Number(b) * 60 : Number(b)), 0);
    if (curMins >= toMins(schedule[schedule.length - 1].time)) {
      idx = schedule.length - 1;
    } else {
      for (let i = 0; i < schedule.length - 1; i++) {
        if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { idx = i; break; }
      }
    }
    setSchedCurrentIdx(idx);
  }, [schedNow, schedule]);

  useEffect(() => {
    if (!todayMeals.length) { setAiInsight(null); return; }
    const todayStr = new Date().toISOString().slice(0, 10);
    const cacheKey = "padelop:nutrition-ai-insight";
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.date === todayStr && cached?.mealCount === todayMeals.length) {
        setAiInsight({ score: cached.score, insight: cached.insight });
        return;
      }
    } catch {}
    const matchToday = !!nextMatch && nextMatch.date === todayStr;
    const matchYesterday = (() => {
      try {
        const allR: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        return allR.some(r => r.ts.slice(0, 10) === yesterday.toISOString().slice(0, 10));
      } catch { return false; }
    })();
    const dayTypeForAi = matchToday ? "match" : matchYesterday ? "recovery" : "training";
    fetch("/api/nutrition-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meals: todayMeals.map(m => ({ time: m.time, description: m.description })), dayType: dayTypeForAi }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.score != null && data?.insight) {
          setAiInsight(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ date: todayStr, mealCount: todayMeals.length, ...data }));
          } catch {}
          saveNutritionInsightToDb(todayStr, data.score, data.insight);
        }
      })
      .catch(() => {});
  }, [todayMeals, nextMatch]);

  const [profileOpen, setProfileOpen] = useState(false); // info section toggle
  const [profileTabEditOpen, setProfileTabEditOpen] = useState(false);
  const [profileCardOpen, setProfileCardOpen] = useState(false);
  const [profileTipsOpen, setProfileTipsOpen] = useState(false);
  const [profileInsightsOpen, setProfileInsightsOpen] = useState(false);
  const [profileMatchesOpen, setProfileMatchesOpen] = useState(false);
  const [profileGearOpen, setProfileGearOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [featuredIdx, setFeaturedIdx] = useState(() => Math.floor(Math.random() * 8));
  const [gearEditOpen, setGearEditOpen] = useState(false);
  const [racketName, setRacketName] = useState("Wilson Carbon Pro v2");
  const [racketType, setRacketType] = useState("Power & Control Hybrid");
  const [racketImage, setRacketImage] = useState("");
  const [racketSince, setRacketSince] = useState("");
  const [shoeImage, setShoeImage] = useState("");
  const [kitImage, setKitImage] = useState("");
  const racketRowRef = useRef<HTMLDivElement>(null);
  const [racketSlotSize, setRacketSlotSize] = useState(80);
  useEffect(() => {
    const el = racketRowRef.current;
    if (!el) return;
    const measure = () => setRacketSlotSize(el.offsetHeight - 24);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  type InsightGroup = { key: string; label: string; wins: number; total: number };
  type MatchInsight = {
    id: string;
    best: InsightGroup;
    worst: InsightGroup;
    rows: InsightGroup[];
    sentence: string;
    para: string;
  };

  const matchInsight = useMemo((): MatchInsight | null => {
    const decided = reviews.filter(r => r.result === "win" || r.result === "loss");
    if (decided.length < 5) return null;

    const pickBest = (rows: InsightGroup[]): { best: InsightGroup; worst: InsightGroup } | null => {
      const pop = rows.filter(r => r.total >= 2).sort((a, b) => (b.wins / b.total) - (a.wins / a.total));
      if (pop.length < 2) return null;
      const best = pop[0], worst = pop[pop.length - 1];
      return (best.wins / best.total) - (worst.wins / worst.total) >= 0.15 ? { best, worst } : null;
    };

    const toEnergyBucket = (r: ReviewEntry) => {
      if (r.energy === "high" || r.energy === "mid" || r.energy === "low") return r.energy;
      if (r.feeling === "great") return "high";
      if (r.feeling === "ok") return "mid";
      if (r.feeling === "bad") return "low";
      return null;
    };

    const computeGroups = (
      items: { key: string; label: string }[],
      getBucket: (r: ReviewEntry) => string | null
    ): InsightGroup[] => {
      const acc: Record<string, { wins: number; total: number }> = {};
      items.forEach(({ key }) => { acc[key] = { wins: 0, total: 0 }; });
      decided.forEach(r => {
        const b = getBucket(r);
        if (b && acc[b]) { acc[b].total++; if (r.result === "win") acc[b].wins++; }
      });
      return items.map(({ key, label }) => ({ key, label, ...acc[key] }));
    };

    const insightDefs: {
      id: string;
      rows: InsightGroup[];
      sentence: (best: InsightGroup, worst: InsightGroup, allWins: boolean) => string;
      para: (best: InsightGroup, worst: InsightGroup, rows: InsightGroup[]) => string;
    }[] = [
      {
        id: "energy",
        rows: computeGroups(
          [{ key: "high", label: "Fresh / well-rested" }, { key: "mid", label: "Reasonably ready" }, { key: "low", label: "Drained / tired" }],
          toEnergyBucket
        ),
        sentence: (best, worst, allWins) =>
          allWins ? "You haven't lost when you showed up well-rested."
          : best.key === "mid" ? "You win more when you arrive calm and settled."
          : "You win more when you show up fresh.",
        para: (best, worst) =>
          best.wins === best.total
            ? `You haven't lost a match when you showed up feeling fresh and well-rested — ${best.wins} out of ${best.total}. When you came in feeling drained, you won ${worst.wins} out of ${worst.total}. Sleep and recovery the night before are translating directly onto the court.`
            : best.key === "mid"
              ? `Your best results come when you feel settled rather than buzzing — ${best.wins} out of ${best.total}. When you came in at your highest, you won ${worst.wins} out of ${worst.total}. Calm and controlled seems to suit your game more than being fired up.`
              : `When you showed up feeling fresh you won ${best.wins} out of ${best.total}. When you came in feeling drained, ${worst.wins} out of ${worst.total}. How you prepare and recover the night before is showing up in your results.`,
      },
      {
        id: "mental",
        rows: computeGroups(
          [{ key: "great", label: "Confident" }, { key: "ok", label: "Calm" }, { key: "bad", label: "Nervous" }],
          r => (r as ReviewEntry & { mentalBefore?: string }).mentalBefore || null
        ),
        sentence: (best, _worst, allWins) =>
          allWins ? `You haven't lost when you felt ${best.label.toLowerCase()} before a match.`
          : best.key === "ok" ? "You win more when you feel calm going in — not fired up."
          : best.key === "great" ? "Confidence before a match shows up in your results."
          : "You actually perform well when the pressure is on.",
        para: (best, worst) =>
          best.wins === best.total
            ? `Every time you went into a match feeling ${best.label.toLowerCase()}, you won — ${best.wins} out of ${best.total}. When you felt ${worst.label.toLowerCase()}, it was ${worst.wins} out of ${worst.total}. Your mental state before a match isn't just noise.`
            : best.key === "ok"
              ? `Your record is better when you feel calm going in — ${best.wins} out of ${best.total} — compared to ${worst.wins} out of ${worst.total} when you felt ${worst.label.toLowerCase()}. Staying settled rather than psyching yourself up seems to work better for your game.`
              : `When you felt ${best.label.toLowerCase()} before a match, you won ${best.wins} out of ${best.total}. When you felt ${worst.label.toLowerCase()}, ${worst.wins} out of ${worst.total}. The way you enter a match mentally is showing up in the scoreline.`,
      },
      {
        id: "opponent",
        rows: computeGroups(
          [{ key: "tough", label: "Tougher opponents" }, { key: "equal", label: "Equal opponents" }, { key: "easy", label: "Easier opponents" }],
          r => (r as ReviewEntry & { opponent?: string }).opponent || null
        ),
        sentence: (best, _worst, allWins) =>
          allWins ? `You haven't lost against ${best.label.toLowerCase()} yet.`
          : best.key === "tough" ? "You punch above your weight."
          : best.key === "equal" ? "You perform best against evenly matched opponents."
          : "You dominate when you're the stronger pair.",
        para: (best, worst) =>
          best.key === "tough"
            ? `You've won ${best.wins} out of ${best.total} against tougher opponents — which is a strong sign. Against ${worst.label.toLowerCase()}, you've won ${worst.wins} out of ${worst.total}. You tend to raise your game when the challenge is real.`
            : `Against ${best.label.toLowerCase()} you've won ${best.wins} out of ${best.total}. Against ${worst.label.toLowerCase()}, ${worst.wins} out of ${worst.total}. Keep testing yourself at higher levels — that's where the growth happens.`,
      },
      {
        id: "warmup",
        rows: computeGroups(
          [{ key: "full", label: "Full warmup" }, { key: "quick", label: "Quick warmup" }, { key: "none", label: "No warmup" }],
          r => (r as ReviewEntry & { warmup?: string }).warmup || null
        ),
        sentence: (best, _worst, allWins) =>
          allWins ? `You haven't lost when you did a full warmup.`
          : best.key === "full" ? "Your warmup routine is making a difference."
          : best.key === "quick" ? "Even a quick warmup is paying off."
          : "Interesting — your results don't depend on warming up.",
        para: (best, worst) =>
          best.key === "none"
            ? `Surprisingly, your record without a warmup is ${best.wins} out of ${best.total} — compared to ${worst.wins} out of ${worst.total} with a ${worst.label.toLowerCase()}. This might be sample size, but it's worth watching.`
            : `When you do a ${best.label.toLowerCase()}, you've won ${best.wins} out of ${best.total}. Without one, ${worst.wins} out of ${worst.total}. It's a small thing that's showing up consistently in your results.`,
      },
    ];

    // Find all insight types with a meaningful pattern
    const available: MatchInsight[] = [];
    for (const def of insightDefs) {
      const result = pickBest(def.rows);
      if (!result) continue;
      const { best, worst } = result;
      const allWins = best.wins === best.total;
      available.push({
        id: def.id,
        best, worst,
        rows: def.rows,
        sentence: def.sentence(best, worst, allWins),
        para: def.para(best, worst, def.rows),
      });
    }

    if (available.length === 0) return null;

    // Date-seed rotation over available insights
    const today = new Date().toISOString().slice(0, 10);
    const seed = today.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return available[seed % available.length];
  }, [reviews]);

  const handleKitImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string;
      setKitImage(img);
      uploadGearImageToStorage("kit", img).then(url => {
        const src = url ?? img;
        setKitImage(src);
        try {
          const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
          localStorage.setItem("padelop:gear", JSON.stringify({ ...existing, kitImage: src }));
        } catch {}
        if (url) saveGearToDb({ type: "kit", photo_url: url });
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleShoeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string;
      setShoeImage(img);
      uploadGearImageToStorage("shoe", img).then(url => {
        const src = url ?? img;
        setShoeImage(src);
        try {
          const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
          localStorage.setItem("padelop:gear", JSON.stringify({ ...existing, shoeImage: src }));
        } catch {}
        if (url) saveGearToDb({ type: "shoe", photo_url: url });
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRacketImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string;
      setRacketImage(img);
      uploadGearImageToStorage("racket", img).then(url => {
        const src = url ?? img;
        setRacketImage(src);
        try {
          const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
          localStorage.setItem("padelop:gear", JSON.stringify({ ...existing, racketImage: src }));
        } catch {}
        if (url) saveGearToDb({ type: "racket", photo_url: url });
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Matches tab helpers
  function matchSaveList(list: StoredMatch[]) {
    const today2 = new Date().toISOString().slice(0, 10);
    const future = list.filter(m => m.date >= today2).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    localStorage.setItem("padelop:upcoming-matches", JSON.stringify(future));
    if (future.length > 0) localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
    else localStorage.removeItem("padelop:next-match");
    window.dispatchEvent(new Event("storage"));
  }
  function matchFormToStored(f: MatchForm): StoredMatch {
    return { date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 };
  }
  function matchSaveEdit(idx: number) {
    const f = matchEditForms[idx];
    if (!f?.date || !f?.time) return;
    const updated = upcomingMatches.map((m, i) => i === idx ? matchFormToStored(f) : m);
    matchSaveList(updated);
    saveUpcomingMatch({ date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 });
    setMatchExpandedIdx(null);
  }
  function matchDelete(idx: number) {
    matchSaveList(upcomingMatches.filter((_, i) => i !== idx));
    setMatchExpandedIdx(null);
  }
  function matchSaveAdd() {
    const f = matchAddForm;
    if (!f.date || !f.time) return;
    matchSaveList([...upcomingMatches, matchFormToStored(f)]);
    saveUpcomingMatch({ date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 });
    setMatchAddForm(EMPTY_FORM);
    setMatchAddOpen(false);
  }

  // Derived
  const deduped = Object.values(
    history.reduce((acc, s) => { acc[s.date] = s; return acc; }, {} as Record<string, ScoreSnapshot>)
  ).sort((a, b) => a.date.localeCompare(b.date));

  const last14 = deduped.slice(-14);
  const dow = (new Date().getDay() + 6) % 7;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - dow);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const thisWeekSnaps = deduped.filter(s => s.date >= weekStartStr);
  const lastWeekSnaps = deduped.filter(s => s.date >= lastWeekStartStr && s.date < weekStartStr);
  const avgSnap = (arr: ScoreSnapshot[]) => arr.length ? Math.round(arr.reduce((s, x) => s + x.overall, 0) / arr.length) : null;
  const thisWeekAvg = avgSnap(thisWeekSnaps);
  const lastWeekAvg = avgSnap(lastWeekSnaps);

  const tips = improveTips(pillarStates);

  // Calendar
  const now = new Date();
  const todayYMD = now.toISOString().slice(0, 10);
  const yr = now.getFullYear();
  const mo = now.getMonth();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7;
  const matchDates = new Set<string>();
  try { reviews.forEach(r => { if (r.ts) matchDates.add(r.ts.slice(0, 10)); }); } catch {}
  if (nextMatch?.date) matchDates.add(nextMatch.date);
  const recoveryDates = new Set<string>();
  matchDates.forEach(d => {
    const next = new Date(d + "T12:00:00"); next.setDate(next.getDate() + 1);
    recoveryDates.add(next.toISOString().slice(0, 10));
  });
  const monthCells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (monthCells.length % 7 !== 0) monthCells.push(null);
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const rows: (number | null)[][] = [];
  for (let r = 0; r < monthCells.length / 7; r++) rows.push(monthCells.slice(r * 7, r * 7 + 7));
  const todayDay = parseInt(todayYMD.slice(8));
  const todayCell = monthCells.findIndex(d => d === todayDay && todayYMD.startsWith(`${yr}-${String(mo + 1).padStart(2, "0")}`));
  const currentWeekRow = todayCell >= 0 ? Math.floor(todayCell / 7) : -1;

  // Schedule derived
  const schedModalItem = schedModalIdx !== null ? schedule[schedModalIdx] : null;
  const schedDetail = schedModalItem ? SCHEDULE_DETAILS[schedModalItem.title] : null;
  const schedDrillSteps = schedModalItem?.isDrill ? (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).steps : null;
  const dayLabel =
    effectiveDayType === "match"     ? "Match Day" :
    effectiveDayType === "pre-match" ? "Pre-Match Day" :
    effectiveDayType === "recovery"  ? "Recovery Day" :
    effectiveDayType === "maintenance" ? "Maintenance Day" :
    effectiveDayType === "training"  ? "Training Day" : "Today";
  const dayColor =
    effectiveDayType === "match"     ? "#2653d4" :
    effectiveDayType === "pre-match" ? "#d97706" :
    effectiveDayType === "recovery"  ? "#7c3aed" :
    effectiveDayType === "maintenance" ? "#0e7490" : "#16a34a";

  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [schedSwipeX, setSchedSwipeX] = useState(0);
  const schedSwipeTrackRef = useRef<HTMLDivElement>(null);
  const [panelExpandedMealIdx, setPanelExpandedMealIdx] = useState<number | null>(null);
  const [panelCheckedMeals, setPanelCheckedMeals] = useState<Set<number>>(new Set());

  function onSwipeStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }

  function onSwipeEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
    if (dx > 80) { router.push("/home8"); return; }
  }

  return (
    <><style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style><div className="w-full" style={{ backgroundColor: "#ffffff", height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => router.back()}
                style={{ width: 36, height: 36, borderRadius: "50%", background: "#ffffff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <h1 style={{ fontSize: "clamp(20px, 5.5vw, 26px)", fontWeight: 800, color: "#1a1c1c", margin: 0, letterSpacing: "-0.02em" }}>My Game</h1>
            </div>
            <div onClick={() => openPadlaPanel()} style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-hanken)", color: "rgba(0,0,0,0.10)", cursor: "pointer", lineHeight: 1 }}>
              {Object.values(schedDone).flat().length}
            </div>
          </div>

          {panelSmartError && (
            <div style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 12, padding: "10px 14px" }}>
              <p style={{ fontSize: 14, color: "#dc2626", margin: 0 }}>{panelSmartError}</p>
            </div>
          )}

          {/* Daily Tasks row + expanded */}
          {(() => {
              const todayDoneSet = new Set(schedDone[todayKey] ?? []);
              const total = schedule.length;
              const done = schedule.filter(s => todayDoneSet.has(s.title)).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const barColor = pct === 100 ? "#00D455" : pct >= 50 ? "#2653d4" : "#f59e0b";
              const DAY_TYPE_INFO: { label: string; color: string; desc: string }[] = [
                { label: "Match Day",       color: "#2653d4", desc: "Game day. Trust your prep and enjoy every point." },
                { label: "Pre-Match Day",   color: "#d97706", desc: "Match tomorrow. Carb up, rest, and sleep early." },
                { label: "Recovery Day",    color: "#7c3aed", desc: "Day after a match. Light movement, protein, hydration." },
                { label: "Training Day",    color: "#16a34a", desc: "Build the habit. Small consistent actions compound." },
                { label: "Maintenance Day", color: "#0e7490", desc: "Between cycles. Stay loose and let the body absorb the work." },
              ];
              return (
                <>
                {openPanel !== null && <div onClick={() => setOpenPanel(null)} style={{ position: "fixed", inset: 0, zIndex: 35 }} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: openPanel !== null ? 36 : "auto", flex: 1 }}>
                  {total > 0 && (() => {
                    // Add new panel states here to extend dimming to future circles
                    const anyOpen = openPanel !== null;
                    const dim = (active: boolean) => ({ opacity: anyOpen && !active ? 0.3 : 1, transition: "opacity 0.2s" });
                    return (
                    <>
                    {/* Coach's note */}
                    {matchInsight ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "4px 0 8px" }} onClick={() => setInsightSheetOpen(true)}>
                        <p style={{ margin: 0, fontSize: "clamp(15px, 3.9vw, 18px)", fontWeight: 300, letterSpacing: "0.01em", color: "#9aa5b0", lineHeight: 1.5, textWrap: "balance", textAlign: "center" } as React.CSSProperties}>{matchInsight.sentence}</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0 8px" }}>
                        <p style={{ margin: 0, fontSize: "clamp(15px, 3.9vw, 18px)", fontWeight: 300, letterSpacing: "0.01em", color: "#c8cdd2", lineHeight: 1.5, textAlign: "center" }}>
                          {["Habits win matches.", "Small reps compound.", "Train your weaknesses.", "Rest is part of training.", "Show up consistently.", "Log a game. See the gaps.", "Your game is built daily."][new Date().getDay()]}
                        </p>
                      </div>
                    )}
                    {/* Row 1: Next Match · Day Type · Goals */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {/* Next Match */}
                      {(() => {
                        const today = new Date().toISOString().slice(0, 10);
                        const diffDays = nextMatch
                          ? Math.round((new Date(nextMatch.date + "T12:00").getTime() - new Date(today + "T12:00").getTime()) / 86400000)
                          : null;
                        const countdownLabel = diffDays === null ? "NO MATCH" : diffDays === 0 ? "TODAY" : diffDays === 1 ? "TOMORROW" : `IN ${diffDays} DAYS`;
                        const timeLabel = nextMatch?.time ?? "";
                        const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                        return (
                          <div onClick={() => togglePanel('nextMatch')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(nextMatchPanelOpen) }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="nextMatchTopArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#2653d4" />
                              <text fontSize="19" fontWeight="700" letterSpacing="2.5" style={{ fill: "rgba(255,255,255,0.7)", fontFamily: ff }}>
                                <textPath href="#nextMatchTopArc" startOffset="50%" textAnchor="middle">NEXT MATCH</textPath>
                              </text>
                              <text x="100" y={timeLabel ? "93" : "108"} textAnchor="middle" dominantBaseline="middle"
                                fontSize={countdownLabel.length > 7 ? "18" : "22"} fontWeight="800" letterSpacing="0.06em"
                                style={{ fill: "rgba(255,255,255,0.9)", fontFamily: ff }}>
                                {countdownLabel}
                              </text>
                              {timeLabel && (
                                <text x="100" y="123" textAnchor="middle" dominantBaseline="middle"
                                  fontSize="32" fontWeight="800" letterSpacing="-0.02em" style={{ fill: "#fff", fontFamily: ff }}>
                                  {timeLabel}
                                </text>
                              )}
                            </svg>
                          </div>
                        );
                      })()}

                      {/* Day Type */}
                      <div onClick={() => togglePanel('dayType')}
                        style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(dayTypeInfoOpen) }}>
                        {(() => {
                          const parts = panelDayLabel.split(" ");
                          const mainLabel = parts.length > 1 ? parts.slice(0, -1).join(" ") : panelDayLabel;
                          const dayWord = parts.length > 1 ? parts[parts.length - 1] : "";
                          return (
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="dayTypeTopArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill={panelDayColor} />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: "rgba(255,255,255,0.75)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                <textPath href="#dayTypeTopArc" startOffset="50%" textAnchor="middle">TODAY</textPath>
                              </text>
                              <text x="100" y={dayWord ? "93" : "108"} textAnchor="middle" dominantBaseline="middle"
                                fontSize="24" fontWeight="800" style={{ fill: "white", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                {mainLabel}
                              </text>
                              {dayWord && (
                                <text x="100" y="123" textAnchor="middle" dominantBaseline="middle"
                                  fontSize="20" fontWeight="800" style={{ fill: "white", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                  {dayWord}
                                </text>
                              )}
                            </svg>
                          );
                        })()}
                      </div>

                      {/* Today's Goals */}
                      <div onClick={() => togglePanel('sched')}
                        style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(panelSchedOpen) }}>
                        <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                          <defs><path id="goalsTextArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                          <circle cx="100" cy="100" r="99" fill="#16a34a" />
                          <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: "rgba(255,255,255,0.75)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                            <textPath href="#goalsTextArc" startOffset="50%" textAnchor="middle">TODAY&apos;S GOALS</textPath>
                          </text>
                          <text x="100" y="108" textAnchor="middle" dominantBaseline="middle"
                            fontSize={pct === 100 ? "44" : "36"} fontWeight="800"
                            style={{ fill: "white", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                            {pct === 100 ? "✓" : `${done}/${total}`}
                          </text>
                          {(() => {
                            const r = 88, cX = 100, cY = 100, totalDeg = 110, startDeg = 90 + totalDeg / 2, N = schedule.length;
                            if (!N) return null;
                            const gapDeg = 7, segDeg = (totalDeg - Math.max(0, N - 1) * gapDeg) / N;
                            const toRad = (d: number) => d * Math.PI / 180;
                            return schedule.map((item, i) => {
                              const a1 = startDeg - i * (segDeg + gapDeg), a2 = a1 - segDeg;
                              const x1 = (cX + r * Math.cos(toRad(a1))).toFixed(2), y1 = (cY + r * Math.sin(toRad(a1))).toFixed(2);
                              const x2 = (cX + r * Math.cos(toRad(a2))).toFixed(2), y2 = (cY + r * Math.sin(toRad(a2))).toFixed(2);
                              return <path key={item.title} d={`M ${x1},${y1} A ${r},${r} 0 0,0 ${x2},${y2}`}
                                stroke={todayDoneSet.has(item.title) ? "white" : "rgba(255,255,255,0.25)"} strokeWidth="9" fill="none" strokeLinecap="round" style={{ transition: "stroke 0.3s" }} />;
                            });
                          })()}
                        </svg>
                      </div>

                    </div>

                    {dayTypeInfoOpen && (
                      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                          <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px" }}>
                            <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aa0a6" }}>Day Types</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {DAY_TYPE_INFO.map(dt => (
                                <div key={dt.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: dt.color, background: `${dt.color}18`, borderRadius: 5, padding: "2px 8px", flexShrink: 0, whiteSpace: "nowrap", minWidth: 114, textAlign: "center", display: "inline-block" }}>{dt.label}</span>
                                  <span style={{ fontSize: 16, color: "#5a6270", lineHeight: 1.4 }}>{dt.desc}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Next Match panel — full width below row 1 */}
                    {nextMatchPanelOpen && (() => {
                      const today2 = new Date().toISOString().slice(0, 10);
                      const matchDate = nextMatch ? new Date(nextMatch.date + "T12:00") : null;
                      const todayDate = new Date(today2 + "T12:00");
                      const diffDays = matchDate ? Math.round((matchDate.getTime() - todayDate.getTime()) / 86400000) : null;
                      const cdLabel = diffDays === null ? "NO MATCH" : diffDays === 0 ? "TODAY" : diffDays === 1 ? "TOMORROW" : `IN ${diffDays} DAYS`;
                      const dateStr = matchDate ? matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" }) : "";
                      const saveEdit = () => {
                        if (!nmMatchForm.date || !nmMatchForm.time) return;
                        const data = matchFormToStored(nmMatchForm);
                        const updated = upcomingMatches.map(m => m.date === nextMatch?.date && m.time === nextMatch?.time ? data : m);
                        const merged = upcomingMatches.some(m => m.date === nextMatch?.date && m.time === nextMatch?.time) ? updated : [data, ...upcomingMatches];
                        matchSaveList(merged);
                        saveUpcomingMatch(data);
                        setNextMatchInfoMode(null);
                      };
                      const saveAdd = () => {
                        if (!nmMatchForm.date || !nmMatchForm.time) return;
                        const data = matchFormToStored(nmMatchForm);
                        matchSaveList([...upcomingMatches, data]);
                        saveUpcomingMatch(data);
                        setNmMatchForm(EMPTY_FORM);
                        setNextMatchInfoMode(null);
                      };
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                          <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
                        <div style={{ overflow: "hidden" }}>
                          {/* hidden file input for screenshot upload */}
                          <input ref={nmUploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setNmUploadError(null); setNmUploadExtracting(true);
                            try {
                              const reader = new FileReader();
                              const base64 = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
                              const res = await fetch('/api/extract-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, mediaType: file.type }) });
                              const data = await res.json();
                              if (!res.ok || data.error) { setNmUploadError(data.message || 'Could not read the screenshot.'); }
                              else { setNmMatchForm({ date: data.date ?? '', time: data.time ?? '', club: data.club ?? '', court: data.court ?? '', p1: data.player_1 ?? '', p2: data.player_2 ?? '', p3: data.player_3 ?? '', p4: data.player_4 ?? '' }); setNextMatchInfoMode('edit'); }
                            } catch { setNmUploadError('Upload failed. Please try again.'); }
                            setNmUploadExtracting(false);
                            if (nmUploadRef.current) nmUploadRef.current.value = '';
                          }} />

                          <div style={{ padding: "20px", position: "relative" }}>
                            {/* Edit icon */}
                            <button onClick={() => {
                              if (nextMatchInfoMode === 'edit') { setNextMatchInfoMode(null); }
                              else if (nextMatch) { setNmMatchForm({ date: nextMatch.date, time: nextMatch.time, club: nextMatch.club ?? '', court: nextMatch.court ?? '', p1: nextMatch.player_1, p2: nextMatch.player_2, p3: nextMatch.player_3, p4: nextMatch.player_4 }); setNextMatchInfoMode('edit'); }
                            }} style={{ position: "absolute", top: 14, left: 14, background: "#f4f4f6", border: "none", cursor: "pointer", padding: 7, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5050" }}>
                              {nextMatchInfoMode === 'edit' ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              )}
                            </button>
                            {/* Add icon */}
                            <button onClick={() => {
                              if (nextMatchInfoMode === 'add') { setNextMatchInfoMode(null); setNmMatchForm(EMPTY_FORM); }
                              else { setNmMatchForm(EMPTY_FORM); setNmUploadError(null); setNextMatchInfoMode('add'); nmUploadRef.current?.click(); }
                            }} style={{ position: "absolute", top: 14, right: 14, background: "#f4f4f6", border: "none", cursor: "pointer", padding: 7, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5050" }}>
                              {nextMatchInfoMode === 'add' ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              )}
                            </button>

                            {/* Hero */}
                            <div style={{ textAlign: "center", marginBottom: 6, paddingTop: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2653d4" }}>Next Match</span>
                              <p style={{ margin: "6px 0 8px", fontSize: "clamp(28px, 7vw, 38px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.05, letterSpacing: "-0.01em" }}>{cdLabel}</p>
                              {nextMatch && <span style={{ fontSize: 16, color: "#6b7480", fontWeight: 500 }}>{dateStr} · {nextMatch.time}</span>}
                            </div>

                            {/* Detail rows */}
                            {nextMatch && (
                              <div style={{ display: "flex", flexDirection: "column", textAlign: "center", gap: 4, marginBottom: 4 }}>
                                {nextMatch.club && <span style={{ fontSize: 15, fontWeight: 500, color: "#8a9096" }}>({nextMatch.club})</span>}
                                {nextMatch.court && (() => { const n = nextMatch.court.match(/\d+/)?.[0]; return n ? <span style={{ fontSize: 17, fontWeight: 700, color: "#1a1c1c", lineHeight: 1.4, marginTop: 2 }}>#{n}</span> : null; })()}
                                {[nextMatch.player_1, nextMatch.player_2, nextMatch.player_3, nextMatch.player_4].filter(Boolean).length > 0 && (
                                  <span style={{ fontSize: 15, color: "#6b7480", marginTop: 4 }}>
                                    {[nextMatch.player_1, nextMatch.player_2, nextMatch.player_3, nextMatch.player_4].filter(Boolean).map(p => p.slice(0, 2)).join(' · ')}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Edit form */}
                            {nextMatchInfoMode === 'edit' && (
                              <div style={{ marginTop: 20 }}>
                                <div style={{ height: 1, background: "#f0f0f0", marginBottom: 16 }} />
                                <div className="flex flex-col gap-3">
                                  <button onClick={() => { setNmUploadError(null); nmUploadRef.current?.click(); }} disabled={nmUploadExtracting} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70" style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: nmUploadExtracting ? 0.5 : 1 }}>
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    </div>
                                    <span className="text-[14px] font-semibold text-[#1a1c1c] flex-1 text-left">{nmUploadExtracting ? "Reading screenshot…" : "Upload screenshot"}</span>
                                  </button>
                                  {nmUploadError && <div className="px-3 py-2.5 rounded-xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{nmUploadError}</div>}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                                    <input type="date" value={nmMatchForm.date} onChange={e => setNmMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: nmMatchForm.date ? "#2653d4" : "#e2e2e2", background: nmMatchForm.date ? "#f4f6ff" : "#fff", minHeight: 44, cursor: "pointer" }} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                                    <input type="time" value={nmMatchForm.time} onChange={e => setNmMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: nmMatchForm.time ? "#2653d4" : "#e2e2e2", background: nmMatchForm.time ? "#f4f6ff" : "#fff", minHeight: 44, cursor: "pointer" }} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                                    <input type="text" placeholder="e.g. Club Padel BCN" value={nmMatchForm.club} onChange={e => setNmMatchForm(f => ({ ...f, club: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: nmMatchForm.club ? "#2653d4" : "#e2e2e2", background: nmMatchForm.club ? "#f4f6ff" : "#fff" }} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Court #</label>
                                    <input type="text" placeholder="e.g. 3" value={nmMatchForm.court} onChange={e => setNmMatchForm(f => ({ ...f, court: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: nmMatchForm.court ? "#2653d4" : "#e2e2e2", background: nmMatchForm.court ? "#f4f6ff" : "#fff" }} />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                                    {(['p1','p2','p3','p4'] as const).map((key, i) => (
                                      <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={nmMatchForm[key]} onChange={e => setNmMatchForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: nmMatchForm[key] ? "#2653d4" : "#e2e2e2", background: nmMatchForm[key] ? "#f4f6ff" : "#fff" }} />
                                    ))}
                                  </div>
                                  <button onClick={saveEdit} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white" style={{ background: (!nmMatchForm.date || !nmMatchForm.time) ? "#c4c7c7" : "#2653d4" }}>Save changes</button>
                                  <button onClick={() => {
                                    if (!nextMatch) return;
                                    matchSaveList(upcomingMatches.filter(m => !(m.date === nextMatch.date && m.time === nextMatch.time)));
                                    setOpenPanel(null);
                                    setNextMatchInfoMode(null);
                                  }} className="w-full py-3 rounded-2xl text-[14px] font-semibold" style={{ background: "#fef2f2", color: "#dc2626", border: "none", cursor: "pointer" }}>Delete match</button>
                                </div>
                              </div>
                            )}

                            {/* Add form */}
                            {nextMatchInfoMode === 'add' && (
                              <div style={{ marginTop: 20 }}>
                                <div style={{ height: 1, background: "#f0f0f0", marginBottom: 16 }} />
                                <div className="flex flex-col gap-3">
                                  <button onClick={() => { setNmUploadError(null); nmUploadRef.current?.click(); }} disabled={nmUploadExtracting} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70" style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: nmUploadExtracting ? 0.5 : 1 }}>
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    </div>
                                    <span className="text-[14px] font-semibold text-[#1a1c1c] flex-1 text-left">{nmUploadExtracting ? "Reading screenshot…" : "Upload screenshot"}</span>
                                  </button>
                                  {nmUploadError && <div className="px-3 py-2.5 rounded-xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{nmUploadError}</div>}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                                    <input type="date" value={nmMatchForm.date} onChange={e => setNmMatchForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: nmMatchForm.date ? "#2653d4" : "#e2e2e2", background: nmMatchForm.date ? "#f4f6ff" : "#fff", minHeight: 44, cursor: "pointer" }} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                                    <input type="time" value={nmMatchForm.time} onChange={e => setNmMatchForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[15px] font-medium outline-none" style={{ borderColor: nmMatchForm.time ? "#2653d4" : "#e2e2e2", background: nmMatchForm.time ? "#f4f6ff" : "#fff", minHeight: 44, cursor: "pointer" }} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                                    <input type="text" placeholder="e.g. Club Padel BCN" value={nmMatchForm.club} onChange={e => setNmMatchForm(f => ({ ...f, club: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: nmMatchForm.club ? "#2653d4" : "#e2e2e2", background: nmMatchForm.club ? "#f4f6ff" : "#fff" }} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Court #</label>
                                    <input type="text" placeholder="e.g. 3" value={nmMatchForm.court} onChange={e => setNmMatchForm(f => ({ ...f, court: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: nmMatchForm.court ? "#2653d4" : "#e2e2e2", background: nmMatchForm.court ? "#f4f6ff" : "#fff" }} />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                                    {(['p1','p2','p3','p4'] as const).map((key, i) => (
                                      <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={nmMatchForm[key]} onChange={e => setNmMatchForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-[16px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]" style={{ borderColor: nmMatchForm[key] ? "#2653d4" : "#e2e2e2", background: nmMatchForm[key] ? "#f4f6ff" : "#fff" }} />
                                    ))}
                                  </div>
                                  <button onClick={saveAdd} className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white" style={{ background: (!nmMatchForm.date || !nmMatchForm.time) ? "#c4c7c7" : "#2653d4" }}>Save match</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                          </div>
                          </div>
                        </div>
                      );
                    })()}

                    {panelSchedOpen && (
                      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                          <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px" }}>
                            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aa0a6" }}>Today&apos;s Schedule</p>
                            {schedule.map((item, i) => {
                              const isDone = (schedDone[todayKey] ?? []).includes(item.title);
                              return (
                                <div key={item.title}
                                  onClick={() => { if (SCHEDULE_DETAILS[item.title] || item.isDrill) { setPanelSchedModalIdx(i); setPanelExpandedMealIdx(null); setPanelCheckedMeals(new Set()); } }}
                                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: SCHEDULE_DETAILS[item.title] || item.isDrill ? "pointer" : "default", borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f6" : "none" }}>
                                  <button onClick={e => { e.stopPropagation(); panelToggleDone(item.title); }}
                                    style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isDone ? item.color : "#d0d4da"}`, background: isDone ? item.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", cursor: "pointer" }}>
                                    {isDone && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </button>
                                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDone ? "#9aa0a6" : "#1a1c1c", textDecoration: isDone ? "line-through" : "none", flex: 1 }}>{item.title}</p>
                                  <span style={{ fontSize: 15, color: "#b0b8c1", fontWeight: 500, flexShrink: 0 }}>{item.time}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Row 2: Streak · Form Score · Hydration */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {/* Streak */}
                      {(() => {
                        const STIERS = [
                          { min: 0,   label: "Beginner",  color: "#9aa0a6", grad: ["#f4f4f6","#eaecee"] },
                          { min: 5,   label: "Starter",   color: "#2653d4", grad: ["#eef2ff","#dbe4ff"] },
                          { min: 15,  label: "Grinder",   color: "#059669", grad: ["#ecfdf5","#d1fae5"] },
                          { min: 30,  label: "Dedicated", color: "#d97706", grad: ["#fffbeb","#fde68a"] },
                          { min: 60,  label: "Elite",     color: "#7c3aed", grad: ["#faf5ff","#ede9fe"] },
                          { min: 100, label: "Legend",    color: "#0ea5e9", grad: ["#f0f9ff","#bae6fd"] },
                        ];
                        const stier = [...STIERS].reverse().find(t => streak >= t.min) ?? STIERS[0];
                        return (
                          <div onClick={() => togglePanel('streak')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(streakPanelOpen) }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="streakTopArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#f0f1f4" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: stier.color, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                <textPath href="#streakTopArc" startOffset="50%" textAnchor="middle">STREAK</textPath>
                              </text>
                              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle"
                                fontSize={streak >= 100 ? "34" : streak >= 10 ? "46" : "46"} fontWeight="800"
                                style={{ fill: stier.color, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                {streak > 0 ? streak : "—"}
                              </text>
                              <text x="100" y="152" textAnchor="middle" fontSize="20" fontWeight="600"
                                style={{ fill: stier.color, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", opacity: 0.65 } as React.CSSProperties}>
                                day streak
                              </text>
                            </svg>
                          </div>
                        );
                      })()}

                      {/* Form Score */}
                      {(() => {
                        const fs = formScore;
                        const score = fs?.score ?? null;
                        const color = score === null ? "#9aa0a6" : score >= 70 ? "#16a34a" : score >= 50 ? "#d97706" : "#ef4444";
                        const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                        return (
                          <div onClick={() => togglePanel('formScore')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(formScorePanelOpen) }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="formScoreArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#f0f1f4" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: color, fontFamily: ff }}>
                                <textPath href="#formScoreArc" startOffset="50%" textAnchor="middle">FORM</textPath>
                              </text>
                              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle"
                                fontSize={score !== null ? "46" : "36"} fontWeight="800"
                                style={{ fill: color, fontFamily: ff }}>
                                {score !== null ? score : "—"}
                              </text>
                              <text x="100" y="152" textAnchor="middle" fontSize="19" fontWeight="600"
                                style={{ fill: color, fontFamily: ff, opacity: 0.65 } as React.CSSProperties}>
                                {score === null ? "no data" : score >= 70 ? "on track" : "building"}
                              </text>
                            </svg>
                          </div>
                        );
                      })()}

                      {/* Hydration */}
                      {(() => {
                        const ml = hydrationMl;
                        const hasData = ml > 0;
                        const color = "#0ea5e9";
                        const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                        const pct = hasData ? Math.min(ml / 2000, 1) : null;
                        const centerText = hasData
                          ? (ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, "")}L` : `${ml}ml`)
                          : "—";
                        const subText = pct !== null ? `${Math.round(pct * 100)}% of 2L` : "not logged";
                        return (
                          <div onClick={() => togglePanel('hydration')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(hydrationPanelOpen) }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="hydrationArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#f0f1f4" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: color, fontFamily: ff }}>
                                <textPath href="#hydrationArc" startOffset="50%" textAnchor="middle">HYDRATION</textPath>
                              </text>
                              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle"
                                fontSize={centerText.length > 4 ? "34" : centerText.length > 2 ? "42" : "46"} fontWeight="800"
                                style={{ fill: hasData ? color : "#9aa0a6", fontFamily: ff }}>
                                {centerText}
                              </text>
                              <text x="100" y="148" textAnchor="middle" fontSize="17" fontWeight="600"
                                style={{ fill: hasData ? color : "#9aa0a6", fontFamily: ff, opacity: 0.65 } as React.CSSProperties}>
                                {subText}
                              </text>
                            </svg>
                          </div>
                        );
                      })()}

                    </div>

                    {/* Panel for row 2 */}
                    {streakPanelOpen && (() => {
                      const STIERS = [
                        { min: 0,   label: "Beginner",  color: "#9aa0a6", grad: ["#f4f4f6","#eaecee"] },
                        { min: 5,   label: "Starter",   color: "#2653d4", grad: ["#eef2ff","#dbe4ff"] },
                        { min: 15,  label: "Grinder",   color: "#059669", grad: ["#ecfdf5","#d1fae5"] },
                        { min: 30,  label: "Dedicated", color: "#d97706", grad: ["#fffbeb","#fde68a"] },
                        { min: 60,  label: "Elite",     color: "#7c3aed", grad: ["#faf5ff","#ede9fe"] },
                        { min: 100, label: "Legend",    color: "#0ea5e9", grad: ["#f0f9ff","#bae6fd"] },
                      ];
                      const stier = [...STIERS].reverse().find(t => streak >= t.min) ?? STIERS[0];
                      const snext = STIERS[STIERS.indexOf(stier) + 1];
                      const msg = streak === 0 ? "Log your first check-in to start your streak." : streak === 1 ? "Day one. Come back tomorrow to keep it going." : !snext ? "Legend status. You're in a league of your own." : `${snext.min - streak} day${snext.min - streak === 1 ? "" : "s"} to ${snext.label}.`;
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                            <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
                              <div style={{ background: `linear-gradient(145deg, ${stier.grad[0]}, ${stier.grad[1]})`, padding: "20px 20px 16px", textAlign: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: stier.color }}>{stier.label}</span>
                                <p style={{ margin: "6px 0 3px", fontSize: 44, fontWeight: 800, color: stier.color, lineHeight: 1 }}>{streak}</p>
                                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: stier.color, opacity: 0.7 }}>day streak</p>
                                <p style={{ margin: "10px 0 0", fontSize: 16, fontWeight: 500, color: "#4b5563" }}>{msg}</p>
                              </div>
                              <div style={{ background: "#fff", padding: "14px 16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                                {STIERS.map(t => {
                                  const active = t.label === stier.label, unlocked = streak >= t.min;
                                  return (
                                    <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                      <div style={{ width: "100%", height: 3, borderRadius: 99, background: unlocked ? t.color : "#e5e7eb", opacity: unlocked ? 1 : 0.4 }} />
                                      <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, color: active ? t.color : "#9aa0a6", textAlign: "center", lineHeight: 1.2, letterSpacing: "0.04em" }}>{t.label}</span>
                                      <span style={{ fontSize: 9, color: "#b0b8c1", fontWeight: 500 }}>{t.min === 0 ? "0" : `${t.min}d`}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Form Score panel */}
                    {formScorePanelOpen && formScore && (() => {
                      const { score, components } = formScore;
                      const color = score >= 70 ? "#16a34a" : score >= 50 ? "#d97706" : "#ef4444";
                      const rows: { label: string; value: number | null; weight: string }[] = [
                        { label: "Body",        value: components.body,        weight: "30%" },
                        { label: "Match form",  value: components.matchForm,   weight: "25%" },
                        { label: "Consistency", value: components.consistency, weight: "20%" },
                        { label: "Activity",    value: components.activity,    weight: "15%" },
                        { label: "Hydration",   value: components.hydration,   weight: "10%" },
                      ];
                      const bar = (v: number | null) => {
                        if (v === null) return <span style={{ fontSize: 15, color: "#b0b8c1" }}>no data</span>;
                        const c = v >= 70 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444";
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#f0f0f0" }}>
                              <div style={{ width: `${v}%`, height: "100%", borderRadius: 99, background: c, transition: "width 0.4s" }} />
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 700, color: c, minWidth: 26, textAlign: "right" }}>{v}</span>
                          </div>
                        );
                      };
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                            <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 18px 40px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aa0a6" }}>My Form</span>
                                <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {rows.map(r => (
                                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 16, color: "#6b7480", fontWeight: 500, minWidth: 80 }}>{r.label}</span>
                                    {bar(r.value)}
                                    <span style={{ fontSize: 11, color: "#c0c7d0", fontWeight: 500, minWidth: 28, textAlign: "right" }}>{r.weight}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Hydration panel */}
                    {hydrationPanelOpen && (() => {
                      const ml = hydrationMl;
                      const hLogs: HydrationEntry[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]"); } catch { return []; } })();
                      const todayLog = hLogs.find(e => new Date(e.ts).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)) ?? null;
                      const target = 2000;
                      const pct = ml > 0 ? Math.min(ml / target, 1) : null;
                      const displayMl = ml > 0 ? (ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, "")}L` : `${ml}ml`) : null;
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                            <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 18px 40px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aa0a6" }}>Hydration today</span>
                                <span style={{ fontSize: 28, fontWeight: 800, color: "#0ea5e9", lineHeight: 1 }}>{displayMl ?? "—"}</span>
                              </div>
                              {pct !== null && (
                                <>
                                  <div style={{ height: 7, borderRadius: 99, background: "#f0f0f0", marginBottom: 6 }}>
                                    <div style={{ width: `${Math.round(pct * 100)}%`, height: "100%", borderRadius: 99, background: pct >= 1 ? "#16a34a" : "#0ea5e9", transition: "width 0.4s" }} />
                                  </div>
                                  <span style={{ fontSize: 16, color: "#9aa0a6", fontWeight: 500 }}>{Math.round(pct * 100)}% of {target / 1000}L daily target</span>
                                </>
                              )}
                              {pct !== null && pct < 1 && (
                                <p style={{ margin: "14px 0 0", fontSize: 16, color: "#0ea5e9", fontWeight: 600 }}>
                                  {pct === 0 ? "Start with a glass of water." :
                                   pct < 0.25 ? "Have a big glass right now." :
                                   pct < 0.5 ? "Drink up — you're less than halfway." :
                                   pct < 0.75 ? "Keep it going, almost there." :
                                   "One more glass and you're done."}
                                </p>
                              )}
                              {!displayMl && !todayLog && (
                                <p style={{ margin: 0, fontSize: 16, color: "#9aa0a6" }}>No hydration logged today. Log from the home screen or check-in.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Row 3: Matches · Insights · Tags */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {/* Matches circle */}
                      {(() => {
                        const color = "#2653d4";
                        const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                        const wins   = reviews.filter(r => r.result === "win").length;
                        const losses = reviews.filter(r => r.result === "loss").length;
                        const total  = wins + losses;
                        const centerText = reviews.length > 0 ? String(reviews.length) : "—";
                        const sub = total > 0 ? `${Math.round((wins / total) * 100)}% wins` : "no matches";
                        return (
                          <div onClick={() => togglePanel('matches')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(matchesPanelOpen) }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="matchesArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#f0f1f4" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: color, fontFamily: ff }}>
                                <textPath href="#matchesArc" startOffset="50%" textAnchor="middle">MATCHES</textPath>
                              </text>
                              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="44" fontWeight="800" style={{ fill: color, fontFamily: ff }}>{centerText}</text>
                              <text x="100" y="148" textAnchor="middle" fontSize="17" fontWeight="600" style={{ fill: color, fontFamily: ff, opacity: 0.65 } as React.CSSProperties}>{sub}</text>
                            </svg>
                          </div>
                        );
                      })()}

                      {/* Insights circle */}
                      {(() => {
                        const color = "#f59e0b";
                        const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                        const wins   = reviews.filter(r => r.result === "win").length;
                        const losses = reviews.filter(r => r.result === "loss").length;
                        const last5i = [...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
                        const hasTopWellDone = reviews.flatMap(r => r.wellDone ?? []).length > 0;
                        const hasTopImprove  = reviews.flatMap(r => r.improved ?? []).length > 0;
                        const count  = [
                          reviews.length >= 3 && wins + losses > 0,
                          last5i.length >= 3,
                          hasTopWellDone,
                          hasTopImprove,
                          streak > 0,
                          partnerCount >= 2,
                          trainingSessions.length > 0,
                          thisWeekAvg !== null && lastWeekAvg !== null,
                          tournamentCount > 0,
                        ].filter(Boolean).length;
                        return (
                          <div onClick={() => togglePanel('insights')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(insightsPanelOpen) }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="insightsArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#f0f1f4" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: color, fontFamily: ff }}>
                                <textPath href="#insightsArc" startOffset="50%" textAnchor="middle">INSIGHTS</textPath>
                              </text>
                              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="44" fontWeight="800" style={{ fill: color, fontFamily: ff }}>{count > 0 ? count : "—"}</text>
                              <text x="100" y="148" textAnchor="middle" fontSize="17" fontWeight="600" style={{ fill: color, fontFamily: ff, opacity: 0.65 } as React.CSSProperties}>featured</text>
                            </svg>
                          </div>
                        );
                      })()}

                      {/* Tags circle */}
                      {(() => {
                        const color = "#e11d48";
                        const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
                        const wellCounts: Record<string, number> = {};
                        const badCounts: Record<string, number> = {};
                        reviews.forEach(r => {
                          (r.wellDone ?? []).forEach(t => { wellCounts[t] = (wellCounts[t] ?? 0) + 1; });
                          (r.improved ?? []).forEach(t => { badCounts[t] = (badCounts[t] ?? 0) + 1; });
                        });
                        const totalTags = Object.keys(wellCounts).length + Object.keys(badCounts).length;
                        return (
                          <div onClick={() => togglePanel('goodBad')}
                            style={{ flex: 1, aspectRatio: "1/1", cursor: "pointer", padding: 0, ...dim(openPanel === 'goodBad') }}>
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: "block" }}>
                              <defs><path id="goodBadArc" d="M 30,76 A 76,76 0 0,1 170,76" /></defs>
                              <circle cx="100" cy="100" r="99" fill="#f0f1f4" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: color, fontFamily: ff }}>
                                <textPath href="#goodBadArc" startOffset="50%" textAnchor="middle">PATTERNS</textPath>
                              </text>
                              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="44" fontWeight="800" style={{ fill: color, fontFamily: ff }}>{totalTags > 0 ? totalTags : "—"}</text>
                              <text x="100" y="148" textAnchor="middle" fontSize="17" fontWeight="600" style={{ fill: color, fontFamily: ff, opacity: 0.65 } as React.CSSProperties}>tags logged</text>
                            </svg>
                          </div>
                        );
                      })()}
                    </div>


                    {/* Insight detail sheet */}
                    {insightSheetOpen && matchInsight && (() => {
                      const decided = reviews.filter(r => r.result === "win" || r.result === "loss");
                      const Row = ({ label, wins, total }: { label: string; wins: number; total: number }) => {
                        if (total === 0) return null;
                        const pct = Math.round((wins / total) * 100);
                        const color = pct >= 60 ? "#16a34a" : pct >= 40 ? "#f59e0b" : "#dc2626";
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 15, color: "#4a5050", minWidth: 120 }}>{label}</span>
                            <div style={{ flex: 1, height: 5, borderRadius: 999, background: "#f0f0f0", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: color }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#8a9096", minWidth: 60, textAlign: "right" }}>{wins} out of {total}</span>
                          </div>
                        );
                      };
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setInsightSheetOpen(false)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                            <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
                              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#b0b8c1" }}>Match pattern</p>
                              <p style={{ margin: 0, fontSize: 16, color: "#1a1c1c", lineHeight: 1.65, fontWeight: 400 }}>{matchInsight.para}</p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
                                {matchInsight.rows.map(r => <Row key={r.key} label={r.label} wins={r.wins} total={r.total} />)}
                              </div>
                              <p style={{ margin: 0, fontSize: 12, color: "#b0b8c1", lineHeight: 1.5 }}>Based on {decided.length} rated match{decided.length !== 1 ? "es" : ""}. Patterns sharpen as you log more.</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Matches panel */}
                    {matchesPanelOpen && (
                      <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                          <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "4px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <p className="t-label" style={{ color: "var(--c-label)", margin: "10px 0 0" }}>Matches</p>

                        {/* Match record card */}
                        {reviews.length > 0 && (() => {
                          const last7 = reviews.slice(0, 7);
                          const wins = last7.filter(r => r.result === "win").length;
                          const winRate = Math.round((wins / last7.length) * 100);
                          const ringColor = winRate >= 60 ? "#16a34a" : winRate >= 40 ? "#f59e0b" : "#dc2626";
                          const rr = 32, stroke = 7, size = 80;
                          const circ = 2 * Math.PI * rr;
                          const offset = circ * (1 - winRate / 100);
                          return (
                            <div style={{ background: "#f8f9fa", borderRadius: 16, padding: "14px 16px" }}>
                              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096" }}>Match Record</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <div style={{ position: "relative", flexShrink: 0 }}>
                                  <svg width={size} height={size}>
                                    <circle cx={size/2} cy={size/2} r={rr} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
                                    <circle cx={size/2} cy={size/2} r={rr} fill="none" stroke={ringColor} strokeWidth={stroke} strokeLinecap="round"
                                      strokeDasharray={circ} strokeDashoffset={offset}
                                      style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }} />
                                  </svg>
                                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 17, fontWeight: 800, color: "#1a1c1c", lineHeight: 1 }}>{winRate}%</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096" }}>wins</span>
                                  </div>
                                </div>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                  {last7.map((rev, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: "#8a9096", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {new Date(rev.ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                      </span>
                                      <div style={{ height: 22, borderRadius: 8, display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, background: rev.result === "win" ? "#dcfce7" : rev.result === "draw" ? "#fef9c3" : "#fee2e2" }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "capitalize", color: rev.result === "win" ? "#16a34a" : rev.result === "draw" ? "#a16207" : "#dc2626" }}>
                                          {rev.result}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {matchAddOpen && (
                          <div style={{ background: "#f8f9fa", borderRadius: 20, padding: "18px 16px" }}>
                            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>New match</p>
                            <MatchFormWidget form={matchAddForm} onChange={setMatchAddForm} onSave={matchSaveAdd} saveLabel="Save match" saveColor="#16a34a" />
                          </div>
                        )}
                        {upcomingMatches.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <p style={{ margin: "4px 4px 0", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>UPCOMING</p>
                            {upcomingMatches.map((m, idx) => {
                              const expanded = matchExpandedIdx === idx;
                              const form = matchEditForms[idx] ?? EMPTY_FORM;
                              const players = [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean);
                              const countdown = fmtCountdown(m.date, m.time);
                              const isToday2 = countdown === "Today";
                              return (
                                <div key={idx} style={{ background: "#f8f9fa", borderRadius: 18, overflow: "hidden" }}>
                                  <button onClick={() => { setMatchExpandedIdx(expanded ? null : idx); setMatchAddOpen(false); }} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                                    <div style={{ flexShrink: 0, width: 48, textAlign: "center", background: isToday2 ? "#eef2ff" : "#fff", borderRadius: 12, padding: "8px 4px" }}>
                                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                                      <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: isToday2 ? "#2653d4" : "#1a1c1c", lineHeight: 1 }}>{new Date(m.date + "T12:00").getDate()}</p>
                                      <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</p>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>{m.time || "—"}</span>
                                        {m.club && <span style={{ fontSize: 15, color: "#8a9096", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {m.club}{m.court ? ` #${m.court}` : ""}</span>}
                                      </div>
                                      {players.length > 0 && <p style={{ margin: 0, fontSize: 15, color: "#8a9096", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{players.join(", ")}</p>}
                                      <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isToday2 ? "#eef2ff" : "#f4f6f8", color: isToday2 ? "#2653d4" : "#8a9096" }}>{countdown}</span>
                                    </div>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                                  </button>
                                  {expanded && (
                                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f2f5" }}>
                                      <MatchFormWidget form={form} onChange={f => setMatchEditForms(prev => ({ ...prev, [idx]: f }))} onSave={() => matchSaveEdit(idx)} onDelete={() => matchDelete(idx)} saveLabel="Save changes" saveColor="#2653d4" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : !matchAddOpen && (
                          <div style={{ background: "#f8f9fa", borderRadius: 20, padding: "24px 20px", textAlign: "center" }}>
                            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>No upcoming matches</p>
                            <p style={{ margin: "0 0 14px", fontSize: 15, color: "#8a9096" }}>Schedule your next game</p>
                          </div>
                        )}
                        <button
                          onClick={() => { setMatchAddOpen(o => !o); setMatchExpandedIdx(null); if (!matchAddOpen) setMatchAddForm(EMPTY_FORM); }}
                          style={{ alignSelf: "flex-start", background: matchAddOpen ? "#e8edf8" : "#2653d4", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 15, fontWeight: 700, color: matchAddOpen ? "#2653d4" : "#fff", cursor: "pointer" }}
                        >
                          {matchAddOpen ? "Cancel" : "+ Add"}
                        </button>
                        {reviews.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                            <p style={{ margin: "4px 4px 0", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>HISTORY</p>
                            {[...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).map((r, i) => {
                              const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
                              const resultBg   = r.result === "win" ? "#f0fdf4" : r.result === "loss" ? "#fff5f5" : "#f4f6f8";
                              const opponentNames = typeof (r as ReviewEntry & { opponentNames?: string }).opponentNames === "string" && (r as ReviewEntry & { opponentNames?: string }).opponentNames ? (r as ReviewEntry & { opponentNames?: string }).opponentNames : null;
                              return (
                                <button key={i} onClick={() => setSelectedReview(r)} style={{ width: "100%", background: "#f8f9fa", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: "none", cursor: "pointer", textAlign: "left" }}>
                                  <div style={{ flexShrink: 0, width: 44, textAlign: "center", background: "#fff", borderRadius: 11, padding: "7px 4px" }}>
                                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#8a9096" }}>{new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                                    <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 900, color: "#1a1c1c", lineHeight: 1 }}>{new Date(r.ts.slice(0, 10) + "T12:00").getDate()}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {opponentNames ? (
                                      <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#1a1c1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>vs {opponentNames}</p>
                                    ) : (
                                      r.feeling && <p style={{ margin: "0 0 2px", fontSize: 15, color: "#8a9096" }}>{r.feeling}</p>
                                    )}
                                    {(r.wellDone?.length > 0 || r.improved?.length > 0) && (
                                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                                        {r.wellDone?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#f0fdf4", color: "#16a34a" }}>{t}</span>)}
                                        {r.improved?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#fff5f5", color: "#ef4444" }}>{t}</span>)}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                                    {r.result && <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: resultBg, color: resultColor }}>{r.result.charAt(0).toUpperCase() + r.result.slice(1)}</span>}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Insights panel */}
                    {insightsPanelOpen && (() => {
                      const wins   = reviews.filter(r => r.result === "win").length;
                      const losses = reviews.filter(r => r.result === "loss").length;
                      const last5  = [...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
                      const last5Wins = last5.filter(r => r.result === "win").length;
                      const topWellDone = (() => {
                        const counts: Record<string, number> = {};
                        reviews.flatMap(r => r.wellDone ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
                        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
                      })();
                      const topImprove = (() => {
                        const counts: Record<string, number> = {};
                        reviews.flatMap(r => r.improved ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
                        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
                      })();
                      const pool: { label: string; body: string }[] = [
                        reviews.length >= 3 && wins + losses > 0
                          ? { label: "Win rate", body: `You've won ${wins} out of ${wins + losses} recorded matches — a ${Math.round((wins / (wins + losses)) * 100)}% win rate. ${wins > losses ? "Keep it going." : "Every loss is data. Use it."}` }
                          : null,
                        last5.length >= 3
                          ? { label: "Recent form", body: `In your last ${last5.length} matches you won ${last5Wins}. ${last5Wins >= 3 ? "Strong run — confidence should be high going into your next game." : last5Wins === 0 ? "Tough stretch. Look back at what you improved on and build from there." : "Mixed results — small consistency gains will tip the balance."}` }
                          : null,
                        topWellDone
                          ? { label: "Your strength", body: `"${topWellDone[0]}" is the thing you've done well in most often — flagged across ${topWellDone[1]} match${topWellDone[1] > 1 ? "es" : ""}. That's your weapon. Keep sharpening it.` }
                          : null,
                        topImprove
                          ? { label: "Your focus area", body: `"${topImprove[0]}" is the area you've logged as needing work most — ${topImprove[1]} time${topImprove[1] > 1 ? "s" : ""}. Targeted practice on this one will move your game the fastest.` }
                          : null,
                        streak > 0
                          ? { label: "Streak", body: streak >= 7 ? `${streak} days and counting. A week-plus streak means habits are forming — that's where real gains live.` : streak >= 3 ? `${streak}-day streak. You're building momentum. Don't break the chain.` : `${streak} day${streak > 1 ? "s" : ""} in a row. Small start, big potential — log tomorrow and keep it going.` }
                          : null,
                        partnerCount >= 2
                          ? { label: "Partners", body: `You've played with ${partnerCount} different partners. Variety in partners exposes you to different styles and speeds up your adaptability on court.` }
                          : null,
                        trainingSessions.length > 0
                          ? { label: "Training", body: `${trainingSessions.length} training session${trainingSessions.length > 1 ? "s" : ""} logged so far. Players who train consistently between matches typically improve 2–3× faster than those who only play.` }
                          : null,
                        thisWeekAvg !== null && lastWeekAvg !== null
                          ? (() => {
                              const band = (n: number) => n >= 85 ? "Strong" : n >= 75 ? "Good" : n >= 65 ? "Steady" : "Low";
                              const thisLabel = band(thisWeekAvg);
                              const lastLabel = band(lastWeekAvg);
                              const avgPillar = (snaps: ScoreSnapshot[], key: keyof ScoreSnapshot) => snaps.length ? snaps.reduce((a, s) => a + (s[key] as number), 0) / snaps.length : 0;
                              const pillars = ["recovery", "nutrition", "training", "wellbeing"] as const;
                              const pillarNames: Record<string, string> = { recovery: "Recovery", nutrition: "Nutrition", training: "Training", wellbeing: "Wellbeing" };
                              const deltas = pillars.map(p => ({ p, delta: avgPillar(thisWeekSnaps, p) - avgPillar(lastWeekSnaps, p) }));
                              const bestGain = deltas.filter(d => d.delta > 2).reduce((a, b) => b.delta > a.delta ? b : a, { p: "", delta: -Infinity });
                              const worstDrop = deltas.filter(d => d.delta < -2).reduce((a, b) => b.delta < a.delta ? b : a, { p: "", delta: Infinity });
                              const body = thisLabel === lastLabel
                                ? thisWeekAvg > lastWeekAvg
                                  ? `Still ${thisLabel} — you improved slightly this week${bestGain.p ? `, with ${pillarNames[bestGain.p].toLowerCase()} leading the way` : ""}. You're close to breaking into ${band(thisWeekAvg + 5)} territory.`
                                  : thisWeekAvg < lastWeekAvg
                                    ? `Still ${thisLabel}, but your scores dipped slightly this week${worstDrop.p ? ` — ${pillarNames[worstDrop.p].toLowerCase()} was the weakest area` : ""}. Nothing alarming, but worth keeping an eye on.`
                                    : `Exactly the same as last week — your routine is holding steady. ${thisLabel === "Strong" ? "That's a great place to be." : "Improving your sleep or hydration consistency is usually the quickest way to move forward."}`
                                : thisWeekAvg > lastWeekAvg
                                  ? `You moved from ${lastLabel} to ${thisLabel} this week${bestGain.p ? ` — ${pillarNames[bestGain.p].toLowerCase()} improved the most` : ""}. That's real progress.`
                                  : `Your scores dropped from ${lastLabel} to ${thisLabel} this week${worstDrop.p ? ` — ${pillarNames[worstDrop.p].toLowerCase()} took the biggest hit` : ""}. A dip happens; focus on getting your sleep and recovery back on track.`;
                              return { label: "Week on week", body };
                            })()
                          : null,
                        tournamentCount > 0
                          ? { label: "Tournaments", body: `You've entered ${tournamentCount} tournament${tournamentCount > 1 ? "s" : ""}. Competitive pressure is one of the best accelerators — the nerves, the intensity, the opponents. Keep entering.` }
                          : null,
                      ].filter((x): x is { label: string; body: string } => x !== null);
                      const sheetContent = pool.length === 0
                        ? <p style={{ fontSize: 15, color: "#9aa0a6", margin: 0 }}>No insights yet — log some matches and check-ins to unlock.</p>
                        : (() => {
                            const idx = featuredIdx % pool.length;
                            const insight = pool[idx];
                            return (
                              <>
                                <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aa0a6" }}>Featured Insights</p>
                                <button
                                  onClick={() => setFeaturedIdx(i => (i + 1) % pool.length)}
                                  style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                                >
                                  <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-blue)" }}>{insight.label}</p>
                                  <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 500, color: "#2c3235", lineHeight: 1.65 }}>{insight.body}</p>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      {pool.map((_, i) => (
                                        <div key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, background: i === idx ? "var(--c-blue)" : "#e2e5ea", transition: "width 0.2s" }} />
                                      ))}
                                    </div>
                                    <span style={{ fontSize: 15, color: "var(--c-hint)", fontWeight: 500 }}>Tap for next</span>
                                  </div>
                                </button>
                              </>
                            );
                          })();
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
                            <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 16px 40px" }}>
                              {sheetContent}
                            </div>
                          </div>
                        </div>
                      );
                    })()}




                    {/* Good/Bad panel */}
                    {openPanel === 'goodBad' && (() => {
                      const wellCounts: Record<string, number> = {};
                      const badCounts: Record<string, number> = {};
                      reviews.forEach(r => {
                        (r.wellDone ?? []).forEach(t => { wellCounts[t] = (wellCounts[t] ?? 0) + 1; });
                        (r.improved ?? []).forEach(t => { badCounts[t] = (badCounts[t] ?? 0) + 1; });
                      });
                      const wellTags = Object.entries(wellCounts).sort((a, b) => b[1] - a[1]);
                      const badTags  = Object.entries(badCounts).sort((a, b) => b[1] - a[1]);
                      return (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => setOpenPanel(null)}>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                          <div className="relative w-full bg-white flex flex-col" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
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
                    })()}
</>
                    );
                  })()}
                </div>
                </>
                );
              })()}

        </div>

      {/* ── Match detail bottom sheet ─────────────────────────────────────── */}
      {selectedReview && (() => {
        const r = selectedReview;
        const opponentNames = typeof (r as ReviewEntry & { opponentNames?: string }).opponentNames === "string" ? (r as ReviewEntry & { opponentNames?: string }).opponentNames : "";
        const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
        const resultBg    = r.result === "win" ? "#f0fdf4"  : r.result === "loss" ? "#fff5f5"  : "#f4f6f8";
        const dateStr = new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
        const FEELING_LABEL: Record<string, string> = { great: "Felt great", ok: "Felt OK", bad: "Felt rough" };
        const ENERGY_LABEL:  Record<string, string> = { high: "High energy", mid: "Medium energy", low: "Low energy" };
        const MENTAL_LABEL:  Record<string, string> = { calm: "Calm", focused: "Focused", nervous: "Nervous", overwhelmed: "Overwhelmed", confident: "Confident" };
        return (
          <div
            className="fixed inset-0 z-[300] flex items-end"
            onClick={() => setSelectedReview(null)}
            onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
          >
            <style>{`@keyframes reviewUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="relative w-full bg-white flex flex-col"
              style={{ borderRadius: "28px 28px 0 0", maxHeight: "88dvh", minHeight: "50dvh", animation: "reviewUp 0.32s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -4px 40px rgba(0,0,0,0.18)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#e2e2e2]" />
              </div>

              {/* Header */}
              <div className="px-6 pb-5 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9aa5b0]">{dateStr}</p>
                    {opponentNames && <p className="text-[22px] font-bold text-[#1a1c1c] mt-0.5 leading-tight">vs {opponentNames}</p>}
                    {!opponentNames && <p className="text-[22px] font-bold text-[#1a1c1c] mt-0.5 leading-tight">Match</p>}
                  </div>
                  {r.result && (
                    <span className="flex-shrink-0 text-[14px] font-black px-4 py-2 rounded-full" style={{ background: resultBg, color: resultColor }}>
                      {r.result.charAt(0).toUpperCase() + r.result.slice(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 pb-8 flex flex-col gap-5" style={{ overscrollBehavior: "contain" }}>

                {/* Notes */}
                {r.notes && (
                  <div className="p-4 rounded-2xl" style={{ background: "#fff" }}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Notes</p>
                    <p className="text-[15px] text-[#1a1c1c] leading-relaxed">{r.notes}</p>
                  </div>
                )}

                {/* Tags */}
                {(r.wellDone?.length > 0 || r.improved?.length > 0) && (
                  <div className="flex flex-col gap-3">
                    {r.wellDone?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Went well</p>
                        <div className="flex flex-wrap gap-2">
                          {r.wellDone.map(t => (
                            <span key={t} className="text-[13px] font-bold px-3 py-1.5 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a" }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.improved?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Work on</p>
                        <div className="flex flex-wrap gap-2">
                          {r.improved.map(t => (
                            <span key={t} className="text-[13px] font-bold px-3 py-1.5 rounded-full" style={{ background: "#fff5f5", color: "#ef4444" }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Feel / Energy / Mental */}
                {(r.feeling || r.energy || r.mentalBefore || r.mentalDuring || r.mentalAfter) && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0]">On the day</p>
                    <div className="flex flex-wrap gap-2">
                      {r.feeling && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">{FEELING_LABEL[r.feeling] ?? r.feeling}</span>}
                      {r.energy  && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">{ENERGY_LABEL[r.energy]  ?? r.energy}</span>}
                      {r.mentalBefore && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">Before: {MENTAL_LABEL[r.mentalBefore] ?? r.mentalBefore}</span>}
                      {r.mentalDuring && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">During: {MENTAL_LABEL[r.mentalDuring] ?? r.mentalDuring}</span>}
                      {r.mentalAfter  && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">After: {MENTAL_LABEL[r.mentalAfter]  ?? r.mentalAfter}</span>}
                      {r.injury && r.injury !== "no" && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full" style={{ background: "#fff7ed", color: "#c2410c" }}>Injury: {r.injury}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}


      {/* ── Schedule detail modal ────────────────────────────────────────── */}
      {schedModalItem && (() => {
        const isSchedItemDone = (schedDone[todayKey] ?? []).includes(schedModalItem.title);
        const isMeal = schedDetail?.type === 'meal';
        const isExercise = schedDetail?.type === 'exercise';
        const isInfo = schedDetail?.type === 'info';
        const isDrill = schedModalItem.isDrill;
        const steps = isDrill ? (schedDrillSteps ?? []) : (schedDetail?.type === 'exercise' ? schedDetail.steps : []);

        const closeSchedModal = () => {
          setSchedModalClosing(true);
          setTimeout(() => { setSchedModalIdx(null); setSchedModalClosing(false); }, 320);
        };
        const handleSchedDone = () => {
          toggleSchedDone(todayKey, schedModalItem.title);
          if (!isSchedItemDone) {
            setTimeout(closeSchedModal, 350);
          } else {
            closeSchedModal();
          }
        };

        const renderSteps = (stepList: { step: string; cue: string; reps: string }[]) => (
          <div className="flex flex-col gap-3 mt-3">
            {stepList.map((s, i) => (
              <div key={i} className="flex flex-col items-center p-3 text-center">
                <p className="text-[17px] font-semibold text-[#1a1c1c] leading-snug">{s.step}</p>
                <p className="text-[14px] text-[#6b7480] mt-1 leading-snug">{s.cue}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#2653d420", color: "#2653d4" }}>{s.reps}</span>
              </div>
            ))}
          </div>
        );

        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" style={{ paddingTop: "24px", paddingBottom: "24px" }} onClick={closeSchedModal}>
            <style>{`@keyframes profileGuideIn{from{transform:scale(0.94);opacity:0}to{transform:scale(1);opacity:1}}@keyframes profileGuideOut{from{transform:scale(1);opacity:1}to{transform:scale(0.94);opacity:0}}`}</style>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: schedModalClosing ? "profileGuideOut 0.2s cubic-bezier(0.4,0,1,1) both" : undefined }} />
            <div
              className="relative w-full bg-white flex flex-col"
              style={{ borderRadius: 28, maxHeight: "85dvh", animation: schedModalClosing ? "profileGuideOut 0.2s cubic-bezier(0.4,0,1,1) both" : "profileGuideIn 0.22s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)", overflow: "hidden" }}
              onClick={e => e.stopPropagation()}
            >
              {(isMeal || isExercise || isDrill || isInfo) && (
                <div className="overflow-y-auto flex-1 px-6 pb-6" style={{ minHeight: 0 }}>
                  <p className="font-bold" style={{ color: "#1a1c1c", fontSize: "clamp(22px, 6.5vw, 30px)", lineHeight: 1.15, margin: "20px 0 4px" }}>{schedModalItem.title}</p>
                  {isMeal && schedDetail?.type === 'meal' && (
                    <div className="flex flex-col pt-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest pb-3" style={{ color: "#8a9096" }}>{schedDetail.focus}</p>
                      {schedDetail.options.map((meal, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
                          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#1a1c1c", lineHeight: 1.4 }}>{meal.title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(isInfo || isExercise || isDrill) && (
                    <div className="pt-4">
                      {isInfo && schedDetail?.type === 'info' && (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-widest pb-3" style={{ color: "#1a1c1c" }}>{schedDetail.focus}</p>
                          <p className="text-[17px] text-[#4a5050] leading-snug">{schedDetail.text}</p>
                        </>
                      )}
                      {isExercise && renderSteps(steps)}
                      {isDrill && (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-widest pb-1" style={{ color: "#1a1c1c" }}>{(DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).focus}</p>
                          {renderSteps(steps)}
                        </>
                      )}
                    </div>
                  )}
                  <div className="pt-6">
                    {isSchedItemDone ? (
                      <button
                        onClick={handleSchedDone}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 56, borderRadius: 28, border: "2px solid #00D455", background: "transparent", cursor: "pointer" }}
                      >
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#00D455", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#00D455" }}>Done</span>
                      </button>
                    ) : (
                      <div
                        ref={schedSwipeTrackRef}
                        style={{ position: "relative", height: 56, borderRadius: 28, background: "#f0f1f3", overflow: "hidden", touchAction: "none" }}
                        onTouchStart={e => { setSchedSwipeX(0); const track = schedSwipeTrackRef.current as (HTMLDivElement & { _startX?: number }) | null; if (track) track._startX = e.touches[0].clientX; }}
                        onTouchMove={e => {
                          const track = schedSwipeTrackRef.current as (HTMLDivElement & { _startX?: number }) | null;
                          if (!track) return;
                          const maxX = track.offsetWidth - 56;
                          const startX = track._startX ?? e.touches[0].clientX;
                          setSchedSwipeX(Math.max(0, Math.min(maxX, e.touches[0].clientX - startX)));
                        }}
                        onTouchEnd={() => {
                          const track = schedSwipeTrackRef.current;
                          if (!track) return;
                          const maxX = track.offsetWidth - 56;
                          if (schedSwipeX >= maxX * 0.82) { handleSchedDone(); }
                          setSchedSwipeX(0);
                        }}
                      >
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: schedSwipeX, background: "#00D455", transition: schedSwipeX === 0 ? "width 0.3s" : "none" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#8a9096", opacity: Math.max(0, 1 - schedSwipeX / 80), transition: "opacity 0.1s" }}>Swipe to complete</span>
                        </div>
                        <div style={{ position: "absolute", top: 4, left: 4 + schedSwipeX, width: 48, height: 48, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: schedSwipeX === 0 ? "left 0.3s" : "none", pointerEvents: "none" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M13 6l6 6-6 6"/></svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}


      {/* Panel file input */}
      <input
        ref={panelUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          setPanelUploadLoading(true);
          setPanelSmartError(null);
          try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const body: Record<string, string> = { image: base64, mediaType: file.type };
            if (panelUploadCategory) body.forceCategory = panelUploadCategory;
            const res = await fetch("/api/classify-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const result = await res.json();
            if (!res.ok || result.error) {
              setPanelSmartError(result.message || "Could not read the image.");
            } else {
              setPanelSmartResult(result);
              setPanelLogSub("upload-confirm");
            }
          } catch {
            setPanelSmartError("Upload failed. Please try again.");
          }
          setPanelUploadLoading(false);
          setPanelUploadCategory(null);
          if (panelUploadRef.current) panelUploadRef.current.value = "";
        }}
      />

      {/* Panel schedule detail modal */}
      {panelSchedModalIdx !== null && (() => {
        const item = schedule[panelSchedModalIdx];
        const isComplete = (schedDone[todayKey] ?? []).includes(item.title);
        const detail = SCHEDULE_DETAILS[item.title];
        const isMeal = detail?.type === 'meal';
        const isExercise = detail?.type === 'exercise';
        const isInfo = detail?.type === 'info';
        const drillDef = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
        const isDrill = !!item.isDrill;

        const renderSteps = (stepList: { step: string; cue: string; reps: string }[]) => (
          <div className="flex flex-col gap-3 mt-3">
            {stepList.map((s, i) => (
              <div key={i} className="flex flex-col items-start p-3">
                <p className="text-[17px] font-semibold text-[#1a1c1c] leading-snug" style={{ margin: 0 }}>{s.step}</p>
                <p className="text-[14px] text-[#6b7480] mt-1 leading-snug" style={{ margin: 0 }}>{s.cue}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#2653d420", color: "#2653d4" }}>{s.reps}</span>
              </div>
            ))}
          </div>
        );

        return (
          <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={panelCloseSchedModal} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <style>{`@keyframes mgsheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes mgsheet-down{from{transform:translateY(0)}to{transform:translateY(100%)}}@keyframes mgsheet-fade-out{from{opacity:1}to{opacity:0}}`}</style>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: panelSchedModalClosing ? "mgsheet-fade-out 0.28s cubic-bezier(0.4,0,1,1) both" : undefined }} />
            <div
              className="relative w-full bg-white flex flex-col"
              style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: panelSchedModalClosing ? "mgsheet-down 0.28s cubic-bezier(0.4,0,1,1) both" : "mgsheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "12px auto 0", flexShrink: 0 }} />
              <div className="overflow-y-auto flex-1 px-6 pb-4" style={{ minHeight: 0 }}>
                <p style={{ margin: "20px 0 4px", fontSize: "clamp(22px, 6.5vw, 30px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15 }}>{item.title}</p>
                {isMeal && detail?.type === 'meal' && (
                  <div className="flex flex-col pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest pb-3" style={{ color: "#8a9096" }}>{detail.focus}</p>
                    <p style={{ fontSize: "clamp(17px, 4.4vw, 21px)", fontWeight: 600, color: "#1a1c1c", margin: "0 0 8px" }}>What did you eat?</p>
                    {detail.options.map((meal, i) => (
                      <div key={i}>
                        <button
                          onClick={() => setPanelExpandedMealIdx(panelExpandedMealIdx === i ? null : i)}
                          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setPanelCheckedMeals(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; }); }}
                              style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${panelCheckedMeals.has(i) ? "#16a34a" : "#c4c7c7"}`, background: panelCheckedMeals.has(i) ? "#16a34a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                            >
                              {panelCheckedMeals.has(i) && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>}
                            </button>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1c1c", lineHeight: 1.3, textAlign: "left" }}>{meal.title}</span>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: panelExpandedMealIdx === i ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {panelExpandedMealIdx === i && meal.detail && (
                          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7480", lineHeight: 1.5 }}>{meal.detail}</p>
                        )}
                        {i < detail.options.length - 1 && <div style={{ height: 1, background: "#f0f0f0" }} />}
                      </div>
                    ))}
                    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#8a9096", letterSpacing: "0.02em" }}>or, add manually</p>
                      <textarea
                        value={panelMealText}
                        onChange={e => setPanelMealText(e.target.value)}
                        placeholder="What did you eat?"
                        rows={3}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #ffffff", fontSize: "clamp(14px, 3.6vw, 16px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box", background: "#f8f9fa" }}
                      />
                    </div>
                  </div>
                )}
                {isInfo && detail?.type === 'info' && (
                  <div className="pt-4">
                    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{detail.focus}</p>
                    <p style={{ margin: 0, fontSize: 15, color: "#4a5050", lineHeight: 1.7 }}>{detail.text}</p>
                  </div>
                )}
                {isExercise && detail?.type === 'exercise' && (
                  <div className="pt-4">
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{detail.focus}</p>
                    {renderSteps(detail.steps)}
                  </div>
                )}
                {isDrill && (
                  <div className="pt-4">
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1a1c1c" }}>{drillDef.focus}</p>
                    {renderSteps(drillDef.steps)}
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 24px 40px", flexShrink: 0 }}>
                {isComplete ? (
                  <button
                    onClick={panelHandleSchedDone}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 56, borderRadius: 28, border: "2px solid #00D455", background: "transparent", cursor: "pointer" }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#00D455", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#00D455" }}>Done</span>
                  </button>
                ) : (
                  <div
                    ref={schedSwipeTrackRef}
                    style={{ position: "relative", height: 56, borderRadius: 28, background: "#f0f1f3", overflow: "hidden", touchAction: "none" }}
                    onTouchStart={e => { setSchedSwipeX(0); const track = schedSwipeTrackRef.current as (HTMLDivElement & { _startX?: number }) | null; if (track) track._startX = e.touches[0].clientX; }}
                    onTouchMove={e => {
                      const track = schedSwipeTrackRef.current as (HTMLDivElement & { _startX?: number }) | null;
                      if (!track) return;
                      const maxX = track.offsetWidth - 56;
                      const startX = track._startX ?? e.touches[0].clientX;
                      setSchedSwipeX(Math.max(0, Math.min(maxX, e.touches[0].clientX - startX)));
                    }}
                    onTouchEnd={() => {
                      const track = schedSwipeTrackRef.current;
                      if (!track) return;
                      const maxX = track.offsetWidth - 56;
                      if (schedSwipeX >= maxX * 0.82) { panelHandleSchedDone(); }
                      setSchedSwipeX(0);
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: schedSwipeX, background: "#00D455", transition: schedSwipeX === 0 ? "width 0.3s" : "none" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#8a9096", opacity: Math.max(0, 1 - schedSwipeX / 80), transition: "opacity 0.1s" }}>Swipe to complete</span>
                    </div>
                    <div style={{ position: "absolute", top: 4, left: 4 + schedSwipeX, width: 48, height: 48, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: schedSwipeX === 0 ? "left 0.3s" : "none", pointerEvents: "none" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M13 6l6 6-6 6"/></svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Panel nutrition sub-modal */}
      {panelLogSub === "nutrition" && (
        <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setPanelLogSub(null)}>
          <div className="fixed inset-0 bg-black/20" />
          <div className="relative w-full bg-white rounded-t-[24px] shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
            <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <p style={{ fontSize: "clamp(18px, 4.6vw, 22px)", fontWeight: 800, color: "#1a1c1c", margin: 0 }}>Food &amp; Snacks</p>
                <input type="time" value={panelMealTime || nowTimeStr()} onChange={e => setPanelMealTime(e.target.value)} onClick={() => { if (!panelMealTime) setPanelMealTime(nowTimeStr()); }} style={{ padding: "4px 8px", borderRadius: 8, border: "1.5px solid #ffffff", fontSize: "clamp(13px, 3.4vw, 15px)", color: "#6b7480", outline: "none", background: "#f8f9fa" }} />
              </div>
              <button onClick={() => setPanelLogSub(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: "12px 20px 20px" }}>
              <textarea value={panelMealText} onChange={e => setPanelMealText(e.target.value)} placeholder="What are you actually eating?" rows={4} autoFocus style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #ffffff", fontSize: "clamp(16px, 4.1vw, 19px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
              <button onClick={() => panelSaveMealEntry(panelMealTime || nowTimeStr(), panelMealText)} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: panelMealText.trim() ? "#2653d4" : "#ffffff", border: "none", cursor: panelMealText.trim() ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 17px)", fontWeight: 700, color: panelMealText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
              {panelMealsToday.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 16 }}>
                  {panelMealsToday.map(m => (
                    <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: "clamp(11px, 2.8vw, 14px)", fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                      <span style={{ fontSize: "clamp(13px, 3.4vw, 16px)", color: "#6b7480", lineHeight: 1.4 }}>{m.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel note sub-modal */}
      {panelLogSub === "matchreview" && (
        <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setPanelLogSub(null)}>
          <div className="fixed inset-0 bg-black/20" />
          <div className="relative w-full bg-white rounded-t-[24px] shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
            <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "clamp(18px, 4.6vw, 22px)", fontWeight: 800, color: "#1a1c1c", margin: 0 }}>Add a note</p>
              <button onClick={() => setPanelLogSub(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: "12px 20px 20px" }}>
              <textarea value={panelNoteText} onChange={e => setPanelNoteText(e.target.value)} placeholder="What&apos;s on your mind?" rows={4} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #ffffff", fontSize: "clamp(16px, 4.1vw, 19px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
              <button onClick={() => { panelSaveNote(panelNoteText); setPanelLogSub(null); }} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: panelNoteText.trim() ? "#2653d4" : "#ffffff", border: "none", cursor: panelNoteText.trim() ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 17px)", fontWeight: 700, color: panelNoteText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Panel upload-confirm modal */}
      {panelLogSub === "upload-confirm" && panelSmartResult && (() => {
        const { category, label, data } = panelSmartResult;
        const categoryMeta: Record<string, { title: string; color: string }> = {
          match_schedule: { title: "Match schedule", color: "#2653d4" },
          meal:           { title: "Meal detected",  color: "#16a34a" },
          gear:           { title: "Gear identified", color: "#7c3aed" },
          match_result:   { title: "Match result",   color: "#ea580c" },
          unknown:        { title: "Couldn't identify", color: "#8a9096" },
        };
        const meta = categoryMeta[category] ?? categoryMeta.unknown;
        const updateData = (key: string, val: string) =>
          setPanelSmartResult(r => r ? { ...r, data: { ...r.data, [key]: val } } : r);
        const canConfirm = category !== "match_schedule" || (!!data.date && !!data.time);

        const handleConfirm = () => {
          if (category === "match_schedule") {
            const matchData: StoredMatch = { date: data.date ?? "", time: data.time ?? "", club: data.club ?? "", court: data.court ?? "", player_1: data.player_1 ?? "", player_2: data.player_2 ?? "", player_3: data.player_3 ?? "", player_4: data.player_4 ?? "" };
            panelSaveMatchListLocal([...panelGetMatchList(), matchData]);
            saveUpcomingMatch(matchData);
            window.dispatchEvent(new CustomEvent("padelop:match-added", { detail: matchData }));
          } else if (category === "meal") {
            panelSaveMealEntry(nowTimeStr(), data.description ?? label);
          } else if (category === "match_result") {
            const entry = { ts: new Date().toISOString(), feeling: "", result: data.result ?? "", opponent: data.opponent_names ?? "", energy: "", wellDone: [] as string[], improved: [] as string[] };
            const prev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
            localStorage.setItem("padelop:match-reviews", JSON.stringify([entry, ...prev].slice(0, 50)));
            window.dispatchEvent(new Event("storage"));
            saveMatchReview({ ts: entry.ts, result: entry.result, opponentNames: entry.opponent });
          } else if (category === "gear") {
            saveGearToDb({ type: data.type || "other", name: data.name || data.brand || "" });
          }
          setPanelLogSub(null); setPanelSmartResult(null);
        };

        const handleEditManually = () => {
          if (category === "meal") {
            setPanelMealText(data.description ?? label); setPanelLogSub("nutrition"); setPanelSmartResult(null);
          } else {
            setPanelLogSub(null); setPanelSmartResult(null);
          }
        };

        return (
          <div className="fixed inset-0 z-[300] flex items-end" onClick={() => { setPanelLogSub(null); setPanelSmartResult(null); }}>
            <div className="fixed inset-0 bg-black/20" />
            <div className="relative w-full bg-white rounded-t-[24px] shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)", maxHeight: "82vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
              <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => setPanelUploadCatPickerOpen(o => !o)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: meta.color + "18", border: "none", cursor: "pointer", marginBottom: 6 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{meta.title}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.15s", transform: panelUploadCatPickerOpen ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {panelUploadCatPickerOpen && (() => {
                    const emptyData: Record<string, Record<string, string>> = {
                      match_schedule: { date: "", time: "", club: "", court: "", player_1: "", player_2: "", player_3: "", player_4: "" },
                      meal:           { description: "", meal_type: "" },
                      gear:           { type: "", brand: "", name: "" },
                      match_result:   { result: "", score: "", opponent_names: "" },
                    };
                    const options = [
                      { key: "match_schedule", title: "Match schedule", color: "#2653d4" },
                      { key: "meal",           title: "Meal",           color: "#16a34a" },
                      { key: "gear",           title: "Gear",           color: "#7c3aed" },
                      { key: "match_result",   title: "Match result",   color: "#ea580c" },
                    ];
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {options.map(opt => (
                          <button key={opt.key} onClick={() => { setPanelSmartResult(r => r ? { ...r, category: opt.key, data: emptyData[opt.key] ?? {} } : r); setPanelUploadCatPickerOpen(false); }} style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${opt.key === category ? opt.color : "#ffffff"}`, background: opt.key === category ? opt.color + "18" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: opt.key === category ? opt.color : "#6b7480" }}>
                            {opt.title}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  <p style={{ fontSize: "clamp(15px, 3.9vw, 18px)", fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1.3 }}>{label}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginTop: 2 }}>
                  <button onClick={() => { setPanelUploadCategory(category); panelUploadRef.current?.click(); }} disabled={panelUploadLoading} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: panelUploadLoading ? 0.5 : 1 }}>
                    {panelUploadLoading ? (
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    )}
                  </button>
                  <button onClick={() => { setPanelLogSub(null); setPanelSmartResult(null); }} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
              <div style={{ padding: "12px 20px 4px" }}>
                {category === "match_schedule" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={panelLabelSt}>Date</label>
                        <div style={{ position: "relative" }}>
                          <div style={{ ...panelInputSt, color: data.date ? "#1a1c1c" : "#b0b5ba", minHeight: 38, display: "flex", alignItems: "center" }}>{data.date ? new Date(data.date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Pick date"}</div>
                          <input type="date" value={data.date ?? ""} onChange={e => updateData("date", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%" }} />
                        </div>
                      </div>
                      <div>
                        <label style={panelLabelSt}>Time</label>
                        <div style={{ position: "relative" }}>
                          <div style={{ ...panelInputSt, color: data.time ? "#1a1c1c" : "#b0b5ba", minHeight: 38, display: "flex", alignItems: "center" }}>{data.time || "Pick time"}</div>
                          <input type="time" value={data.time ?? ""} onChange={e => updateData("time", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%" }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={panelLabelSt}>Club</label><input type="text" value={data.club ?? ""} onChange={e => updateData("club", e.target.value)} style={panelInputSt} placeholder="Club name" /></div>
                      <div><label style={panelLabelSt}>Court</label><input type="text" value={data.court ?? ""} onChange={e => updateData("court", e.target.value)} style={panelInputSt} placeholder="Court #" /></div>
                    </div>
                    <div>
                      <label style={panelLabelSt}>Players</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(["player_1","player_2","player_3","player_4"] as const).map((k, i) => (
                          <input key={k} type="text" value={data[k] ?? ""} onChange={e => updateData(k, e.target.value)} style={panelInputSt} placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {category === "meal" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={panelLabelSt}>What you ate</label>
                      <textarea value={data.description ?? ""} onChange={e => updateData("description", e.target.value)} rows={3} style={{ ...panelInputSt, resize: "none", lineHeight: 1.5 }} />
                    </div>
                    <div>
                      <label style={panelLabelSt}>Meal type</label>
                      <select value={data.meal_type ?? ""} onChange={e => updateData("meal_type", e.target.value)} style={panelInputSt}>
                        <option value="">Select…</option>
                        {["breakfast","lunch","dinner","snack","pre-match","post-match"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {category === "gear" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={panelLabelSt}>Type</label>
                      <select value={data.type ?? ""} onChange={e => updateData("type", e.target.value)} style={panelInputSt}>
                        <option value="">Select…</option>
                        {["racket","shoes","bag","other"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div><label style={panelLabelSt}>Brand</label><input type="text" value={data.brand ?? ""} onChange={e => updateData("brand", e.target.value)} style={panelInputSt} placeholder="Brand name" /></div>
                    <div><label style={panelLabelSt}>Name / Model</label><input type="text" value={data.name ?? ""} onChange={e => updateData("name", e.target.value)} style={panelInputSt} placeholder="Model or description" /></div>
                  </div>
                )}
                {category === "match_result" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={panelLabelSt}>Result</label>
                      <select value={data.result ?? ""} onChange={e => updateData("result", e.target.value)} style={panelInputSt}>
                        <option value="">Select…</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="draw">Draw</option>
                      </select>
                    </div>
                    <div><label style={panelLabelSt}>Score</label><input type="text" value={data.score ?? ""} onChange={e => updateData("score", e.target.value)} style={panelInputSt} placeholder="e.g. 6-3, 7-5" /></div>
                    <div><label style={panelLabelSt}>Opponents</label><input type="text" value={data.opponent_names ?? ""} onChange={e => updateData("opponent_names", e.target.value)} style={panelInputSt} placeholder="Opponent names" /></div>
                  </div>
                )}
                {category === "unknown" && (
                  <p style={{ fontSize: "clamp(14px, 3.6vw, 16px)", color: "#6b7480", lineHeight: 1.5, margin: 0 }}>
                    We couldn&apos;t identify a category for this image. Try uploading a match schedule screenshot, a meal photo, gear, or a match result scoreboard.
                  </p>
                )}
              </div>
              <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {category !== "unknown" && (
                  <button onClick={handleConfirm} disabled={!canConfirm} style={{ padding: "13px 20px", borderRadius: 999, background: canConfirm ? meta.color : "#ffffff", border: "none", cursor: canConfirm ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 16px)", fontWeight: 700, color: canConfirm ? "#fff" : "#b0b8c1", width: "100%" }}>
                    {category === "match_schedule" ? "Save match" : category === "meal" ? "Log meal" : category === "match_result" ? "Save result" : "Save"}
                  </button>
                )}
                {category !== "gear" && (
                  <button onClick={handleEditManually} style={{ padding: "10px 20px", borderRadius: 999, background: "none", border: "1.5px solid #ffffff", cursor: "pointer", fontSize: "clamp(13px, 3.4vw, 15px)", fontWeight: 600, color: "#6b7480", width: "100%" }}>
                    {category === "unknown" ? "Enter manually" : "Edit manually"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <LogSheet open={logSheetOpen} onClose={() => {
        setLogSheetOpen(false);
        setLogTab(null);
        loadAll();
      }} defaultSub={logTab ?? undefined} />

    </div>

    {navLoading === "settings" && (
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(242,243,245,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(0,212,85,0.25)", borderTopColor: "#00D455", animation: "spin 0.8s linear infinite" }} />
      </div>
    )}
</>
  );
}
