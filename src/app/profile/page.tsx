"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveGearToDb, saveProfileToDb, saveNutritionInsightToDb, saveUpcomingMatch } from "@/lib/db";
import LogSheet from "@/components/log-sheet";
import AvatarCropModal from "@/components/avatar-crop-modal";
import { hydrateFromSupabase } from "@/lib/sync";
import { analyzeMeals, compareMealsToSchedule, foodGrade, loadFoodHistory, type MealEntry } from "@/lib/food-scoring";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates,
  type Scores, type ScoreSnapshot, type ReviewEntry, type PillarStates, type PillarStatus,
} from "@/lib/scoring";
import { getScheduleData, SCHEDULE_DETAILS, DRILL_LIBRARY, DEFAULT_DRILL, getTopNeedsWorkTag } from "@/lib/schedule-data";

// ── Profile ───────────────────────────────────────────────────────────────

const PROFILE_KEY = "padelop:profile";

type Profile = { name: string; level: string; position: string; hand: string; avatar: string };
const EMPTY: Profile = { name: "", level: "", position: "", hand: "", avatar: "" };
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

type ActivityItem =
  | { kind: "match"; ts: string; data: ReviewEntry }
  | { kind: "training"; ts: string; data: TrainingEntry };

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

function improveTips(states: PillarStates): string[] {
  const tips: string[] = [];
  if (states.nutrition.status === "low")        tips.push(states.nutrition.reason);
  if (states.recovery.status === "low")         tips.push(states.recovery.reason);
  if (states.wellbeing.status === "low")        tips.push(states.wellbeing.reason);
  if (states.training.status === "not_logged")  tips.push("Log a session — even 30 min of drills counts");
  if (states.nutrition.status === "not_logged") tips.push("Complete your night check-in to track nutrition");
  if (tips.length === 0) tips.push("You're in great shape — keep the habits going");
  return tips.slice(0, 3);
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
  return { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${filled ? "#2653d4" : "#e2e2e2"}`, background: filled ? "#f4f6ff" : "#f8f9fa", fontSize: 16, color: "#1a1c1c", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
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

// ── Page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  // Tab
  const [activeTab, setActiveTab] = useState<'me' | 'today' | 'matches' | 'stats'>('me');

  // Profile
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved]     = useState(false);

  // Matches
  const [logSheetOpen, setLogSheetOpen]       = useState(false);
  const [logTab, setLogTab]                   = useState<"checkin" | null>(null);
  const [checkinDone, setCheckinDone]         = useState(false);
  const [nextMatch, setNextMatch]             = useState<StoredMatch | null>(null);
  const [reviews, setReviews]                 = useState<ReviewEntry[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingEntry[]>([]);
  const [archiveOpen, setArchiveOpen]         = useState(false);
  const [tagCloudOpen, setTagCloudOpen]       = useState(false);
  const [partnerCount, setPartnerCount]       = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [journeyStart, setJourneyStart]       = useState<string | null>(null);

  // Insights
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

  // Schedule state
  const [schedNow, setSchedNow] = useState(new Date());
  const [dayType, setDayType] = useState<"match" | "recovery" | "training">("training");
  const [schedule, setSchedule] = useState<ReturnType<typeof getScheduleData>["schedule"]>([]);
  const [schedCurrentIdx, setSchedCurrentIdx] = useState(0);
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [schedMatchTime, setSchedMatchTime] = useState<string | null>(null);
  const [schedModalIdx, setSchedModalIdx] = useState<number | null>(null);

  function loadAll() {
    // Profile
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
    try {
      const g = JSON.parse(localStorage.getItem("padelop:gear") || "null");
      if (g?.racketName)  setRacketName(g.racketName);
      if (g?.racketType)  setRacketType(g.racketType);
      if (g?.racketImage) setRacketImage(g.racketImage);
      if (g?.racketSince) setRacketSince(g.racketSince);
      if (g?.shoeImage)   setShoeImage(g.shoeImage);
      if (g?.kitImage)    setKitImage(g.kitImage);
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

    // Insights
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    setScores(s);
    saveScoreSnapshot(s);
    const hist = loadScoreHistory();
    setHistory(hist);
    const dateset = new Set(hist.map((h: ScoreSnapshot) => h.date));
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
    hydrateFromSupabase();
    window.addEventListener("storage", loadAll);
    return () => window.removeEventListener("storage", loadAll);
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
    let type: "match" | "recovery" | "training" = "training";
    let mTime: string | null = null;
    try {
      const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
      if (m?.date === todayStr && m?.time) { type = "match"; mTime = m.time; }
    } catch {}
    if (type === "training") {
      try {
        const revs: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
        if (revs.some(r => r.ts.slice(0, 10) === yesterday)) type = "recovery";
      } catch {}
    }
    const tag = getTopNeedsWorkTag();
    setDrillTag(tag);
    setDayType(type);
    setSchedMatchTime(mTime);
    const { schedule: s, currentIdx: ci } = getScheduleData(type, mTime, tag);
    setSchedule(s);
    setSchedCurrentIdx(ci);
  }, []);

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

  const [profileOpen, setProfileOpen] = useState(false);
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
      try {
        const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
        localStorage.setItem("padelop:gear", JSON.stringify({ ...existing, kitImage: img }));
      } catch {}
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
      try {
        const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
        localStorage.setItem("padelop:gear", JSON.stringify({ ...existing, shoeImage: img }));
      } catch {}
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
      try {
        const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
        localStorage.setItem("padelop:gear", JSON.stringify({ ...existing, racketImage: img }));
      } catch {}
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
    setField("avatar", croppedDataUrl);
    const updated = { ...profile, avatar: croppedDataUrl };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
    saveProfileToDb({ display_name: updated.name, avatar_url: croppedDataUrl });
    setSaved(true);
  };
  const save = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("storage"));
    saveProfileToDb({ display_name: profile.name });
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

  const wins      = reviews.filter(r => r.result === "win").length;
  const losses    = reviews.filter(r => r.result === "loss").length;
  const winRate   = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;
  const topStrength = topTag(reviews.flatMap(r => r.wellDone ?? []));
  const topWeakness = topTag(reviews.flatMap(r => r.improved ?? []));
  const tips = improveTips(pillarStates);

  const feed: ActivityItem[] = [
    ...reviews.map(r => ({ kind: "match" as const, ts: r.ts, data: r })),
    ...trainingSessions.map(t => ({ kind: "training" as const, ts: t.ts, data: t })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

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
  const dayLabel = dayType === "match" ? "Match Day" : dayType === "recovery" ? "Recovery Day" : "Training Day";
  const dayColor = dayType === "match" ? "#2653d4" : dayType === "recovery" ? "#7c3aed" : "#16a34a";

  const TABS = [
    { key: 'me' as const,      label: 'Me' },
    { key: 'today' as const,   label: 'Today' },
    { key: 'matches' as const, label: 'Matches' },
    { key: 'stats' as const,   label: 'Stats' },
  ];

  return (
    <div className="max-w-lg mx-auto pb-20">

      {/* ── Profile Header (always visible) ─────────────────────────────── */}
      <div className="px-5 pt-6 flex flex-col items-center text-center gap-4">
        <div style={{ position: "relative", width: "100%" }}>
          <Link href="/settings" style={{ position: "absolute", top: 0, right: 0, width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>

          <button onClick={() => setProfileOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, position: "relative", display: "inline-block" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "3px solid #fff", background: profile.avatar ? "transparent" : "var(--c-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="t-stat" style={{ color: "#fff" }}>
                  {profile.name ? profile.name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?"}
                </span>
              )}
            </div>
            <div style={{ position: "absolute", bottom: 1, right: 1, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--c-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </button>
        </div>

        {profileOpen && (
          <div style={{ width: "100%", background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-line)", textAlign: "left" }}>
            <label htmlFor="avatar-upload" className="cursor-pointer flex items-center gap-3 active:opacity-70 transition-opacity">
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <span className="t-ui" style={{ color: "var(--c-blue)" }}>Change Photo</span>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </label>
            <div>
              <p className="t-label text-c-hint mb-2">Your name</p>
              <input type="text" value={profile.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Eddie"
                className="t-ui w-full px-4 py-3 rounded-2xl border-2 border-c-line text-c-text outline-none focus:border-c-blue transition-colors bg-c-bg-input focus:bg-white" />
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
            <button disabled={!canSave} onClick={() => { save(); setProfileOpen(false); }}
              className="t-ui w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
              style={{ background: saved ? "var(--c-green)" : canSave ? "var(--c-blue)" : "var(--c-line)", color: canSave ? "#fff" : "#b0b3b3" }}>
              {saved ? "Saved ✓" : "Save profile"}
            </button>
          </div>
        )}

        <div>
          <h1 className="t-heading" style={{ color: "var(--c-text)", margin: 0 }}>{profile.name || "Add your name"}</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" }}>
            {profile.level && <span className="t-caption" style={{ background: "var(--c-blue-light)", color: "var(--c-blue)", padding: "2px 12px", borderRadius: "var(--r-pill)" }}>Level {profile.level}</span>}
            {profile.position && <span className="t-caption" style={{ color: "#444748" }}>• {profile.position}</span>}
          </div>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: "4rem", zIndex: 10, background: "#fff", borderBottom: "1px solid #f0f0f0", marginTop: 20 }}>
        <div style={{ display: "flex", padding: "0 20px" }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "12px 0", fontSize: 15, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? "#1a1c1c" : "#9aa0a6", position: "relative" }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 2, borderRadius: 2, background: "#1a1c1c" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Me ──────────────────────────────────────────────────────── */}
      {activeTab === 'me' && (
        <div className="px-5 pt-5 flex flex-col gap-5">

          {/* Padel Journey */}
          <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
            <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Padel Journey</p>
            {journeyStart && (
              <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 16px", fontWeight: 500 }}>Started {journeyStart}</p>
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
          <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)", border: "1px solid var(--c-line)", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56 }}>
              <p className="t-stat" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1 }}>{streak}</p>
              <p className="t-label" style={{ color: "var(--c-label)", margin: "4px 0 0" }}>Streak</p>
            </div>
            <div style={{ width: 1, height: 40, background: "var(--c-line)", flexShrink: 0 }} />
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: 0, lineHeight: 1.5 }}>
              {streak === 0 && "Log today to start your streak."}
              {streak === 1 && "Good start — log again tomorrow to build momentum."}
              {streak >= 2 && streak < 7 && "Good momentum — don't break the chain."}
              {streak >= 7 && streak < 14 && "Incredible consistency — keep it up!"}
              {streak >= 14 && "Elite habit. You're in the top tier of consistency."}
            </p>
          </div>

          {/* My Gear */}
          <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#fff", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-card)", border: "1px solid var(--c-line)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
                <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>My Gear</p>
                <button onClick={() => setGearEditOpen(o => !o)} className="t-caption" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 500, color: "var(--c-forest)" }}>{gearEditOpen ? "Done" : "Edit"}</button>
              </div>
              <div ref={racketRowRef} style={{ display: "flex", alignItems: "stretch", padding: 12, gap: 14 }}>
                <label htmlFor="racket-img-upload" style={{ cursor: "pointer", flexShrink: 0, width: racketSlotSize, height: racketSlotSize, display: "block" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", background: "#f4f4f6", border: racketImage ? "none" : "1.5px dashed #dde0e4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {racketImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={racketImage} alt="Racket" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c4c7cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                      </svg>
                    )}
                  </div>
                </label>
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
                  <button onClick={() => { localStorage.setItem("padelop:gear", JSON.stringify({ racketName, racketType, racketImage, racketSince })); saveGearToDb({ type: "racket", name: racketName ?? undefined }); setGearEditOpen(false); }}
                    className="t-ui" style={{ padding: "12px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", border: "none", cursor: "pointer", color: "#fff" }}>
                    Save
                  </button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--c-line)", borderTop: "1px solid var(--c-line)" }}>
                <div style={{ background: "#fff", padding: "16px", display: "flex", flexDirection: "column" }}>
                  <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 12px" }}>My Shoes</p>
                  <label htmlFor="shoe-img-upload" style={{ cursor: "pointer", display: "block", flex: 1 }}>
                    <div style={{ aspectRatio: "1 / 1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--c-bg)", border: shoeImage ? "none" : "1.5px dashed var(--c-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {shoeImage ? <img src={shoeImage} alt="Shoes" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17h20v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1z"/><path d="M2 17c0-3.5 2.5-6 6-6h2l3-2h3c2.2 0 4 1.5 4.5 3.5L21 17"/></svg>}
                    </div>
                  </label>
                  <input id="shoe-img-upload" type="file" accept="image/*" className="hidden" onChange={handleShoeImage} />
                </div>
                <div style={{ background: "#fff", padding: "16px", display: "flex", flexDirection: "column" }}>
                  <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 12px" }}>My Kit</p>
                  <label htmlFor="kit-img-upload" style={{ cursor: "pointer", display: "block", flex: 1 }}>
                    <div style={{ aspectRatio: "1 / 1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--c-bg)", border: kitImage ? "none" : "1.5px dashed var(--c-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {kitImage ? <img src={kitImage} alt="Kit" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>}
                    </div>
                  </label>
                  <input id="kit-img-upload" type="file" accept="image/*" className="hidden" onChange={handleKitImage} />
                </div>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* ── Tab: Today ───────────────────────────────────────────────────── */}
      {activeTab === 'today' && (
        <div className="pt-5 flex flex-col gap-5">

          {/* Daily Check-in */}
          <button onClick={() => { setLogTab("checkin"); setLogSheetOpen(true); }}
            style={{ width: "calc(100% - 40px)", margin: "0 20px", background: "#f5f0ff", border: "none", borderRadius: "var(--r-lg)", padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            <div style={{ flex: 1 }}>
              <p className="t-body" style={{ fontWeight: 700, color: "#1a1c1c", margin: 0 }}>Daily Check-in</p>
              <p className="t-body-sm" style={{ color: checkinDone ? "#16a34a" : "#7c3aed", margin: "2px 0 0" }}>{checkinDone ? "Done today" : "Log how you feel today"}</p>
            </div>
            {checkinDone
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            }
          </button>

          {/* Focus Today */}
          <div style={{ background: "#fff", margin: "0 20px", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
            <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Focus Today</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {tips.map(tip => (
                <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-blue)", flexShrink: 0, marginTop: 5 }}/>
                  <span className="t-body-sm" style={{ fontWeight: 500, color: "var(--c-text)", lineHeight: 1.4 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day type + schedule */}
          <div style={{ padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: `${dayColor}18`, color: dayColor }}>{dayLabel}</span>
              <span style={{ fontSize: 13, color: "#b0b8c1", fontWeight: 500 }}>{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {schedule.map((s, i) => {
                const isCur = i === schedCurrentIdx;
                const nowMins = schedNow.getHours() * 60 + schedNow.getMinutes();
                const toMins = (t: string) => t.split(":").reduce((a: number, b: string, j: number) => a + (j === 0 ? Number(b) * 60 : Number(b)), 0);
                const isPast = !isCur && nowMins > toMins(s.time);
                const hasDetail = !!SCHEDULE_DETAILS[s.title] || s.isDrill;
                return (
                  <div key={i} onClick={() => hasDetail && setSchedModalIdx(i)}
                    style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: isCur ? "14px 14px 14px 16px" : "10px 10px 10px 14px", cursor: hasDetail ? "pointer" : "default", background: isCur ? `${s.color}0e` : "#fff", boxShadow: isCur ? `0 0 0 2px ${s.color}, 0 2px 12px ${s.color}22` : "0 0 0 1px #f0f0f0" }}
                  >
                    <div style={{ width: isCur ? 40 : 32, height: isCur ? 40 : 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isPast ? "#f0f0f0" : `${s.color}22` }}>
                      <div style={{ width: isCur ? 13 : 10, height: isCur ? 13 : 10, borderRadius: "50%", background: isPast ? "#d0d3d6" : s.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color: isPast ? "#c4c7c7" : s.color }}>{s.time}</p>
                      <p style={{ fontSize: isCur ? "clamp(17px,4.4vw,20px)" : "clamp(15px,3.9vw,18px)", fontWeight: isCur ? 700 : 600, margin: 0, lineHeight: 1.25, color: isPast ? "#a0a5aa" : "#1a1c1c" }}>{s.title}</p>
                      {s.subtitle && <p style={{ fontSize: "clamp(12px,3.1vw,14px)", margin: "2px 0 0", color: isPast ? "#c4c7c7" : "#6b7480" }}>{s.subtitle}</p>}
                    </div>
                    {hasDetail && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isCur ? s.color : "#c4c7c7"} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar */}
          <div style={{ margin: "0 20px" }}>
            <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 10px" }}>Your Calendar</p>
            <div className="bg-white r-lg border border-c-line overflow-hidden" style={card}>
              <div style={{ padding: "16px 14px 20px" }}>
                <p className="t-caption" style={{ fontWeight: 600, color: "var(--c-text-sub)", marginBottom: "10px", textTransform: "capitalize" }}>{monthLabel}</p>
                <div style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", marginBottom: 2 }}>
                  <div />
                  {["M","T","W","T","F","S","S"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9aab96", paddingBottom: "4px" }}>{d}</div>
                  ))}
                </div>
                {rows.map((rowCells, rowIdx) => (
                  <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 5 }}>
                      {rowIdx === currentWeekRow && <svg width="6" height="9" viewBox="0 0 6 9"><polygon points="0,0 6,4.5 0,9" fill="var(--c-blue)"/></svg>}
                    </div>
                    {rowCells.map((day, colIdx) => {
                      if (day === null) return <div key={colIdx} style={{ height: 34 }} />;
                      const ymd = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isToday2   = ymd === todayYMD;
                      const isMatch    = matchDates.has(ymd);
                      const isRecovery = !isMatch && recoveryDates.has(ymd);
                      const isPast     = ymd < todayYMD;
                      const dotColor   = isMatch ? "#22c55e" : isRecovery ? "#f97316" : "var(--c-blue)";
                      const hasDot     = (isMatch || isRecovery) && !isPast;
                      return (
                        <div key={colIdx} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 2 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday2 ? "var(--c-blue)" : "transparent", opacity: isPast ? 0.35 : 1 }}>
                            <span className="t-caption" style={{ fontWeight: isToday2 ? 700 : 400, color: isToday2 ? "#fff" : "var(--c-text)" }}>{day}</span>
                          </div>
                          <div style={{ height: 4, width: 4, borderRadius: "50%", background: hasDot ? dotColor : "transparent", marginTop: 1 }} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", borderTop: "1px solid #f4f4f6", marginTop: "4px", paddingTop: "12px", paddingBottom: "8px" }}>
                <div />
                <div style={{ gridColumn: "2 / span 7", display: "flex", gap: 14 }}>
                  {[
                    { color: "#22c55e", label: "Match", border: false },
                    { color: "#f97316", label: "Recovery", border: false },
                    { color: "transparent", label: "Rest", border: true },
                  ].map(({ color, label, border }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, border: border ? "1.5px solid #c0c4c8" : "none" }} />
                      <span className="t-tag" style={{ fontWeight: 600, color: "var(--c-hint)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Next match */}
          {nextMatch && (
            <div style={{ margin: "0 20px" }}>
              <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 10px" }}>Next Match</p>
              <NextMatchCard match={nextMatch} />
            </div>
          )}

        </div>
      )}

      {/* ── Tab: Matches ─────────────────────────────────────────────────── */}
      {activeTab === 'matches' && (
        <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Add button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => { setMatchAddOpen(o => !o); setMatchExpandedIdx(null); if (!matchAddOpen) setMatchAddForm(EMPTY_FORM); }}
              style={{ background: matchAddOpen ? "#e8edf8" : "#2653d4", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 14, fontWeight: 700, color: matchAddOpen ? "#2653d4" : "#fff", cursor: "pointer" }}
            >
              {matchAddOpen ? "Cancel" : "+ Add"}
            </button>
          </div>

          {/* Add form */}
          {matchAddOpen && (
            <div style={{ background: "#fff", borderRadius: 20, padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1c1c" }}>New match</p>
              <MatchFormWidget form={matchAddForm} onChange={setMatchAddForm} onSave={matchSaveAdd} saveLabel="Save match" saveColor="#16a34a" />
            </div>
          )}

          {/* Upcoming */}
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
                    <button
                      onClick={() => { setMatchExpandedIdx(expanded ? null : idx); setMatchAddOpen(false); }}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                    >
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
            <div style={{ background: "#fff", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>No upcoming matches</p>
              <p style={{ margin: "0 0 18px", fontSize: 14, color: "#8a9096" }}>Schedule your next game</p>
              <button onClick={() => setMatchAddOpen(true)} style={{ padding: "11px 28px", borderRadius: 999, background: "#2653d4", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Add a match</button>
            </div>
          )}

          {/* History */}
          {reviews.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <p style={{ margin: "4px 4px 0", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>HISTORY</p>
              {[...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).map((r, i) => {
                const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
                const resultBg   = r.result === "win" ? "#f0fdf4" : r.result === "loss" ? "#fff5f5" : "#f4f6f8";
                return (
                  <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flexShrink: 0, width: 44, textAlign: "center", background: "#f4f6f8", borderRadius: 11, padding: "7px 4px" }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#8a9096" }}>{new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                      <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 900, color: "#1a1c1c", lineHeight: 1 }}>{new Date(r.ts.slice(0, 10) + "T12:00").getDate()}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {r.feeling && <p style={{ margin: "0 0 2px", fontSize: 13, color: "#8a9096" }}>{r.feeling}</p>}
                      {(r.wellDone?.length > 0 || r.improved?.length > 0) && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {r.wellDone?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#f0fdf4", color: "#16a34a" }}>{t}</span>)}
                          {r.improved?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#fff5f5", color: "#ef4444" }}>{t}</span>)}
                        </div>
                      )}
                    </div>
                    {r.result && (
                      <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: resultBg, color: resultColor }}>
                        {r.result.charAt(0).toUpperCase() + r.result.slice(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ── Tab: Stats ───────────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div className="px-5 pt-5 flex flex-col gap-5">

          {/* Food Quality */}
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
            const matchToday = !!nextMatch && nextMatch.date === todayStr;
            const matchYesterday = (() => {
              try {
                const allR: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                return allR.some(r => r.ts.slice(0, 10) === yesterday.toISOString().slice(0, 10));
              } catch { return false; }
            })();
            const dayTypeLocal = matchToday ? "match" : matchYesterday ? "recovery" : "training";
            const coverage = compareMealsToSchedule(viewMeals, dayTypeLocal);
            const barMax = Math.max(...foodHistory.map(d => d.score), 1);
            const dateLabel = isToday ? "Today" : new Date(viewDate + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
            return (
              <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>Food Quality</p>
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
                  <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "10px 12px", marginBottom: viewMeals.length ? 14 : 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#2653d4", marginBottom: 3 }}>AI Assessment</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#2c3235", lineHeight: 1.5 }}>{aiInsight.insight}</p>
                  </div>
                )}
                {isToday && !aiInsight && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: viewMeals.length ? 14 : 0 }}>
                    {coverage.map(({ title, covered }) => (
                      <div key={title} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: covered ? "#16a34a" : "#e8eaed", border: covered ? "none" : "1.5px solid #c8cdd3" }} />
                        <span className="t-body-sm" style={{ color: covered ? "var(--c-text)" : "var(--c-hint)", fontWeight: covered ? 600 : 400 }}>{title}</span>
                        {!covered && <span style={{ fontSize: 11, color: "#b0b8c1", marginLeft: "auto" }}>not logged</span>}
                      </div>
                    ))}
                  </div>
                )}
                {viewMeals.length > 0 ? (
                  <div style={{ borderTop: "1px solid #f4f4f6", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {viewMeals.map(m => (
                      <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                        <span className="t-body-sm" style={{ color: "var(--c-text-sub)", lineHeight: 1.4 }}>{m.description}</span>
                      </div>
                    ))}
                  </div>
                ) : !isToday ? (
                  <p className="t-body-sm" style={{ color: "var(--c-hint)", margin: 0, borderTop: "1px solid #f4f4f6", paddingTop: 12 }}>Nothing logged this day.</p>
                ) : null}
                <Link href="/shopping-list" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid #f4f4f6", textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>Weekly Shopping List</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              </div>
            );
          })()}

          {/* Match Record */}
          {reviews.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
              <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Match Record</p>
              <div style={{ display: "flex", gap: "10px", marginBottom: topStrength || topWeakness ? 16 : 0 }}>
                <div style={{ flex: 1, textAlign: "center", background: "var(--c-green-bg)", borderRadius: "var(--r-sm)", padding: "12px 8px" }}>
                  <p className="t-stat" style={{ color: "var(--c-green)", margin: 0, lineHeight: 1 }}>{wins}</p>
                  <p className="t-tag" style={{ color: "var(--c-green)", margin: "4px 0 0", fontWeight: 600 }}>Wins</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "var(--c-red-bg)", borderRadius: "var(--r-sm)", padding: "12px 8px" }}>
                  <p className="t-stat" style={{ color: "var(--c-red)", margin: 0, lineHeight: 1 }}>{losses}</p>
                  <p className="t-tag" style={{ color: "var(--c-red)", margin: "4px 0 0", fontWeight: 600 }}>Losses</p>
                </div>
                {winRate !== null && (
                  <div style={{ flex: 1, textAlign: "center", background: "#f4f6ff", borderRadius: "var(--r-sm)", padding: "12px 8px" }}>
                    <p className="t-stat" style={{ color: "var(--c-blue)", margin: 0, lineHeight: 1 }}>{winRate}%</p>
                    <p className="t-tag" style={{ color: "var(--c-blue)", margin: "4px 0 0", fontWeight: 600 }}>Win rate</p>
                  </div>
                )}
              </div>
              {(topStrength || topWeakness) && (
                <button onClick={() => setTagCloudOpen(o => !o)}
                  style={{ display: "flex", flexDirection: "column", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}>
                  {topStrength && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-green)", flexShrink: 0 }}/>
                      <span className="t-body-sm" style={{ color: "var(--c-text)" }}>Strongest: <strong>{topStrength}</strong></span>
                      {!topWeakness && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0, transition: "transform 0.2s", transform: tagCloudOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>}
                    </div>
                  )}
                  {topWeakness && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-amber)", flexShrink: 0 }}/>
                      <span className="t-body-sm" style={{ color: "var(--c-text)" }}>Focus area: <strong>{topWeakness}</strong></span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0, transition: "transform 0.2s", transform: tagCloudOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                  )}
                </button>
              )}
              {tagCloudOpen && reviews.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <TagCloud reviews={reviews} />
                </div>
              )}
            </div>
          )}

          {/* Activity Archive */}
          <button onClick={() => setArchiveOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
            <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>Activity Archive</p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-label)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: "transform 0.2s", transform: archiveOpen ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          {archiveOpen && (
            feed.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {feed.map(item =>
                  item.kind === "match"
                    ? <MatchCard key={item.ts + "m"} review={item.data as ReviewEntry} />
                    : <TrainingCard key={item.ts + "t"} entry={item.data as TrainingEntry} />
                )}
              </div>
            ) : (
              <div className="bg-white r-md border border-c-line px-5 py-8 text-center" style={card}>
                <p className="t-body font-medium text-c-text-sub">No activity logged yet</p>
                <p className="t-body-sm text-[#9aab96] mt-1">Tap + to log your first session</p>
              </div>
            )
          )}

        </div>
      )}

      {/* ── Schedule detail modal ────────────────────────────────────────── */}
      {schedModalItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }} onClick={() => setSchedModalIdx(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full bg-white rounded-[28px] overflow-hidden overflow-y-auto" style={{ maxHeight: "80vh", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4" style={{ background: `${schedModalItem.color}18` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: schedModalItem.color }} />
                <p className="text-[17px] font-bold tracking-widest uppercase" style={{ color: schedModalItem.color }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="text-[28px] font-bold text-[#1a1c1c] leading-tight">{schedModalItem.title}</h3>
              {schedModalItem.subtitle && <p className="text-[20px] text-[#6b7480] mt-0.5">{schedModalItem.subtitle}</p>}
            </div>
            {schedDetail && (
              <div className="px-6 py-5">
                {schedDetail.type === 'info' && <p className="text-[18px] text-[#2c3235] leading-relaxed">{schedDetail.text}</p>}
                {schedDetail.type === 'meal' && (
                  <>
                    <p className="text-[15px] font-bold uppercase tracking-widest text-[#8a9096] mb-4">{schedDetail.focus}</p>
                    <div className="flex flex-col gap-3">
                      {schedDetail.options.map((meal, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: `${schedModalItem.color}18` }}>
                            <span className="text-[13px] font-bold" style={{ color: schedModalItem.color }}>{i + 1}</span>
                          </div>
                          <p className="text-[18px] text-[#2c3235] leading-snug">{meal}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {schedDetail.type === 'exercise' && (
                  <div className="flex flex-col gap-4">
                    {(schedDrillSteps ?? schedDetail.steps).map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${schedModalItem.color}18` }}>
                          <span className="text-[15px] font-bold" style={{ color: schedModalItem.color }}>{i + 1}</span>
                        </div>
                        <div>
                          <p className="text-[17px] font-semibold text-[#1a1c1c]">{s.step}</p>
                          <p className="text-[16px] text-[#6b7480] mt-0.5 leading-snug">{s.cue}</p>
                          <p className="text-[15px] font-semibold mt-1" style={{ color: schedModalItem.color }}>{s.reps}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="px-6 pb-6">
              <button onClick={() => setSchedModalIdx(null)} className="w-full py-3.5 rounded-2xl font-bold text-white" style={{ background: schedModalItem.color }}>Done</button>
            </div>
          </div>
        </div>
      )}

      <LogSheet open={logSheetOpen} onClose={() => { setLogSheetOpen(false); setLogTab(null); }} defaultSub={logTab ?? undefined} />

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
