"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveGearToDb, uploadGearImageToStorage, deleteGearImageFromStorage, saveProfileToDb, saveNutritionInsightToDb, saveUpcomingMatch, saveScheduleDoneToDb, saveScoreSnapshotToDb, saveNutritionToDb, saveNoteToDb, saveMatchReview } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import LogSheet from "@/components/log-sheet";
import AvatarCropModal from "@/components/avatar-crop-modal";
import { hydrateFromSupabase } from "@/lib/sync";
import { analyzeMeals, compareMealsToSchedule, foodGrade, loadFoodHistory, type MealEntry } from "@/lib/food-scoring";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates, computeMatchReadiness, loadMorningLog, improveTips, buildInsightParagraph,
  type MatchReadinessResult,
  type Scores, type ScoreSnapshot, type ReviewEntry, type PillarStates, type PillarStatus,
  type HydrationEntry, type NutritionEntry, type HabitsEntry,
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
  const [saved, setSaved]     = useState(false);

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
  const [schedule, setSchedule] = useState<ReturnType<typeof getScheduleData>["schedule"]>([]);
  const [schedCurrentIdx, setSchedCurrentIdx] = useState(0);
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [schedMatchTime, setSchedMatchTime] = useState<string | null>(null);
  const [schedModalIdx, setSchedModalIdx] = useState<number | null>(null);
  const [schedModalClosing, setSchedModalClosing] = useState(false);
  const [profileDetailOpen, setProfileDetailOpen] = useState(false);

  // Panel state (inline action panel below profile card)
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [panelSchedOpen, setPanelSchedOpen] = useState(false);
  const [dayTypeInfoOpen, setDayTypeInfoOpen] = useState(false);
  const [streakPanelOpen, setStreakPanelOpen] = useState(false);
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
    dayType === "match"     ? "Match Day" :
    dayType === "pre-match" ? "Pre-Match Day" :
    dayType === "recovery"  ? "Recovery Day" :
    dayType === "maintenance" ? "Maintenance Day" :
    dayType === "training"  ? "Training Day" : "Today";
  const panelDayColor =
    dayType === "match"     ? "#2653d4" :
    dayType === "pre-match" ? "#d97706" :
    dayType === "recovery"  ? "#7c3aed" :
    dayType === "maintenance" ? "#0e7490" : "#16a34a";
  const panelInputSt: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e8eaed", fontSize: "clamp(14px, 3.6vw, 16px)", color: "#1a1c1c", outline: "none", fontFamily: "inherit", background: "#f8f9fa", boxSizing: "border-box" };
  const panelLabelSt: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096", marginBottom: 4, display: "block" };

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
    try { const ml = JSON.parse(localStorage.getItem("padelop:morning-log") || "null"); setCheckinDone(ml?.date === todayStr); } catch {}
    // Food quality
    try {
      const allMeals: MealEntry[] = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
      setTodayMeals(allMeals.filter(m => m.date === todayStr));
      setFoodHistory(loadFoodHistory(7));
    } catch {}
  }

  useEffect(() => {
    loadAll();
    hydrateFromSupabase().then(result => {
      if (result) { setGameDays(result.gameDays); setUpcomingMatches(result.upcoming as StoredMatch[]); setNextMatch(result.nextMatch as StoredMatch | null); }
    });
    window.addEventListener("storage", loadAll);
    window.addEventListener("padelop:sync-done", loadAll);
    let lastSync = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 5_000) {
        lastSync = Date.now();
        hydrateFromSupabase().then(result => {
          if (result) { setGameDays(result.gameDays); setUpcomingMatches(result.upcoming as StoredMatch[]); setNextMatch(result.nextMatch as StoredMatch | null); }
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
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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

  const setField = (k: keyof Profile, v: string) => { setSaved(false); setProfile(p => ({ ...p, [k]: v })); };
  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const saveAvatar = (croppedDataUrl: string) => {
    setCropSrc(null);
    resizeImage(croppedDataUrl, 320, 0.80).then(resized => {
      setField("avatar", resized);
      const updated = { ...profile, avatar: resized };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      saveProfileToDb({ display_name: updated.name, avatar_url: resized });
      setSaved(true);
    }).catch(() => {
      setField("avatar", croppedDataUrl);
      const updated = { ...profile, avatar: croppedDataUrl };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      saveProfileToDb({ display_name: updated.name, avatar_url: croppedDataUrl });
      setSaved(true);
    });
  };
  const save = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("storage"));
    saveProfileToDb({
      display_name:  profile.name,
      dominant_hand: profile.hand         || undefined,
      play_level:    profile.level        || undefined,
      position:      profile.position     || undefined,
      playing_since: profile.playingSince || undefined,
    });
    setSaved(true);
  };
  const canSave = profile.name.trim().length > 0;

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
    dayType === "match"     ? "Match Day" :
    dayType === "pre-match" ? "Pre-Match Day" :
    dayType === "recovery"  ? "Recovery Day" :
    dayType === "maintenance" ? "Maintenance Day" :
    dayType === "training"  ? "Training Day" : "Today";
  const dayColor =
    dayType === "match"     ? "#2653d4" :
    dayType === "pre-match" ? "#d97706" :
    dayType === "recovery"  ? "#7c3aed" :
    dayType === "maintenance" ? "#0e7490" : "#16a34a";

  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [schedSwipeX, setSchedSwipeX] = useState(0);
  const schedSwipeTrackRef = useRef<HTMLDivElement>(null);

  function onSwipeStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }

  function onSwipeEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
    if (dx < -80) { router.push("/home8"); return; }
  }

  return (
    <div className="w-full pb-20" style={{ background: "#fff" }} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.push("/home8")}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <h1 className="t-heading" style={{ color: "var(--c-text)", margin: 0, flex: 1 }}>Profile</h1>
            <button
              onClick={() => router.push("/settings")}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>

          {/* Profile card */}
          <div style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => setProfileTabEditOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left" }}
            >
              {/* Photo */}
              <div style={{ flexShrink: 0, width: 62, height: 62, borderRadius: "50%", background: "var(--c-blue)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "3px solid #00D455" }}>
                {profile.avatar
                  ? <img src={profile.avatar} alt="avatar" style={{ width: 62, height: 62, objectFit: "cover", objectPosition: "center", display: "block", flexShrink: 0 }} />
                  : <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{initials(profile.name)}</span>
                }
              </div>
              {/* Identity */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1c1c", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{profile.name || "Your name"}</p>
                {(profile.position || profile.level) && (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                    {[profile.position, profile.level].filter(Boolean).join(" · ")}
                  </p>
                )}
                {(profile.playingSince || profile.hand) && (
                  <p style={{ margin: 0, fontSize: 12, color: "#9aa0a6", fontWeight: 400 }}>
                    {[profile.playingSince ? `Since ${profile.playingSince}` : null, profile.hand ? `${profile.hand}-handed` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </button>
            {profileTabEditOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <label htmlFor="avatar-upload2" className="cursor-pointer flex items-center gap-3 active:opacity-70 transition-opacity">
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </div>
                  <span className="t-ui" style={{ color: "var(--c-blue)" }}>Change Photo</span>
                  <input id="avatar-upload2" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
                </label>
                <div>
                  <p className="t-label text-c-hint mb-2">Your name</p>
                  <input type="text" value={profile.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Eddie"
                    className="t-ui w-full px-4 py-3 rounded-2xl border-2 border-c-line text-c-text outline-none focus:border-c-blue transition-colors bg-c-bg-input focus:bg-white" />
                </div>
                <div>
                  <p className="t-label text-c-hint mb-2">Playing since</p>
                  <select value={profile.playingSince} onChange={e => setField("playingSince", e.target.value)}
                    className="t-ui w-full px-4 py-3 rounded-2xl border-2 border-c-line text-c-text outline-none focus:border-c-blue transition-colors bg-c-bg-input focus:bg-white">
                    <option value="">Select year</option>
                    {Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <p className="t-label text-c-hint">Padel level</p>
                    <span className="t-heading" style={{ color: profile.level ? "var(--c-blue)" : "var(--c-disabled)", lineHeight: 1 }}>{profile.level || "—"}</span>
                  </div>
                  <input type="range" min={0} max={LEVELS.length - 1} step={1}
                    value={LEVELS.indexOf(profile.level) >= 0 ? LEVELS.indexOf(profile.level) : 0}
                    onChange={e => setField("level", LEVELS[parseInt(e.target.value)])}
                    className="w-full" style={{ accentColor: "var(--c-blue)", height: 4, cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span className="t-tag font-medium" style={{ color: "#b0b8c1" }}>1.0</span>
                    <span className="t-tag font-medium" style={{ color: "#b0b8c1" }}>5.0</span>
                  </div>
                </div>
                <div>
                  <p className="t-label text-c-hint mb-2">Preferred position</p>
                  <div className="flex gap-2">
                    {POSITIONS.map(pos => {
                      const sel = profile.position === pos;
                      return (
                        <button key={pos} onClick={() => setField("position", pos)}
                          className="t-caption flex-1 py-2 rounded-xl border-2 font-bold transition-all active:scale-95"
                          style={{ borderColor: sel ? "var(--c-blue)" : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? "var(--c-blue)" : "var(--c-text-sub)" }}>
                          {pos}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="t-label text-c-hint mb-2">Dominant hand</p>
                  <div className="flex gap-2">
                    {HANDS.map(h => {
                      const sel = profile.hand === h;
                      return (
                        <button key={h} onClick={() => setField("hand", h)}
                          className="t-body-sm flex-1 py-2 rounded-xl border-2 font-bold transition-all active:scale-95"
                          style={{ borderColor: sel ? "var(--c-blue)" : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? "var(--c-blue)" : "var(--c-text-sub)" }}>
                          {h}-handed
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button disabled={!canSave} onClick={() => { save(); setProfileTabEditOpen(false); }}
                  className="t-ui w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
                  style={{ background: saved ? "var(--c-green)" : canSave ? "var(--c-blue)" : "var(--c-line)", color: canSave ? "#fff" : "#b0b3b3" }}>
                  {saved ? "Saved ✓" : "Save profile"}
                </button>
              </div>
            )}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {total > 0 && (
                    <>
                    {/* Three tiles */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {/* Left tile — Day type (circle, SVG) */}
                      <button
                        onClick={() => { setDayTypeInfoOpen(o => !o); setPanelSchedOpen(false); setStreakPanelOpen(false); }}
                        style={{ flex: 1, aspectRatio: "1/1", background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "block" }}
                      >
                        {(() => {
                          const parts = panelDayLabel.split(" ");
                          const mainLabel = parts.length > 1 ? parts.slice(0, -1).join(" ") : panelDayLabel;
                          const dayWord = parts.length > 1 ? parts[parts.length - 1] : "";
                          return (
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.08))", display: "block" }}>
                              <defs>
                                <path id="dayTypeTopArc" d="M 30,76 A 76,76 0 0,1 170,76" />
                              </defs>
                              <circle cx="100" cy="100" r="99" fill="white" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: panelDayColor, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                <textPath href="#dayTypeTopArc" startOffset="50%" textAnchor="middle">DAY TYPE</textPath>
                              </text>
                              <text
                                x="100" y={dayWord ? "93" : "108"}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="24"
                                fontWeight="800"
                                style={{ fill: panelDayColor, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
                              >
                                {mainLabel}
                              </text>
                              {dayWord && (
                                <text
                                  x="100" y="123"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize="20"
                                  fontWeight="800"
                                  style={{ fill: panelDayColor, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
                                >
                                  {dayWord}
                                </text>
                              )}
                              <circle cx="100" cy="188" r="4" fill={panelDayColor} opacity={dayTypeInfoOpen ? "0.9" : "0.35"} style={{ transition: "opacity 0.2s" }} />
                            </svg>
                          );
                        })()}
                      </button>

                      {/* Right tile — Today's Goals (circle, SVG) */}
                      <button
                        onClick={() => { setPanelSchedOpen(o => !o); setDayTypeInfoOpen(false); setStreakPanelOpen(false); }}
                        style={{ flex: 1, aspectRatio: "1/1", background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "block" }}
                      >
                        <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.08))", display: "block" }}>
                          <defs>
                            <path id="goalsTextArc" d="M 30,76 A 76,76 0 0,1 170,76" />
                          </defs>
                          <circle cx="100" cy="100" r="99" fill="white" />
                          <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: "var(--c-label)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                            <textPath href="#goalsTextArc" startOffset="50%" textAnchor="middle">TODAY&apos;S GOALS</textPath>
                          </text>
                          <text
                            x="100" y="108"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={pct === 100 ? "44" : "36"}
                            fontWeight="800"
                            style={{ fill: pct === 100 ? "#00D455" : "var(--c-text)", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
                          >
                            {pct === 100 ? "✓" : `${done}/${total}`}
                          </text>
                          {(() => {
                            const r = 88, cX = 100, cY = 100, totalDeg = 110;
                            const startDeg = 90 + totalDeg / 2;
                            const N = schedule.length;
                            if (!N) return null;
                            const gapDeg = 7;
                            const segDeg = (totalDeg - Math.max(0, N - 1) * gapDeg) / N;
                            const toRad = (d: number) => d * Math.PI / 180;
                            return schedule.map((item, i) => {
                              const a1 = startDeg - i * (segDeg + gapDeg);
                              const a2 = a1 - segDeg;
                              const x1 = (cX + r * Math.cos(toRad(a1))).toFixed(2);
                              const y1 = (cY + r * Math.sin(toRad(a1))).toFixed(2);
                              const x2 = (cX + r * Math.cos(toRad(a2))).toFixed(2);
                              const y2 = (cY + r * Math.sin(toRad(a2))).toFixed(2);
                              const segDone = todayDoneSet.has(item.title);
                              return (
                                <path
                                  key={item.title}
                                  d={`M ${x1},${y1} A ${r},${r} 0 0,0 ${x2},${y2}`}
                                  stroke={segDone ? item.color : "#e0e2e5"}
                                  strokeWidth="9"
                                  fill="none"
                                  strokeLinecap="round"
                                  style={{ transition: "stroke 0.3s" }}
                                />
                              );
                            });
                          })()}
                        </svg>
                      </button>

                      {/* Third tile — Streak (circle, SVG) */}
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
                        const snext = STIERS[STIERS.indexOf(stier) + 1];
                        const botText = streak === 0 ? "Start logging" : !snext ? "Legend" : `${snext.min - streak}d to ${snext.label}`;
                        return (
                          <button
                            onClick={() => { setStreakPanelOpen(o => !o); setDayTypeInfoOpen(false); setPanelSchedOpen(false); }}
                            style={{ flex: 1, aspectRatio: "1/1", background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "block" }}
                          >
                            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.08))", display: "block" }}>
                              <defs>
                                <path id="streakTopArc" d="M 30,76 A 76,76 0 0,1 170,76" />
                              </defs>
                              <circle cx="100" cy="100" r="99" fill="white" />
                              <text fontSize="22" fontWeight="700" letterSpacing="0.03em" style={{ fill: stier.color, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
                                <textPath href="#streakTopArc" startOffset="50%" textAnchor="middle">{stier.label.toUpperCase()}</textPath>
                              </text>
                              <text
                                x="100" y="108"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={streak >= 100 ? "34" : streak >= 10 ? "40" : "46"}
                                fontWeight="800"
                                style={{ fill: stier.color, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
                              >
                                {streak > 0 ? streak : "—"}
                              </text>
                              <text
                                x="100" y="152"
                                textAnchor="middle"
                                fontSize="20"
                                fontWeight="600"
                                style={{ fill: stier.color, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", opacity: 0.65 } as React.CSSProperties}
                              >
                                day streak
                              </text>
                            </svg>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Expandable: day type info */}
                    <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", display: dayTypeInfoOpen ? "block" : "none" }}>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 7 }}>
                        {DAY_TYPE_INFO.map(dt => (
                          <div key={dt.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: dt.color, background: `${dt.color}18`, borderRadius: 5, padding: "1px 6px", flexShrink: 0, whiteSpace: "nowrap", minWidth: 108, textAlign: "center", display: "inline-block" }}>{dt.label}</span>
                            <span style={{ fontSize: 14, color: "#5a6270", lineHeight: 1.4 }}>{dt.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expandable: schedule list */}
                    {/* Expandable: streak tiers */}
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
                        <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                          <div style={{ background: `linear-gradient(145deg, ${stier.grad[0]}, ${stier.grad[1]})`, padding: "20px 20px 16px", textAlign: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: stier.color }}>{stier.label}</span>
                            <p style={{ margin: "6px 0 3px", fontSize: 44, fontWeight: 800, color: stier.color, lineHeight: 1 }}>{streak}</p>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: stier.color, opacity: 0.7 }}>day streak</p>
                            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 500, color: "#4b5563" }}>{msg}</p>
                          </div>
                          <div style={{ background: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                            {STIERS.map(t => {
                              const active = t.label === stier.label;
                              const unlocked = streak >= t.min;
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
                      );
                    })()}

                    {panelSchedOpen && (
                      <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px 8px" }}>
                          {schedule.map((item, i) => {
                            const isDone = (schedDone[todayKey] ?? []).includes(item.title);
                            return (
                              <div
                                key={item.title}
                                onClick={() => { if (SCHEDULE_DETAILS[item.title] || item.isDrill) setPanelSchedModalIdx(i); }}
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: SCHEDULE_DETAILS[item.title] || item.isDrill ? "pointer" : "default", borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f6" : "none" }}
                              >
                                <button
                                  onClick={e => { e.stopPropagation(); panelToggleDone(item.title); }}
                                  style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isDone ? item.color : "#d0d4da"}`, background: isDone ? item.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", cursor: "pointer" }}
                                >
                                  {isDone && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: isDone ? "#9aa0a6" : "#1a1c1c", textDecoration: isDone ? "line-through" : "none" }}>{item.title}</p>
                                </div>
                                <span style={{ fontSize: 13, color: "#b0b8c1", fontWeight: 500, flexShrink: 0 }}>{item.time}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </>
                  )}
                </div>
                );
              })()}

          {/* Featured Insights */}
          {(() => {
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

            if (pool.length === 0) return null;
            const idx = featuredIdx % pool.length;
            const insight = pool[idx];
            return (
              <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <p style={{ margin: 0, padding: "14px 16px 0", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-label)" }}>Featured Insights</p>
                <button
                  onClick={() => setFeaturedIdx(i => (i + 1) % pool.length)}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 16px 16px", cursor: "pointer", textAlign: "left" }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-blue)" }}>{insight.label}</p>
                  <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 500, color: "#2c3235", lineHeight: 1.65 }}>{insight.body}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {pool.map((_, i) => (
                        <div key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, background: i === idx ? "var(--c-blue)" : "#e2e5ea", transition: "width 0.2s" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--c-hint)", fontWeight: 500 }}>Tap for next</span>
                  </div>
                </button>
              </div>
            );
          })()}


          {/* Info section */}
          <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)" }}>My Stats & Gear</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div style={{ overflow: "hidden", maxHeight: profileOpen ? 9999 : 0, transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
            <div style={{ borderTop: "1px solid #f0f0f0" }}>
            <div style={{ background: "#fff", overflow: "hidden" }}>

              {/* Gear row */}
              <button
                onClick={() => { setProfileGearOpen(o => !o); setProfileInsightsOpen(false); setProfileMatchesOpen(false); setProfileCardOpen(false); }}
                style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "var(--c-text-dim)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </span>
                  <span className="t-ui" style={{ color: "var(--c-text)" }}>Gear</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: profileGearOpen ? "rotate(90deg)" : "rotate(0deg)" }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              {profileGearOpen && (
                <div style={{ borderTop: "1px solid #f4f4f6" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
                    <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>My Gear</p>
                    <button onClick={() => setGearEditOpen(o => !o)} className="t-caption" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 500, color: "var(--c-forest)" }}>{gearEditOpen ? "Done" : "Edit"}</button>
                  </div>
                  <div ref={racketRowRef} style={{ display: "flex", alignItems: "stretch", padding: 12, gap: 14 }}>
                    <div style={{ position: "relative", flexShrink: 0, width: racketSlotSize, height: racketSlotSize }}>
                      <label htmlFor="racket-img-upload" style={{ cursor: "pointer", display: "block", width: "100%", height: "100%" }}>
                        <div style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", background: "#f4f4f6", border: racketImage ? "none" : "1.5px dashed #dde0e4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {racketImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={racketImage} alt="Racket" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c4c7cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          )}
                        </div>
                      </label>
                      {racketImage && (
                        <button onClick={() => { setRacketImage(""); const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}"); delete g.racketImage; localStorage.setItem("padelop:gear", JSON.stringify(g)); deleteGearImageFromStorage("racket"); }} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                    <input id="racket-img-upload" type="file" accept="image/*" className="hidden" onChange={handleRacketImage} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 0" }}>
                      <span className="t-label" style={{ color: "var(--c-label)", display: "block", marginBottom: "8px" }}>Current Racket</span>
                      <p className="t-title" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1.2 }}>{racketName || "—"}</p>
                      <p className="t-body" style={{ color: "var(--c-text-dim)", margin: "4px 0 0" }}>{racketType || "Add a description"}</p>
                      <p className="t-caption" style={{ color: racketSince ? "var(--c-hint)" : "var(--c-disabled)", margin: "6px 0 0" }}>
                        {racketSince ? `Using since ${new Date(racketSince + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "Using since —"}
                      </p>
                    </div>
                  </div>
                  {gearEditOpen && (
                    <div style={{ borderTop: "1px solid #f0f0f0", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 0 6px" }}>Racket name</p>
                        <input type="text" value={racketName} onChange={e => setRacketName(e.target.value)} placeholder="e.g. Bullpadel Vertex" className="t-body"
                          style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "2px solid #e2e2e2", fontWeight: 500, color: "var(--c-text)", outline: "none", background: "var(--c-bg-input)" }} />
                      </div>
                      <div>
                        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 0 6px" }}>Type / description</p>
                        <input type="text" value={racketType} onChange={e => setRacketType(e.target.value)} placeholder="e.g. Control, Power, Hybrid" className="t-body"
                          style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "2px solid #e2e2e2", fontWeight: 500, color: "var(--c-text)", outline: "none", background: "var(--c-bg-input)" }} />
                      </div>
                      <div>
                        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 0 6px" }}>Using since</p>
                        <input type="month" value={racketSince} onChange={e => setRacketSince(e.target.value)} className="t-body"
                          style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "2px solid #e2e2e2", fontWeight: 500, color: "var(--c-text)", outline: "none", background: "var(--c-bg-input)" }} />
                      </div>
                      <button onClick={() => { localStorage.setItem("padelop:gear", JSON.stringify({ racketName, racketType, racketImage, racketSince })); saveGearToDb({ type: "racket", name: racketName ?? undefined, racket_type: racketType ?? undefined, racket_since: racketSince ?? undefined, photo_url: racketImage?.startsWith("http") ? racketImage : undefined }); setGearEditOpen(false); }}
                        className="t-ui" style={{ padding: "12px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", border: "none", cursor: "pointer", color: "#fff" }}>
                        Save
                      </button>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--c-line)", borderTop: "1px solid var(--c-line)" }}>
                    <div style={{ background: "#fff", padding: "16px", display: "flex", flexDirection: "column" }}>
                      <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 12px" }}>My Shoes</p>
                      <div style={{ position: "relative", flex: 1 }}>
                        <label htmlFor="shoe-img-upload" style={{ cursor: "pointer", display: "block" }}>
                          <div style={{ aspectRatio: "1 / 1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--c-bg)", border: shoeImage ? "none" : "1.5px dashed var(--c-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {shoeImage ? <img src={shoeImage} alt="Shoes" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17h20v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1z"/><path d="M2 17c0-3.5 2.5-6 6-6h2l3-2h3c2.2 0 4 1.5 4.5 3.5L21 17"/></svg>}
                          </div>
                        </label>
                        {shoeImage && (
                          <button onClick={() => { setShoeImage(""); const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}"); delete g.shoeImage; localStorage.setItem("padelop:gear", JSON.stringify(g)); deleteGearImageFromStorage("shoe"); }} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                      <input id="shoe-img-upload" type="file" accept="image/*" className="hidden" onChange={handleShoeImage} />
                    </div>
                    <div style={{ background: "#fff", padding: "16px", display: "flex", flexDirection: "column" }}>
                      <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 12px" }}>My Kit</p>
                      <div style={{ position: "relative", flex: 1 }}>
                        <label htmlFor="kit-img-upload" style={{ cursor: "pointer", display: "block" }}>
                          <div style={{ aspectRatio: "1 / 1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--c-bg)", border: kitImage ? "none" : "1.5px dashed var(--c-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {kitImage ? <img src={kitImage} alt="Kit" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>}
                          </div>
                        </label>
                        {kitImage && (
                          <button onClick={() => { setKitImage(""); const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}"); delete g.kitImage; localStorage.setItem("padelop:gear", JSON.stringify(g)); deleteGearImageFromStorage("kit"); }} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                      <input id="kit-img-upload" type="file" accept="image/*" className="hidden" onChange={handleKitImage} />
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setProfileInsightsOpen(o => !o); setProfileMatchesOpen(false); setProfileCardOpen(false); setProfileGearOpen(false); }}
                style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: "1px solid #f4f4f6", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "var(--c-text-dim)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </span>
                  <span className="t-ui" style={{ color: "var(--c-text)" }}>Insights</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: profileInsightsOpen ? "rotate(90deg)" : "rotate(0deg)" }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              {profileInsightsOpen && (
                <div style={{ borderTop: "1px solid #f4f4f6", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>


                  {/* Padel Journey */}
                  <div style={{ background: "#f8f9fa", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
                    <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Padel Journey</p>
                    {(profile.playingSince || journeyStart) && (
                      <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 16px", fontWeight: 500 }}>
                        Started {profile.playingSince || journeyStart}
                      </p>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { value: reviews.length,           label: "Matches played",       color: "var(--c-blue)",   bg: "#f0f4ff" },
                        { value: trainingSessions.length,   label: "Training sessions",    color: "var(--c-green)",  bg: "var(--c-green-bg)" },
                        { value: partnerCount,              label: "Partners played with", color: "var(--c-teal)",   bg: "#f0fdfd" },
                        { value: tournamentCount,           label: "Tournaments entered",  color: "var(--c-orange)", bg: "#fff7f0" },
                      ].map(({ value, label, color, bg }) => (
                        <div key={label} style={{ background: bg, borderRadius: "var(--r-sm)", padding: "14px 12px" }}>
                          <p className="t-stat" style={{ color, margin: 0, lineHeight: 1 }}>{value}</p>
                          <p className="t-caption" style={{ color, margin: "5px 0 0", fontWeight: 600, opacity: 0.8 }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>


                  {/* Streak */}
                  {(() => {
                    const TIERS = [
                      { min: 0,  label: "Beginner",  color: "#9aa0a6", grad: ["#f4f4f6", "#eaecee"] },
                      { min: 5,  label: "Starter",   color: "#2653d4", grad: ["#eef2ff", "#dbe4ff"] },
                      { min: 15, label: "Grinder",   color: "#059669", grad: ["#ecfdf5", "#d1fae5"] },
                      { min: 30, label: "Dedicated", color: "#d97706", grad: ["#fffbeb", "#fde68a"] },
                      { min: 60, label: "Elite",     color: "#7c3aed", grad: ["#faf5ff", "#ede9fe"] },
                      { min: 100,label: "Legend",    color: "#0ea5e9", grad: ["#f0f9ff", "#bae6fd"] },
                    ];
                    const tier = [...TIERS].reverse().find(t => streak >= t.min) ?? TIERS[0];
                    const nextTier = TIERS[TIERS.indexOf(tier) + 1];
                    const message =
                      streak === 0  ? "Log your first check-in to start your streak." :
                      streak === 1  ? "Day one. Come back tomorrow to keep it going." :
                      !nextTier     ? "Legend status. You're in a league of your own." :
                      `${nextTier.min - streak} day${nextTier.min - streak === 1 ? "" : "s"} to ${nextTier.label}.`;
                    return (
                      <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                        <div style={{ background: `linear-gradient(145deg, ${tier.grad[0]}, ${tier.grad[1]})`, padding: "32px 24px 24px", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: tier.color }}>{tier.label}</span>
                          <p style={{ margin: "8px 0 4px", fontSize: "clamp(56px, 14vw, 72px)", fontWeight: 800, color: tier.color, lineHeight: 1 }}>{streak}</p>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tier.color, opacity: 0.7 }}>day streak</p>
                          <p style={{ margin: "14px 0 0", fontSize: 14, fontWeight: 500, color: "#4b5563", lineHeight: 1.5 }}>{message}</p>
                        </div>
                        <div style={{ background: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                          {TIERS.map((t, i) => {
                            const active = t.label === tier.label;
                            const unlocked = streak >= t.min;
                            return (
                              <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div style={{ width: "100%", height: 3, borderRadius: 99, background: unlocked ? t.color : "#e5e7eb", opacity: unlocked ? 1 : 0.4 }} />
                                <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, color: active ? t.color : "#9aa0a6", textAlign: "center", lineHeight: 1.2, letterSpacing: "0.04em" }}>{t.label}</span>
                                <span style={{ fontSize: 9, color: "#b0b8c1", fontWeight: 500 }}>{t.min === 0 ? "0" : `${t.min}d`}</span>
                                {i < TIERS.length - 1 && <div style={{ position: "absolute" }} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Progress content */}
                  {(() => {
                    const last30Dates = Array.from({ length: 30 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - i);
                      return d.toISOString().slice(0, 10);
                    });
                    const prev30Dates = Array.from({ length: 30 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - 30 - i);
                      return d.toISOString().slice(0, 10);
                    });
                    const scoreHistory: ScoreSnapshot[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:score-history") || "[]"); } catch { return []; } })();
                    const recentScores = scoreHistory.filter(s => last30Dates.includes(s.date));
                    const prevScores   = scoreHistory.filter(s => prev30Dates.includes(s.date));
                    const hydLogs: HydrationEntry[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]"); } catch { return []; } })();
                    const recentHyd = hydLogs.filter(h => last30Dates.includes(h.ts.slice(0, 10)));
                    const prevHyd   = hydLogs.filter(h => prev30Dates.includes(h.ts.slice(0, 10)));
                    const habitsArr: HabitsEntry[] = (() => {
                      try {
                        const raw = localStorage.getItem("padelop:habits");
                        if (!raw) return [];
                        const parsed = JSON.parse(raw);
                        return Array.isArray(parsed) ? parsed : [];
                      } catch { return []; }
                    })();
                    const recentHabits = habitsArr.filter(h => last30Dates.includes(h.date));
                    const prevHabits   = habitsArr.filter(h => prev30Dates.includes(h.date));
                    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
                    const qualNum = (q: string) => q === "great" ? 1 : q === "ok" ? 0.6 : 0.3;
                    const recoveryRate = recentHabits.length > 0 ? recentHabits.filter(h => h.foamRoll || h.lightWalk || h.coldShower).length / recentHabits.length : 0;
                    const mobilityRate = recentHabits.length > 0 ? recentHabits.filter(h => h.mobility).length / recentHabits.length : 0;
                    const hydPct   = recentHyd.length > 0 ? avg(recentHyd.map(h => qualNum(h.quality))) : 0.5;
                    const sleepPct = recentScores.length > 0 ? Math.max(0, avg(recentScores.map(s => (s.recovery - 65) / 35))) : 0.5;
                    const prevHydPct   = prevHyd.length > 0 ? avg(prevHyd.map(h => qualNum(h.quality))) : null;
                    const prevMobRate  = prevHabits.length > 0 ? prevHabits.filter(h => h.mobility).length / prevHabits.length : null;
                    const prevRecRate  = prevHabits.length > 0 ? prevHabits.filter(h => h.foamRoll || h.lightWalk || h.coldShower).length / prevHabits.length : null;
                    const prevSleepPct = prevScores.length > 0 ? Math.max(0, avg(prevScores.map(s => (s.recovery - 65) / 35))) : null;
                    const candidates = [
                      prevHydPct   !== null ? { label: "Hydration consistency", delta: (hydPct       - prevHydPct)  * 100 } : null,
                      prevMobRate  !== null ? { label: "Mobility consistency",   delta: (mobilityRate - prevMobRate) * 100 } : null,
                      prevRecRate  !== null ? { label: "Recovery habits",        delta: (recoveryRate - prevRecRate) * 100 } : null,
                      prevSleepPct !== null ? { label: "Sleep quality",          delta: (sleepPct     - prevSleepPct) * 100 } : null,
                    ].filter((c): c is { label: string; delta: number } => c !== null && c.delta > 0)
                      .sort((a, b) => b.delta - a.delta);
                    const topImprovement = candidates[0] ?? null;
                    return (
                      <>
                        <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
                          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#1a1c1c" }}>Biggest improvement</p>
                          {topImprovement ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 15, fontWeight: 600, color: "#2c3235" }}>{topImprovement.label}</span>
                              <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>+{Math.round(topImprovement.delta)}%</span>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: 13, color: "#b0b8c1", fontWeight: 500 }}>Keep logging to compare your progress week over week.</p>
                          )}
                        </div>
                        <div style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", borderRadius: "var(--r-lg)", padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 16 }}>✦</span>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2653d4" }}>AI observation</p>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: "#6b7480", fontWeight: 500, lineHeight: 1.5 }}>Personalised insights coming soon. Keep logging your check-ins to unlock pattern analysis.</p>
                        </div>
                      </>
                    );
                  })()}

                  {/* Daily Summaries */}
                  {(() => {
                    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().slice(0, 10);
                    function buildSummary(dateStr: string) {
                      let schedItems: ReturnType<typeof getScheduleData>["schedule"] = [];
                      try {
                        const d = loadScoringData();
                        void d;
                        let m: { date: string; time?: string } | null = null;
                        try { m = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
                        const dt = m?.date === dateStr ? "match" : (() => {
                          try {
                            const allR: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
                            const prev = new Date(dateStr); prev.setDate(prev.getDate() - 1);
                            return allR.some(r => r.ts.slice(0, 10) === prev.toISOString().slice(0, 10)) ? "recovery" : "training";
                          } catch { return "training"; }
                        })() as "match" | "recovery" | "training";
                        const tag = getTopNeedsWorkTag();
                        schedItems = getScheduleData(dt, m?.date === dateStr ? (m.time ?? null) : null, tag).schedule;
                      } catch {}
                      const doneTitles = schedDone[dateStr] ?? [];
                      const schedTotal = schedItems.length;
                      const schedDoneCount = schedItems.filter(s => doneTitles.includes(s.title)).length;
                      const schedPct = schedTotal ? Math.round((schedDoneCount / schedTotal) * 100) : null;
                      let meals: MealEntry[] = [];
                      try { meals = (JSON.parse(localStorage.getItem("padelop:meal-log") || "[]") as MealEntry[]).filter(m => m.date === dateStr); } catch {}
                      const snap = deduped.find(s => s.date === dateStr);
                      let matchReview: ReviewEntry | null = null;
                      try { matchReview = (JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[]).find(r => r.ts.slice(0, 10) === dateStr) ?? null; } catch {}
                      return { schedTotal, schedDoneCount, schedPct, meals, snap, matchReview, doneTitles };
                    }
                    const ySummary = buildSummary(yesterdayStr);
                    const hasYData = ySummary.schedTotal > 0 || ySummary.meals.length > 0 || ySummary.snap;
                    if (!hasYData) return null;
                    const pctColor = (p: number | null) => p === null ? "var(--c-hint)" : p >= 75 ? "var(--c-green)" : p >= 40 ? "var(--c-blue)" : "var(--c-red)";
                    const prevDays: string[] = [];
                    for (let i = 2; i <= 9; i++) {
                      const d = new Date(); d.setDate(d.getDate() - i);
                      prevDays.push(d.toISOString().slice(0, 10));
                    }
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>Yesterday&apos;s Summary</p>
                            <span className="t-caption" style={{ color: "var(--c-hint)" }}>{yesterday.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                          </div>
                          {ySummary.schedTotal > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>Schedule</span>
                                <span className="t-body-sm" style={{ fontWeight: 700, color: pctColor(ySummary.schedPct) }}>{ySummary.schedDoneCount}/{ySummary.schedTotal} tasks{ySummary.schedPct !== null ? ` · ${ySummary.schedPct}%` : ""}</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${ySummary.schedPct ?? 0}%`, borderRadius: 99, background: pctColor(ySummary.schedPct), transition: "width 0.4s" }} />
                              </div>
                            </div>
                          )}
                          {ySummary.meals.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>Food</span>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                                {ySummary.meals.map(m => (
                                  <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                                    <span className="t-caption" style={{ color: "var(--c-text-sub)", lineHeight: 1.4 }}>{m.description}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {(ySummary.matchReview || ySummary.snap) && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1, background: "var(--c-green-bg)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                                <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-green)" }}>Went well</p>
                                <p className="t-caption" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                                  {ySummary.matchReview?.wellDone?.[0]
                                    ? ySummary.matchReview.wellDone[0]
                                    : ySummary.snap
                                      ? (() => { const best = (["recovery","training","nutrition","wellbeing"] as const).reduce((a, b) => (ySummary.snap![a] ?? 0) > (ySummary.snap![b] ?? 0) ? a : b); return `${best.charAt(0).toUpperCase() + best.slice(1)} was strong`; })()
                                      : "—"}
                                </p>
                              </div>
                              <div style={{ flex: 1, background: "#fffbeb", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                                <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#d97706" }}>To improve</p>
                                <p className="t-caption" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                                  {ySummary.matchReview?.improved?.[0]
                                    ? ySummary.matchReview.improved[0]
                                    : ySummary.snap
                                      ? (() => {
                                          const pillars = ["recovery","training","nutrition","wellbeing"] as const;
                                          const best = pillars.reduce((a, b) => (ySummary.snap![a] ?? 0) > (ySummary.snap![b] ?? 0) ? a : b);
                                          const others = pillars.filter(p => p !== best);
                                          const worst = others.reduce((a, b) => (ySummary.snap![a] ?? 100) < (ySummary.snap![b] ?? 100) ? a : b);
                                          return `${worst.charAt(0).toUpperCase() + worst.slice(1)} could be better`;
                                        })()
                                      : "—"}
                                </p>
                              </div>
                            </div>
                          )}
                          {prevDays.some(d => schedDone[d]?.length || deduped.find(s => s.date === d)) && (
                            <>
                              <button onClick={() => setPrevDaysOpen(o => !o)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-hint)" }}>Prev days</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-hint)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: prevDaysOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                              </button>
                              {prevDaysOpen && (
                                <div style={{ marginTop: 8 }}>
                                  <PrevDaysList days={prevDays} schedDone={schedDone} deduped={deduped} getScheduleData={getScheduleData} loadScoringData={loadScoringData} getTopNeedsWorkTag={getTopNeedsWorkTag} pctColor={pctColor} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Readiness Status */}
                  {(() => {
                    const r = matchReadiness;
                    const dotColor = !r ? "#eab308" : r.color === "green" ? "#22c55e" : r.color === "yellow" ? "#eab308" : r.color === "orange" ? "#f97316" : "#ef4444";
                    return (
                      <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 11, height: 11, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1c1c" }}>{r?.label ?? "Manage"}</span>
                          {r?.limiter && <span style={{ fontSize: 13, color: "#6b7480", fontWeight: 500 }}>· {r.limiter} is your limiter</span>}
                        </div>
                        {r && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b0b8c1", margin: 0 }}>Today&apos;s adjustments</p>
                            {r.actions.map((a, i) => (
                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <div style={{ width: 4, height: 4, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 7 }} />
                                <span style={{ fontSize: 13, color: "#3a4040", lineHeight: 1.5 }}>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Pillar States */}
                  <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
                    <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Your State Today</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {PILLARS.map(row => {
                        const state = pillarStates[row.key as keyof PillarStates];
                        const meta = STATUS_META[state.status];
                        const sparkData = last14.map(s => s[row.key]);
                        return (
                          <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                <span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>{row.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: meta.bg, color: meta.text }}>{meta.label}</span>
                              </div>
                              <p className="t-caption" style={{ color: "var(--c-text-sub)", margin: 0, lineHeight: 1.3 }}>{state.reason}</p>
                            </div>
                            <Sparkline data={sparkData} color={row.color} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Week Comparison */}
                  {(thisWeekAvg !== null || lastWeekAvg !== null) && (
                    <div style={{ background: "#fff", borderRadius: "var(--r-md)", padding: "12px 16px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span className="t-label" style={{ color: "var(--c-label)" }}>This week</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: "var(--c-blue)", lineHeight: 1 }}>{thisWeekAvg ?? "–"}</span>
                      </div>
                      {thisWeekAvg !== null && lastWeekAvg !== null ? (
                        <span className="t-body-sm" style={{ fontWeight: 700, color: thisWeekAvg >= lastWeekAvg ? "var(--c-green)" : "var(--c-red)" }}>
                          {thisWeekAvg >= lastWeekAvg ? "▲" : "▼"} {Math.abs(thisWeekAvg - lastWeekAvg)} pts vs last week
                        </span>
                      ) : (
                        <span className="t-caption" style={{ color: "var(--c-hint)" }}>last week: {lastWeekAvg ?? "–"}</span>
                      )}
                    </div>
                  )}

                  {/* Strengths & Focus Areas */}
                  {reviews.length > 0 && (() => {
                    const countTags = (tags: string[]) => {
                      const counts: Record<string, number> = {};
                      tags.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
                      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    };
                    const strengths = countTags(reviews.flatMap(r => r.wellDone ?? [])).slice(0, 6);
                    const focusAreas = countTags(reviews.flatMap(r => r.improved ?? [])).slice(0, 6);
                    if (!strengths.length && !focusAreas.length) return null;
                    const maxS = strengths[0]?.[1] ?? 1;
                    const maxF = focusAreas[0]?.[1] ?? 1;
                    return (
                      <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
                        <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Game Profile</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-green)" }}>Strengths</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              {strengths.length ? strengths.map(([tag, count]) => (
                                <div key={tag}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>{tag}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-green)", opacity: 0.7 }}>{count}×</span>
                                  </div>
                                  <div style={{ height: 4, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(count / maxS) * 100}%`, borderRadius: 99, background: "var(--c-green)" }} />
                                  </div>
                                </div>
                              )) : <p className="t-caption" style={{ color: "var(--c-hint)" }}>None logged yet</p>}
                            </div>
                          </div>
                          <div>
                            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-amber)" }}>Focus Areas</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                              {focusAreas.length ? focusAreas.map(([tag, count]) => (
                                <div key={tag}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>{tag}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-amber)", opacity: 0.7 }}>{count}×</span>
                                  </div>
                                  <div style={{ height: 4, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(count / maxF) * 100}%`, borderRadius: 99, background: "var(--c-amber)" }} />
                                  </div>
                                </div>
                              )) : <p className="t-caption" style={{ color: "var(--c-hint)" }}>None logged yet</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Food & Hydration */}
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const viewDate = selectedFoodDate ?? todayStr;
                    const isToday = viewDate === todayStr;
                    const viewMeals: MealEntry[] = (() => {
                      if (isToday) return todayMeals;
                      try {
                        const all: MealEntry[] = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
                        return all.filter(m => m.date === viewDate);
                      } catch { return []; }
                    })();
                    const analysis = analyzeMeals(viewMeals);
                    const displayScore = isToday && aiInsight ? aiInsight.score : analysis.score;
                    const grade = foodGrade(displayScore);
                    const matchToday2 = !!nextMatch && nextMatch.date === todayStr;
                    const matchYesterday2 = (() => {
                      try {
                        const allR: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
                        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                        return allR.some(r => r.ts.slice(0, 10) === yesterday.toISOString().slice(0, 10));
                      } catch { return false; }
                    })();
                    const dayTypeLocal = matchToday2 ? "match" : matchYesterday2 ? "recovery" : "training";
                    const coverage = compareMealsToSchedule(viewMeals, dayTypeLocal);
                    const barMax = Math.max(...foodHistory.map(d => d.score), 1);
                    const dateLabel = isToday ? "Today" : new Date(viewDate + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                    const LITRE_MID: Record<string, number> = { "<1L": 0.75, "1–1.5L": 1.25, "1.5–2L": 1.75, "2–2.5L": 2.25, "2.5–3L": 2.75, "3L+": 3.25 };
                    let hydLogs2: { ts: string; litres: string }[] = [];
                    try { hydLogs2 = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]"); } catch {}
                    const hydAvg2 = (entries: typeof hydLogs2) => {
                      const vals = entries.map(e => LITRE_MID[e.litres]).filter(v => v !== undefined);
                      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
                    };
                    const nowMs = Date.now();
                    const hyd7 = hydAvg2(hydLogs2.filter(e => nowMs - new Date(e.ts).getTime() < 7 * 864e5));
                    const hydColor = (v: string | null) => !v ? "var(--c-hint)" : parseFloat(v) >= 2 ? "var(--c-teal)" : parseFloat(v) >= 1.5 ? "var(--c-blue)" : "var(--c-red)";
                    return (
                      <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                          <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>Food & Hydration</p>
                          <span className="t-caption" style={{ color: isToday ? "var(--c-hint)" : "var(--c-blue)", fontWeight: 600 }}>{dateLabel}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
                          <div style={{ flexShrink: 0 }}>
                            <p className="t-stat" style={{ color: grade.color, margin: 0, lineHeight: 1 }}>{displayScore}</p>
                            <p className="t-tag" style={{ color: grade.color, margin: "4px 0 0", fontWeight: 700 }}>{grade.label}</p>
                          </div>
                          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: 44 }}>
                            {foodHistory.map(({ date, score }) => {
                              const isSelected = date === viewDate;
                              const isT = date === todayStr;
                              const h = barMax > 0 ? Math.max(4, (score / barMax) * 36) : 4;
                              const barColor = isT ? grade.color : score >= 65 ? "#bbf7d0" : score > 0 ? "#fed7aa" : "#f0f0f0";
                              return (
                                <button key={date} onClick={() => setSelectedFoodDate(isSelected && !isT ? null : date)}
                                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 44, background: "none", border: "none", cursor: "pointer", padding: "0 0 4px", gap: 3 }}>
                                  <div style={{ width: "100%", height: h, borderRadius: 3, background: barColor, outline: isSelected ? `2px solid ${barColor === "#f0f0f0" ? "#b0b8c1" : barColor}` : "none", outlineOffset: 2, transition: "height 0.3s" }} />
                                  {isSelected && <div style={{ width: 4, height: 4, borderRadius: "50%", background: barColor === "#f0f0f0" ? "#b0b8c1" : barColor, flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                          {[{ label: "Protein", active: analysis.protein }, { label: "Veg", active: analysis.veg }, { label: "Carbs", active: analysis.carbs }].map(({ label, active }) => (
                            <span key={label} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: active ? "#f0fdf4" : "#f4f4f6", color: active ? "#16a34a" : "#b0b8c1", border: active ? "1px solid #bbf7d0" : "1px solid #e8eaed" }}>
                              {active ? "✓ " : ""}{label}
                            </span>
                          ))}
                        </div>
                        {isToday && aiInsight && (
                          <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#2653d4", marginBottom: 3 }}>AI Assessment</p>
                            <p style={{ margin: 0, fontSize: 13, color: "#2c3235", lineHeight: 1.5 }}>{aiInsight.insight}</p>
                          </div>
                        )}
                        {isToday && !aiInsight && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                            {coverage.map(({ title, covered }) => (
                              <div key={title} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: covered ? "#16a34a" : "#e8eaed", border: covered ? "none" : "1.5px solid #c8cdd3" }} />
                                <span className="t-body-sm" style={{ color: covered ? "var(--c-text)" : "var(--c-hint)", fontWeight: covered ? 600 : 400 }}>{title}</span>
                                {!covered && <span style={{ fontSize: 11, color: "#b0b8c1", marginLeft: "auto" }}>not logged</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {hydLogs2.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #f4f4f6" }}>
                            <span className="t-body-sm" style={{ color: "var(--c-text-sub)", fontWeight: 600 }}>Hydration (7d avg)</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: hydColor(hyd7) }}>{hyd7 ? `${hyd7}L` : "–"}</span>
                          </div>
                        )}
                        <Link href="/shopping-list" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #f4f4f6", textDecoration: "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>Weekly Shopping List</span>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                        </Link>
                      </div>
                    );
                  })()}

                </div>
              )}
              <button
                onClick={() => { setProfileMatchesOpen(o => !o); setProfileInsightsOpen(false); setProfileCardOpen(false); setProfileGearOpen(false); }}
                style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: "1px solid #f4f4f6", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "var(--c-text-dim)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                  </span>
                  <span className="t-ui" style={{ color: "var(--c-text)" }}>Matches</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: profileMatchesOpen ? "rotate(90deg)" : "rotate(0deg)" }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              {profileMatchesOpen && (
                <div style={{ borderTop: "1px solid #f4f4f6", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Add button */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { setMatchAddOpen(o => !o); setMatchExpandedIdx(null); if (!matchAddOpen) setMatchAddForm(EMPTY_FORM); }}
                      style={{ background: matchAddOpen ? "#e8edf8" : "#2653d4", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 14, fontWeight: 700, color: matchAddOpen ? "#2653d4" : "#fff", cursor: "pointer" }}
                    >
                      {matchAddOpen ? "Cancel" : "+ Add"}
                    </button>
                  </div>
                  {matchAddOpen && (
                    <div style={{ background: "#f8f9fa", borderRadius: 20, padding: "18px 16px" }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1c1c" }}>New match</p>
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
                          <div key={idx} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                            <button onClick={() => { setMatchExpandedIdx(expanded ? null : idx); setMatchAddOpen(false); }} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                              <div style={{ flexShrink: 0, width: 48, textAlign: "center", background: isToday2 ? "#eef2ff" : "#f4f6f8", borderRadius: 12, padding: "8px 4px" }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                                <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: isToday2 ? "#2653d4" : "#1a1c1c", lineHeight: 1 }}>{new Date(m.date + "T12:00").getDate()}</p>
                                <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</p>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                  <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1c1c" }}>{m.time || "—"}</span>
                                  {m.club && <span style={{ fontSize: 13, color: "#8a9096", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {m.club}{m.court ? ` #${m.court}` : ""}</span>}
                                </div>
                                {players.length > 0 && <p style={{ margin: 0, fontSize: 12, color: "#8a9096", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{players.join(", ")}</p>}
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
                    <div style={{ background: "#f8f9fa", borderRadius: 20, padding: "32px 20px", textAlign: "center" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
                      </div>
                      <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>No upcoming matches</p>
                      <p style={{ margin: "0 0 18px", fontSize: 14, color: "#8a9096" }}>Schedule your next game</p>
                      <button onClick={() => setMatchAddOpen(true)} style={{ padding: "11px 28px", borderRadius: 999, background: "#2653d4", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Add a match</button>
                    </div>
                  )}
                  {reviews.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      <p style={{ margin: "4px 4px 0", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>HISTORY</p>
                      {[...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).map((r, i) => {
                        const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
                        const resultBg   = r.result === "win" ? "#f0fdf4" : r.result === "loss" ? "#fff5f5" : "#f4f6f8";
                        const opponentNames = typeof (r as ReviewEntry & { opponentNames?: string }).opponentNames === "string" && (r as ReviewEntry & { opponentNames?: string }).opponentNames ? (r as ReviewEntry & { opponentNames?: string }).opponentNames : null;
                        return (
                          <button key={i} onClick={() => setSelectedReview(r)} style={{ width: "100%", background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 12, border: "none", cursor: "pointer", textAlign: "left" }}>
                            <div style={{ flexShrink: 0, width: 44, textAlign: "center", background: "#f4f6f8", borderRadius: 11, padding: "7px 4px" }}>
                              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#8a9096" }}>{new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                              <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 900, color: "#1a1c1c", lineHeight: 1 }}>{new Date(r.ts.slice(0, 10) + "T12:00").getDate()}</p>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {opponentNames ? (
                                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#1a1c1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>vs {opponentNames}</p>
                              ) : (
                                r.feeling && <p style={{ margin: "0 0 2px", fontSize: 13, color: "#8a9096" }}>{r.feeling}</p>
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
              )}

            </div>
            </div>
            </div>
          </div>

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
              style={{ borderRadius: "28px 28px 0 0", maxHeight: "88dvh", animation: "reviewUp 0.32s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -4px 40px rgba(0,0,0,0.18)" }}
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
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-6" style={{ paddingTop: 24, paddingBottom: 24 }} onClick={panelCloseSchedModal}>
            <style>{`@keyframes guideIn{from{transform:scale(0.94);opacity:0}to{transform:scale(1);opacity:1}}@keyframes guideOut{from{transform:scale(1);opacity:1}to{transform:scale(0.94);opacity:0}}`}</style>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: panelSchedModalClosing ? "guideOut 0.2s cubic-bezier(0.4,0,1,1) both" : undefined }} />
            <div
              className="relative w-full bg-white flex flex-col"
              style={{ borderRadius: 28, maxHeight: "85dvh", animation: panelSchedModalClosing ? "guideOut 0.2s cubic-bezier(0.4,0,1,1) both" : "guideIn 0.22s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)", overflow: "hidden" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="overflow-y-auto flex-1 px-6 pb-6" style={{ minHeight: 0 }}>
                <p style={{ margin: "20px 0 4px", fontSize: "clamp(22px, 6.5vw, 30px)", fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15 }}>{item.title}</p>
                {isMeal && detail?.type === 'meal' && (
                  <div className="flex flex-col pt-4">
                    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8a9096" }}>{detail.focus}</p>
                    {detail.options.map((meal, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#1a1c1c", lineHeight: 1.4 }}>{meal.title}</p>
                      </div>
                    ))}
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
                <div style={{ paddingTop: 24 }}>
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
                <input type="time" value={panelMealTime || nowTimeStr()} onChange={e => setPanelMealTime(e.target.value)} onClick={() => { if (!panelMealTime) setPanelMealTime(nowTimeStr()); }} style={{ padding: "4px 8px", borderRadius: 8, border: "1.5px solid #e8eaed", fontSize: "clamp(13px, 3.4vw, 15px)", color: "#6b7480", outline: "none", background: "#f8f9fa" }} />
              </div>
              <button onClick={() => setPanelLogSub(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: "12px 20px 20px" }}>
              <textarea value={panelMealText} onChange={e => setPanelMealText(e.target.value)} placeholder="What are you actually eating?" rows={4} autoFocus style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: "clamp(16px, 4.1vw, 19px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
              <button onClick={() => panelSaveMealEntry(panelMealTime || nowTimeStr(), panelMealText)} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: panelMealText.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: panelMealText.trim() ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 17px)", fontWeight: 700, color: panelMealText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
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
              <textarea value={panelNoteText} onChange={e => setPanelNoteText(e.target.value)} placeholder="What&apos;s on your mind?" rows={4} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: "clamp(16px, 4.1vw, 19px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
              <button onClick={() => { panelSaveNote(panelNoteText); setPanelLogSub(null); }} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: panelNoteText.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: panelNoteText.trim() ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 17px)", fontWeight: 700, color: panelNoteText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
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
                          <button key={opt.key} onClick={() => { setPanelSmartResult(r => r ? { ...r, category: opt.key, data: emptyData[opt.key] ?? {} } : r); setPanelUploadCatPickerOpen(false); }} style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${opt.key === category ? opt.color : "#e8eaed"}`, background: opt.key === category ? opt.color + "18" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: opt.key === category ? opt.color : "#6b7480" }}>
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
                  <button onClick={handleConfirm} disabled={!canConfirm} style={{ padding: "13px 20px", borderRadius: 999, background: canConfirm ? meta.color : "#e8eaed", border: "none", cursor: canConfirm ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 16px)", fontWeight: 700, color: canConfirm ? "#fff" : "#b0b8c1", width: "100%" }}>
                    {category === "match_schedule" ? "Save match" : category === "meal" ? "Log meal" : category === "match_result" ? "Save result" : "Save"}
                  </button>
                )}
                {category !== "gear" && (
                  <button onClick={handleEditManually} style={{ padding: "10px 20px", borderRadius: 999, background: "none", border: "1.5px solid #e8eaed", cursor: "pointer", fontSize: "clamp(13px, 3.4vw, 15px)", fontWeight: 600, color: "#6b7480", width: "100%" }}>
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

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onSave={saveAvatar}
          onClose={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
