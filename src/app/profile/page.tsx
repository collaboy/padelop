"use client";

import React, { useState, useEffect } from "react";
import LogSheet from "@/components/log-sheet";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates,
  type Scores, type ScoreSnapshot, type ReviewEntry, type PillarStates, type PillarStatus,
} from "@/lib/scoring";

// ── Profile ───────────────────────────────────────────────────────────────

const PROFILE_KEY = "padelop:profile";

type Profile = { name: string; level: string; position: string; hand: string; avatar: string };
const EMPTY: Profile = { name: "", level: "", position: "", hand: "", avatar: "" };
const LEVELS    = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const POSITIONS = ["Left wall","Right wall","Both"];
const HANDS     = ["Right","Left"];

// ── Matches types ─────────────────────────────────────────────────────────

type StoredMatch = {
  date: string; time: string; club: string;
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
  { key: "recovery",  label: "Recovery",  color: "#7c3aed" },
  { key: "nutrition", label: "Nutrition", color: "#0891b2" },
  { key: "training",  label: "Training",  color: "#16a34a" },
  { key: "wellbeing", label: "Wellbeing", color: "#f59e0b" },
];

const STATUS_META: Record<PillarStatus, { label: string; bg: string; text: string }> = {
  good:       { label: "Good",       bg: "#f0fdf4", text: "#16a34a" },
  ok:         { label: "OK",         bg: "#fffbeb", text: "#d97706" },
  low:        { label: "Low",        bg: "#fef2f2", text: "#dc2626" },
  not_logged: { label: "Not logged", bg: "#f4f4f6", text: "#9aa5b0" },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
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

const card: React.CSSProperties = { boxShadow: "0px 4px 20px rgba(0,0,0,0.04)" };

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
          const bg    = type === "good" ? "#e6fff1" : "#fef0e8";
          const rot   = ((hashStr(text) % 11) - 5) * 0.8;
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

function MatchCard({ review }: { review: ReviewEntry }) {
  const resultColor = review.result === "win" ? "#496640" : review.result === "loss" ? "#dc2626" : "#747878";
  const resultBg    = review.result === "win" ? "#eef6eb" : review.result === "loss" ? "#fef2f2" : "#f4f4f6";
  const resultLabel = review.result === "win" ? "Win"     : review.result === "loss" ? "Loss"    : "Played";
  const opponent    = typeof review.opponent === "string" ? review.opponent : null;
  const hasTags = review.wellDone.length > 0 || review.improved.length > 0;
  return (
    <div className="bg-white rounded-[20px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-[#1a1c1c]">Match</p>
          <p className="text-[11px] text-[#9aab96] mt-0.5">{formatTs(review.ts)}</p>
        </div>
        <div className="flex items-center gap-2">
          {opponent && <span className="text-[11px] font-semibold text-[#747878]">vs {opponent}</span>}
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: resultBg, color: resultColor }}>{resultLabel}</span>
        </div>
      </div>
      {hasTags && (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="px-5 py-3 flex flex-col gap-2">
            {review.wellDone.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.wellDone.map(t => <span key={t} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#eef6eb", color: "#496640" }}>{t}</span>)}
              </div>
            )}
            {review.improved.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.improved.map(t => <span key={t} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f9f9f9] text-[#747878] border border-[#ebebeb]">{t}</span>)}
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
          {entry.duration && <span className="text-[11px] font-semibold text-[#747878]">{entry.duration}</span>}
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
                {entry.sessionType.map(t => <span key={t} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#f0f4ff] text-[#2653d4]">{t}</span>)}
              </div>
            )}
            {entry.drillFocus.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.drillFocus.map(t => <span key={t} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f9f9f9] text-[#747878] border border-[#ebebeb]">{t}</span>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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

// ── Page ──────────────────────────────────────────────────────────────────

const TABS = ["All", "Matches", "Training"] as const;
type Tab = (typeof TABS)[number];

export default function ProfilePage() {
  // Profile
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved]     = useState(false);

  // Matches
  const [logSheetOpen, setLogSheetOpen]       = useState(false);
  const [tab, setTab]                         = useState<Tab>("All");
  const [filterOpen, setFilterOpen]           = useState(false);
  const [nextMatch, setNextMatch]             = useState<StoredMatch | null>(null);
  const [reviews, setReviews]                 = useState<ReviewEntry[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingEntry[]>([]);
  const [archiveOpen, setArchiveOpen]         = useState(false);

  // Insights
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 });
  const [pillarStates, setPillarStates] = useState<PillarStates>({
    recovery:  { status: "not_logged", reason: "Morning check-in not done" },
    nutrition: { status: "not_logged", reason: "Night check-in not done yet" },
    training:  { status: "not_logged", reason: "No session logged today" },
    wellbeing: { status: "not_logged", reason: "Check-in not done yet" },
  });
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);

  function loadAll() {
    // Profile
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) setProfile(JSON.parse(raw));
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

    // Insights
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    setScores(s);
    saveScoreSnapshot(s);
    setHistory(loadScoreHistory());
    const todayStr = new Date().toISOString().slice(0, 10);
    let m2: { date: string } | null = null;
    try { m2 = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
    setPillarStates(computePillarStates(d.checkIn, d.hydration, d.nutrition, d.habits, d.training, m2?.date === todayStr));
  }

  useEffect(() => {
    loadAll();
    window.addEventListener("storage", loadAll);
    return () => window.removeEventListener("storage", loadAll);
  }, []);

  const [profileOpen, setProfileOpen] = useState(false);

  // Profile helpers
  const setField = (k: keyof Profile, v: string) => { setSaved(false); setProfile(p => ({ ...p, [k]: v })); };
  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("avatar", reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const save = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("storage"));
    setSaved(true);
  };
  const canSave = profile.name.trim().length > 0;

  // Insights derived
  const deduped = Object.values(
    history.reduce((acc, s) => { acc[s.date] = s; return acc; }, {} as Record<string, ScoreSnapshot>)
  ).sort((a, b) => a.date.localeCompare(b.date));
  const last14 = deduped.slice(-14);

  const dow = (new Date().getDay() + 6) % 7;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - dow);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const thisWeek = deduped.filter(s => s.date >= weekStartStr);
  const lastWeek = deduped.filter(s => s.date >= lastWeekStartStr && s.date < weekStartStr);
  const avg = (arr: ScoreSnapshot[]) => arr.length ? Math.round(arr.reduce((s, x) => s + x.overall, 0) / arr.length) : null;
  const thisWeekAvg = avg(thisWeek);
  const lastWeekAvg = avg(lastWeek);

  const wins      = reviews.filter(r => r.result === "win").length;
  const losses    = reviews.filter(r => r.result === "loss").length;
  const winRate   = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;
  const topStrength = topTag(reviews.flatMap(r => r.wellDone ?? []));
  const topWeakness = topTag(reviews.flatMap(r => r.improved ?? []));
  const tips = improveTips(pillarStates);

  // Activity feed
  const feed: ActivityItem[] = [
    ...reviews.map(r => ({ kind: "match" as const, ts: r.ts, data: r })),
    ...trainingSessions.map(t => ({ kind: "training" as const, ts: t.ts, data: t })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

  const visibleFeed = tab === "Matches"
    ? feed.filter(i => i.kind === "match")
    : tab === "Training"
    ? feed.filter(i => i.kind === "training")
    : feed;

  // Schedule data
  const now = new Date();
  const todayYMD = now.toISOString().slice(0, 10);
  const dowToday = (now.getDay() + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dowToday);
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

  return (
    <div className="px-4 pt-6 pb-20 max-w-lg mx-auto flex flex-col gap-6">

      {/* ── Profile header + collapsible form ───────────────────────────── */}

      <div className="bg-white rounded-[24px] overflow-hidden border border-[#c4c7c7]/10">
        {/* Always-visible header row */}
        <button
          onClick={() => setProfileOpen(o => !o)}
          className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors"
        >
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: profile.avatar ? "transparent" : "#2653d4" }}>
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                {profile.name ? profile.name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?"}
              </span>
            )}
          </div>
          {/* Name + level */}
          <div className="flex-1 text-left">
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1.2 }}>
              {profile.name || "Add your name"}
            </p>
            {(profile.level || profile.position) && (
              <p style={{ fontSize: 12, color: "#9aa5b0", margin: "3px 0 0" }}>
                {[profile.level && `Level ${profile.level}`, profile.position].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {/* Chevron */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transition: "transform 0.2s", transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {/* Expandable form */}
        {profileOpen && (
          <div style={{ borderTop: "1px solid #f0f0f0", padding: "20px 20px 4px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <label htmlFor="avatar-upload" className="cursor-pointer group">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#e2e2e2] group-active:opacity-80 transition-opacity flex items-center justify-center bg-[#f4f4f4]">
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="9" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                  )}
                </div>
              </label>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              <p className="text-[12px] text-[#9aa5b0]">{profile.avatar ? "Tap to change photo" : "Add a photo (optional)"}</p>
            </div>

            {/* Name */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Your name</p>
              <input type="text" value={profile.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Eddie"
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#e2e2e2] text-[15px] font-semibold text-[#1a1c1c] outline-none focus:border-[#2653d4] transition-colors bg-[#f9f9f9] focus:bg-white" />
            </div>

            {/* Level */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Padel level</p>
              <div className="grid grid-cols-5 gap-2">
                {LEVELS.map(l => {
                  const sel = profile.level === l;
                  return (
                    <button key={l} onClick={() => setField("level", l)}
                      className="py-2 rounded-xl border-2 text-[13px] font-bold transition-all active:scale-95"
                      style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#2653d4" : "#f9f9f9", color: sel ? "#fff" : "#747878" }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Position */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Preferred position</p>
              <div className="flex gap-2">
                {POSITIONS.map(pos => {
                  const sel = profile.position === pos;
                  return (
                    <button key={pos} onClick={() => setField("position", pos)}
                      className="flex-1 py-2 rounded-xl border-2 text-[12px] font-bold transition-all active:scale-95"
                      style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                      {pos}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hand */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Dominant hand</p>
              <div className="flex gap-2">
                {HANDS.map(h => {
                  const sel = profile.hand === h;
                  return (
                    <button key={h} onClick={() => setField("hand", h)}
                      className="flex-1 py-2 rounded-xl border-2 text-[13px] font-bold transition-all active:scale-95"
                      style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                      {h}-handed
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save */}
            <button disabled={!canSave} onClick={() => { save(); setProfileOpen(false); }}
              className="w-full py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] mb-4"
              style={{ background: saved ? "#16a34a" : canSave ? "#2653d4" : "#e2e2e2", color: canSave ? "#fff" : "#b0b3b3" }}>
              {saved ? "Saved ✓" : "Save profile"}
            </button>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Match Record</p>
          <div style={{ display: "flex", gap: 10, marginBottom: topStrength || topWeakness ? 16 : 0 }}>
            <div style={{ flex: 1, textAlign: "center", background: "#f0fdf4", borderRadius: 14, padding: "12px 8px" }}>
              <p style={{ fontSize: 30, fontWeight: 700, color: "#16a34a", margin: 0, lineHeight: 1 }}>{wins}</p>
              <p style={{ fontSize: 11, color: "#16a34a", margin: "4px 0 0", fontWeight: 600 }}>Wins</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "#fef2f2", borderRadius: 14, padding: "12px 8px" }}>
              <p style={{ fontSize: 30, fontWeight: 700, color: "#dc2626", margin: 0, lineHeight: 1 }}>{losses}</p>
              <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0", fontWeight: 600 }}>Losses</p>
            </div>
            {winRate !== null && (
              <div style={{ flex: 1, textAlign: "center", background: "#f4f6ff", borderRadius: 14, padding: "12px 8px" }}>
                <p style={{ fontSize: 30, fontWeight: 700, color: "#2653d4", margin: 0, lineHeight: 1 }}>{winRate}%</p>
                <p style={{ fontSize: 11, color: "#2653d4", margin: "4px 0 0", fontWeight: 600 }}>Win rate</p>
              </div>
            )}
          </div>
          {(topStrength || topWeakness) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topStrength && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: "#1a1c1c" }}>Strongest: <strong>{topStrength}</strong></span>
                </div>
              )}
              {topWeakness && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: "#1a1c1c" }}>Focus area: <strong>{topWeakness}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {reviews.length > 0 && <TagCloud reviews={reviews} />}

      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 16px" }}>Focus Today</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tips.map(tip => (
            <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4", flexShrink: 0, marginTop: 5 }}/>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1c1c", lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setLogSheetOpen(true)}
          className="w-full mt-5 py-3 rounded-2xl text-[14px] font-semibold text-white active:opacity-70 transition-opacity"
          style={{ background: "#2653d4" }}>
          Log data
        </button>
      </div>

      {/* ── Activity ─────────────────────────────────────────────────────── */}

      <div style={{ height: 1, background: "#e8eaed", margin: "4px 0" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Activity</p>
        <button onClick={() => setFilterOpen(true)}
          className="w-8 h-8 rounded-full bg-white border border-[#e2e2e2] flex items-center justify-center active:scale-90 transition-transform relative"
          style={card}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {tab !== "All" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#496640]" />}
        </button>
      </div>

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

      {tab === "All" && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Schedule</p>
          <div className="bg-white rounded-[24px] border border-[#e2e2e2] overflow-hidden" style={card}>
            <div style={{ padding: "16px 14px 20px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#747878", marginBottom: 10, textTransform: "capitalize" }}>{monthLabel}</p>
              <div style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", marginBottom: 2 }}>
                <div />
                {["M","T","W","T","F","S","S"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9aab96", paddingBottom: 4 }}>{d}</div>
                ))}
              </div>
              {rows.map((rowCells, rowIdx) => (
                <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "12px repeat(7, 1fr)", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
                    {rowIdx === currentWeekRow && (
                      <svg width="6" height="9" viewBox="0 0 6 9"><polygon points="0,0 6,4.5 0,9" fill="#2653d4"/></svg>
                    )}
                  </div>
                  {rowCells.map((day, colIdx) => {
                    if (day === null) return <div key={colIdx} style={{ height: 34 }} />;
                    const ymd = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday    = ymd === todayYMD;
                    const isMatch    = matchDates.has(ymd);
                    const isRecovery = !isMatch && recoveryDates.has(ymd);
                    const isPast     = ymd < todayYMD;
                    const dotColor   = isMatch ? "#496640" : isRecovery ? "#7c3aed" : "#2653d4";
                    const hasDot     = (isMatch || isRecovery) && !isPast;
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
      )}

      {nextMatch && (tab === "All" || tab === "Matches") && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Next Match</p>
          <NextMatchCard match={nextMatch} />
        </>
      )}

      <button onClick={() => setArchiveOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Activity Archive</p>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "transform 0.2s", transform: archiveOpen ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>
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

      {/* FAB */}
      <button onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: "#496640", boxShadow: "0 4px 16px #49664055" }}
        aria-label="Log activity">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
    </div>
  );
}
