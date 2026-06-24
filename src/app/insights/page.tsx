"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveGearToDb, uploadGearImageToStorage, saveScoreSnapshotToDb, saveNutritionInsightToDb } from "@/lib/db";
import { hydrateFromSupabase } from "@/lib/sync";
import { analyzeMeals, compareMealsToSchedule, foodGrade, loadFoodHistory, type MealEntry } from "@/lib/food-scoring";
import {
  computeScores, loadScoringData, saveScoreSnapshot, loadScoreHistory,
  computePillarStates, computeMatchReadiness, loadMorningLog,
  type MatchReadinessResult, type ScoreSnapshot, type ReviewEntry, type PillarStates, type PillarStatus,
  type HabitsEntry, type HydrationEntry,
} from "@/lib/scoring";
import { getScheduleData, getTopNeedsWorkTag } from "@/lib/schedule-data";

type StoredMatch = { date: string; time: string; club?: string; court?: string; player_1: string; player_2: string; player_3: string; player_4: string };
type TrainingEntry = { ts: string; sessionType: string[]; drillFocus: string[]; duration: string; intensity: string };
type Pillar = { key: "recovery" | "nutrition" | "training" | "wellbeing"; label: string; color: string };

const PILLARS: Pillar[] = [
  { key: "recovery",  label: "Recovery",  color: "var(--c-purple)" },
  { key: "nutrition", label: "Nutrition", color: "var(--c-teal)" },
  { key: "training",  label: "Training",  color: "var(--c-green)" },
  { key: "wellbeing", label: "Wellbeing", color: "var(--c-amber)" },
];

const STATUS_META: Record<PillarStatus, { label: string; bg: string; text: string }> = {
  good:       { label: "Good",       bg: "var(--c-green-bg)", text: "var(--c-green)" },
  ok:         { label: "OK",         bg: "#fffbeb",           text: "#d97706" },
  low:        { label: "Low",        bg: "var(--c-red-bg)",   text: "var(--c-red)" },
  not_logged: { label: "Not logged", bg: "var(--c-bg)",       text: "var(--c-hint)" },
};

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
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

function PrevDaysList({ days, schedDone, deduped, pctColor }: {
  days: string[];
  schedDone: Record<string, string[]>;
  deduped: ScoreSnapshot[];
  pctColor: (p: number | null) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = days.map(dateStr => {
    const snap = deduped.find(s => s.date === dateStr);
    const doneTitles = schedDone[dateStr] ?? [];
    let schedTotal = 0, schedDoneCount = 0;
    try {
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
        <button onClick={() => setExpanded(isOpen ? null : dateStr)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: "10px 0", textAlign: "left" }}>
          <div style={{ flex: 1 }}><span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>{label}</span></div>
          {schedPct !== null && <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(schedPct), background: `${pctColor(schedPct)}18`, padding: "2px 8px", borderRadius: 99 }}>{schedPct}%</span>}
          {snap && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-hint)" }}>Score {snap.overall}</span>}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-hint)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
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

export default function InsightsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<{ name: string; playingSince: string }>({ name: "", playingSince: "" });
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [partnerCount, setPartnerCount] = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [journeyStart, setJourneyStart] = useState<string | null>(null);
  const [matchReadiness, setMatchReadiness] = useState<MatchReadinessResult | null>(null);
  const [pillarStates, setPillarStates] = useState<PillarStates>({
    recovery:  { status: "not_logged", reason: "Morning check-in not done" },
    nutrition: { status: "not_logged", reason: "Night check-in not done yet" },
    training:  { status: "not_logged", reason: "No session logged today" },
    wellbeing: { status: "not_logged", reason: "Check-in not done yet" },
  });
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);
  const [schedDone, setSchedDone] = useState<Record<string, string[]>>({});
  const [prevDaysOpen, setPrevDaysOpen] = useState(false);
  const [featuredIdx, setFeaturedIdx] = useState(() => Math.floor(Math.random() * 8));
  const [selectedFoodDate, setSelectedFoodDate] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<{ score: number; insight: string } | null>(null);
  const [foodHistory, setFoodHistory] = useState<Array<{ date: string; score: number }>>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [nextMatch, setNextMatch] = useState<StoredMatch | null>(null);
  const [gearEditOpen, setGearEditOpen] = useState(false);
  const [racketName, setRacketName] = useState("");
  const [racketType, setRacketType] = useState("");
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

  function loadAll() {
    const todayStr = new Date().toISOString().slice(0, 10);
    try { const raw = localStorage.getItem("padelop:profile"); if (raw) setProfile(JSON.parse(raw)); } catch {}
    try {
      const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
      setRacketName(g.racketName ?? ""); setRacketType(g.racketType ?? "");
      setRacketImage(g.racketImage ?? ""); setRacketSince(g.racketSince ?? "");
      setShoeImage(g.shoeImage ?? ""); setKitImage(g.kitImage ?? "");
    } catch {}
    try {
      const raw = localStorage.getItem("padelop:next-match");
      const m = raw ? JSON.parse(raw) as StoredMatch : null;
      setNextMatch(m?.date && m?.time && new Date(`${m.date}T${m.time}`).getTime() > Date.now() ? m : null);
    } catch { setNextMatch(null); }
    try { setReviews(JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")); } catch { setReviews([]); }
    try { setTrainingSessions((JSON.parse(localStorage.getItem("padelop:training-logs") || "[]") as TrainingEntry[]).sort((a, b) => b.ts.localeCompare(a.ts))); } catch { setTrainingSessions([]); }
    try {
      const allMatches: StoredMatch[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
      setPartnerCount(new Set(allMatches.map(m => m.player_2).filter(Boolean)).size);
    } catch {}
    try { const t = JSON.parse(localStorage.getItem("padelop:tournaments") || "null"); setTournamentCount(typeof t?.count === "number" ? t.count : 0); } catch {}
    try {
      const all = [...(JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as { ts: string }[]), ...(JSON.parse(localStorage.getItem("padelop:training-logs") || "[]") as { ts: string }[])].map(e => e.ts).filter(Boolean).sort();
      if (all.length > 0) setJourneyStart(new Date(all[0]).toLocaleDateString("en-US", { month: "short", year: "numeric" }));
    } catch {}
    try { setSchedDone(JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}")); } catch {}
    const d = loadScoringData();
    const s = computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training);
    const morningLog = loadMorningLog();
    setMatchReadiness(computeMatchReadiness(d.checkIn, morningLog, false, d.review));
    import("@/lib/supabase/client").then(({ createClient }) => {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      createClient().from("matches").select("date").eq("date", yesterday.toISOString().slice(0, 10)).limit(1).maybeSingle().then(({ data }) => {
        setMatchReadiness(computeMatchReadiness(d.checkIn, morningLog, !!data, d.review));
      });
    });
    saveScoreSnapshot(s);
    saveScoreSnapshotToDb(todayStr, s);
    setHistory(loadScoreHistory());
    const habits: { date: string }[] = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
    const dateset = new Set(habits.map(h => h.date));
    const cur = new Date();
    if (!dateset.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
    let streakCount = 0;
    while (dateset.has(cur.toISOString().slice(0, 10))) { streakCount++; cur.setDate(cur.getDate() - 1); }
    setStreak(streakCount);
    const m2: { date: string } | null = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
    setPillarStates(computePillarStates(d.checkIn, d.hydration, d.nutrition, d.habits, d.training, m2?.date === todayStr));
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
    window.addEventListener("padelop:sync-done", loadAll);
    return () => { window.removeEventListener("storage", loadAll); window.removeEventListener("padelop:sync-done", loadAll); };
  }, []);

  useEffect(() => {
    if (!todayMeals.length) { setAiInsight(null); return; }
    const todayStr = new Date().toISOString().slice(0, 10);
    const cacheKey = "padelop:nutrition-ai-insight";
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.date === todayStr && cached?.mealCount === todayMeals.length) { setAiInsight({ score: cached.score, insight: cached.insight }); return; }
    } catch {}
    const matchToday = !!nextMatch && nextMatch.date === todayStr;
    const matchYesterday = (() => { try { const allR: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); const y = new Date(); y.setDate(y.getDate() - 1); return allR.some(r => r.ts.slice(0, 10) === y.toISOString().slice(0, 10)); } catch { return false; } })();
    const dayTypeForAi = matchToday ? "match" : matchYesterday ? "recovery" : "training";
    fetch("/api/nutrition-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meals: todayMeals.map(m => ({ time: m.time, description: m.description })), dayType: dayTypeForAi }) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.score != null && data?.insight) {
          setAiInsight(data);
          try { localStorage.setItem(cacheKey, JSON.stringify({ date: todayStr, mealCount: todayMeals.length, ...data })); } catch {}
          saveNutritionInsightToDb(todayStr, data.score, data.insight);
        }
      }).catch(() => {});
  }, [todayMeals, nextMatch]);

  const handleRacketImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string; setRacketImage(img);
      uploadGearImageToStorage("racket", img).then(url => {
        const src = url ?? img; setRacketImage(src);
        try { const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}"); localStorage.setItem("padelop:gear", JSON.stringify({ ...g, racketImage: src })); } catch {}
        if (url) saveGearToDb({ type: "racket", photo_url: url });
      });
    };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const handleShoeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string; setShoeImage(img);
      uploadGearImageToStorage("shoe", img).then(url => {
        const src = url ?? img; setShoeImage(src);
        try { const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}"); localStorage.setItem("padelop:gear", JSON.stringify({ ...g, shoeImage: src })); } catch {}
        if (url) saveGearToDb({ type: "shoe", photo_url: url });
      });
    };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const handleKitImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string; setKitImage(img);
      uploadGearImageToStorage("kit", img).then(url => {
        const src = url ?? img; setKitImage(src);
        try { const g = JSON.parse(localStorage.getItem("padelop:gear") || "{}"); localStorage.setItem("padelop:gear", JSON.stringify({ ...g, kitImage: src })); } catch {}
        if (url) saveGearToDb({ type: "kit", photo_url: url });
      });
    };
    reader.readAsDataURL(file); e.target.value = "";
  };

  // Derived values
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
  const pctColor = (p: number | null) => p === null ? "var(--c-hint)" : p >= 75 ? "var(--c-green)" : p >= 40 ? "var(--c-blue)" : "var(--c-red)";

  return (
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto flex flex-col gap-6">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="t-heading" style={{ color: "var(--c-text)", margin: 0 }}>Insights</h1>
      </div>

      {/* Featured insights */}
      {(() => {
        const wins   = reviews.filter(r => r.result === "win").length;
        const losses = reviews.filter(r => r.result === "loss").length;
        const last5  = [...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
        const last5Wins = last5.filter(r => r.result === "win").length;
        const topWellDone = (() => { const c: Record<string, number> = {}; reviews.flatMap(r => r.wellDone ?? []).forEach(t => { c[t] = (c[t] ?? 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0] ?? null; })();
        const topImprove  = (() => { const c: Record<string, number> = {}; reviews.flatMap(r => r.improved ?? []).forEach(t => { c[t] = (c[t] ?? 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0] ?? null; })();
        const pool: { label: string; body: string }[] = [
          reviews.length >= 3 && wins + losses > 0 ? { label: "Win rate", body: `You've won ${wins} out of ${wins + losses} recorded matches — a ${Math.round((wins / (wins + losses)) * 100)}% win rate. ${wins > losses ? "Keep it going." : "Every loss is data. Use it."}` } : null,
          last5.length >= 3 ? { label: "Recent form", body: `In your last ${last5.length} matches you won ${last5Wins}. ${last5Wins >= 3 ? "Strong run — confidence should be high." : last5Wins === 0 ? "Tough stretch. Look back at what you improved on and build from there." : "Mixed results — small consistency gains will tip the balance."}` } : null,
          topWellDone ? { label: "Your strength", body: `"${topWellDone[0]}" is the thing you've done well most often — flagged across ${topWellDone[1]} match${topWellDone[1] > 1 ? "es" : ""}. That's your weapon. Keep sharpening it.` } : null,
          topImprove  ? { label: "Your focus area", body: `"${topImprove[0]}" is the area you've logged as needing work most — ${topImprove[1]} time${topImprove[1] > 1 ? "s" : ""}. Targeted practice here will move your game the fastest.` } : null,
          streak > 0 ? { label: "Streak", body: streak >= 7 ? `${streak} days and counting. A week-plus streak means habits are forming.` : streak >= 3 ? `${streak}-day streak. You're building momentum. Don't break the chain.` : `${streak} day${streak > 1 ? "s" : ""} in a row. Log tomorrow and keep it going.` } : null,
          partnerCount >= 2 ? { label: "Partners", body: `You've played with ${partnerCount} different partners. Variety exposes you to different styles and speeds up adaptability.` } : null,
          trainingSessions.length > 0 ? { label: "Training", body: `${trainingSessions.length} training session${trainingSessions.length > 1 ? "s" : ""} logged. Players who train consistently between matches typically improve 2–3× faster.` } : null,
          thisWeekAvg !== null && lastWeekAvg !== null ? (() => {
            const band = (n: number) => n >= 85 ? "Strong" : n >= 75 ? "Good" : n >= 65 ? "Steady" : "Low";
            const avgPillar = (snaps: ScoreSnapshot[], key: keyof ScoreSnapshot) => snaps.length ? snaps.reduce((a, s) => a + (s[key] as number), 0) / snaps.length : 0;
            const pillars = ["recovery", "nutrition", "training", "wellbeing"] as const;
            const pillarNames: Record<string, string> = { recovery: "Recovery", nutrition: "Nutrition", training: "Training", wellbeing: "Wellbeing" };
            const deltas = pillars.map(p => ({ p, delta: avgPillar(thisWeekSnaps, p) - avgPillar(lastWeekSnaps, p) }));
            const bestGain  = deltas.filter(d => d.delta > 2).reduce((a, b) => b.delta > a.delta ? b : a, { p: "", delta: -Infinity });
            const worstDrop = deltas.filter(d => d.delta < -2).reduce((a, b) => b.delta < a.delta ? b : a, { p: "", delta: Infinity });
            const tl = band(thisWeekAvg!), ll = band(lastWeekAvg!);
            const body = tl === ll
              ? thisWeekAvg! > lastWeekAvg! ? `Still ${tl} — improved slightly${bestGain.p ? `, with ${pillarNames[bestGain.p].toLowerCase()} leading` : ""}. You're close to breaking into ${band(thisWeekAvg! + 5)} territory.`
              : thisWeekAvg! < lastWeekAvg! ? `Still ${tl}, but scores dipped slightly${worstDrop.p ? ` — ${pillarNames[worstDrop.p].toLowerCase()} was the weakest area` : ""}. Nothing alarming.`
              : `Exactly the same as last week — your routine is holding steady.`
              : thisWeekAvg! > lastWeekAvg! ? `You moved from ${ll} to ${tl} this week${bestGain.p ? ` — ${pillarNames[bestGain.p].toLowerCase()} improved the most` : ""}. That's real progress.`
              : `Scores dropped from ${ll} to ${tl}${worstDrop.p ? ` — ${pillarNames[worstDrop.p].toLowerCase()} took the biggest hit` : ""}. Focus on sleep and recovery.`;
            return { label: "Week on week", body };
          })() : null,
          tournamentCount > 0 ? { label: "Tournaments", body: `You've entered ${tournamentCount} tournament${tournamentCount > 1 ? "s" : ""}. Competitive pressure is one of the best accelerators.` } : null,
        ].filter((x): x is { label: string; body: string } => x !== null);
        if (!pool.length) return null;
        const idx = featuredIdx % pool.length;
        const insight = pool[idx];
        return (
          <div>
            <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px", textAlign: "center" }}>Featured insights</p>
            <button onClick={() => setFeaturedIdx(i => (i + 1) % pool.length)} style={{ width: "100%", background: "#fff", borderRadius: "var(--r-lg)", padding: "18px 20px", boxShadow: "var(--shadow-card)", border: "none", cursor: "pointer", textAlign: "left" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-blue)" }}>{insight.label}</p>
              <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500, color: "#2c3235", lineHeight: 1.65 }}>{insight.body}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 5 }}>{pool.map((_, i) => <div key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, background: i === idx ? "var(--c-blue)" : "#e2e5ea", transition: "width 0.2s" }} />)}</div>
                <span style={{ fontSize: 12, color: "var(--c-hint)", fontWeight: 500 }}>Tap for next</span>
              </div>
            </button>
          </div>
        );
      })()}

      {/* Padel Journey */}
      <div style={{ background: "#f8f9fa", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
        <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Padel Journey</p>
        {(profile.playingSince || journeyStart) && <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 16px", fontWeight: 500 }}>Started {profile.playingSince || journeyStart}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { value: reviews.length,          label: "Matches played",       color: "var(--c-blue)",   bg: "#f0f4ff" },
            { value: trainingSessions.length,  label: "Training sessions",    color: "var(--c-green)",  bg: "var(--c-green-bg)" },
            { value: partnerCount,             label: "Partners played with", color: "var(--c-teal)",   bg: "#f0fdfd" },
            { value: tournamentCount,          label: "Tournaments entered",  color: "var(--c-orange)", bg: "#fff7f0" },
          ].map(({ value, label, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: "var(--r-sm)", padding: "14px 12px" }}>
              <p className="t-stat" style={{ color, margin: 0, lineHeight: 1 }}>{value}</p>
              <p className="t-caption" style={{ color, margin: "5px 0 0", fontWeight: 600, opacity: 0.8 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* My Gear */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#fff", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-card)", border: "1px solid var(--c-line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
            <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>My Gear</p>
            <button onClick={() => setGearEditOpen(o => !o)} className="t-caption" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 500, color: "var(--c-forest)" }}>{gearEditOpen ? "Done" : "Edit"}</button>
          </div>
          <div ref={racketRowRef} style={{ display: "flex", alignItems: "stretch", padding: 12, gap: 14 }}>
            <label htmlFor="racket-img-upload" style={{ cursor: "pointer", flexShrink: 0, width: racketSlotSize, height: racketSlotSize, display: "block" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", background: "#f4f4f6", border: racketImage ? "none" : "1.5px dashed #dde0e4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {racketImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={racketImage} alt="Racket" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c4c7cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                }
              </div>
            </label>
            <input id="racket-img-upload" type="file" accept="image/*" className="hidden" onChange={handleRacketImage} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 0" }}>
              <span className="t-label" style={{ color: "var(--c-label)", display: "block", marginBottom: 8 }}>Current Racket</span>
              <p className="t-title" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1.2 }}>{racketName || "—"}</p>
              <p className="t-body" style={{ color: "var(--c-text-dim)", margin: "4px 0 0" }}>{racketType || "Add a description"}</p>
              <p className="t-caption" style={{ color: racketSince ? "var(--c-hint)" : "var(--c-disabled)", margin: "6px 0 0" }}>
                {racketSince ? `Using since ${new Date(racketSince + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "Using since —"}
              </p>
            </div>
          </div>
          {gearEditOpen && (
            <div style={{ borderTop: "1px solid #f0f0f0", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 0 6px" }}>Racket name</p>
                <input type="text" value={racketName} onChange={e => setRacketName(e.target.value)} placeholder="e.g. Bullpadel Vertex" className="t-body" style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "2px solid #e2e2e2", fontWeight: 500, color: "var(--c-text)", outline: "none", background: "var(--c-bg-input)" }} />
              </div>
              <div>
                <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 0 6px" }}>Type / description</p>
                <input type="text" value={racketType} onChange={e => setRacketType(e.target.value)} placeholder="e.g. Control, Power, Hybrid" className="t-body" style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "2px solid #e2e2e2", fontWeight: 500, color: "var(--c-text)", outline: "none", background: "var(--c-bg-input)" }} />
              </div>
              <div>
                <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 0 6px" }}>Using since</p>
                <input type="month" value={racketSince} onChange={e => setRacketSince(e.target.value)} className="t-body" style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "2px solid #e2e2e2", fontWeight: 500, color: "var(--c-text)", outline: "none", background: "var(--c-bg-input)" }} />
              </div>
              <button
                onClick={() => { localStorage.setItem("padelop:gear", JSON.stringify({ racketName, racketType, racketImage, racketSince, shoeImage, kitImage })); saveGearToDb({ type: "racket", name: racketName ?? undefined, racket_type: racketType ?? undefined, racket_since: racketSince ?? undefined, photo_url: racketImage?.startsWith("http") ? racketImage : undefined }); setGearEditOpen(false); }}
                className="t-ui" style={{ padding: 12, borderRadius: "var(--r-sm)", background: "var(--c-blue)", border: "none", cursor: "pointer", color: "#fff" }}
              >Save</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--c-line)", borderTop: "1px solid var(--c-line)" }}>
            <div style={{ background: "#fff", padding: 16, display: "flex", flexDirection: "column" }}>
              <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 12px" }}>My Shoes</p>
              <label htmlFor="shoe-img-upload" style={{ cursor: "pointer", display: "block", flex: 1 }}>
                <div style={{ aspectRatio: "1 / 1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--c-bg)", border: shoeImage ? "none" : "1.5px dashed var(--c-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {shoeImage
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={shoeImage} alt="Shoes" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17h20v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1z" /><path d="M2 17c0-3.5 2.5-6 6-6h2l3-2h3c2.2 0 4 1.5 4.5 3.5L21 17" /></svg>
                  }
                </div>
              </label>
              <input id="shoe-img-upload" type="file" accept="image/*" className="hidden" onChange={handleShoeImage} />
            </div>
            <div style={{ background: "#fff", padding: 16, display: "flex", flexDirection: "column" }}>
              <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 12px" }}>My Kit</p>
              <label htmlFor="kit-img-upload" style={{ cursor: "pointer", display: "block", flex: 1 }}>
                <div style={{ aspectRatio: "1 / 1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--c-bg)", border: kitImage ? "none" : "1.5px dashed var(--c-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {kitImage
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={kitImage} alt="Kit" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" /></svg>
                  }
                </div>
              </label>
              <input id="kit-img-upload" type="file" accept="image/*" className="hidden" onChange={handleKitImage} />
            </div>
          </div>
        </div>
      </section>

      {/* Streak */}
      {(() => {
        const TIERS = [
          { min: 0,   label: "Beginner",  color: "#9aa0a6", grad: ["#f4f4f6", "#eaecee"] },
          { min: 5,   label: "Starter",   color: "#2653d4", grad: ["#eef2ff", "#dbe4ff"] },
          { min: 15,  label: "Grinder",   color: "#059669", grad: ["#ecfdf5", "#d1fae5"] },
          { min: 30,  label: "Dedicated", color: "#d97706", grad: ["#fffbeb", "#fde68a"] },
          { min: 60,  label: "Elite",     color: "#7c3aed", grad: ["#faf5ff", "#ede9fe"] },
          { min: 100, label: "Legend",    color: "#0ea5e9", grad: ["#f0f9ff", "#bae6fd"] },
        ];
        const tier = [...TIERS].reverse().find(t => streak >= t.min) ?? TIERS[0];
        const nextTier = TIERS[TIERS.indexOf(tier) + 1];
        const message = streak === 0 ? "Log your first check-in to start your streak." : streak === 1 ? "Day one. Come back tomorrow to keep it going." : !nextTier ? "Legend status. You're in a league of your own." : `${nextTier.min - streak} day${nextTier.min - streak === 1 ? "" : "s"} to ${nextTier.label}.`;
        return (
          <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
            <div style={{ background: `linear-gradient(145deg, ${tier.grad[0]}, ${tier.grad[1]})`, padding: "32px 24px 24px", textAlign: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: tier.color }}>{tier.label}</span>
              <p style={{ margin: "8px 0 4px", fontSize: "clamp(56px, 14vw, 72px)", fontWeight: 800, color: tier.color, lineHeight: 1 }}>{streak}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tier.color, opacity: 0.7 }}>day streak</p>
              <p style={{ margin: "14px 0 0", fontSize: 14, fontWeight: 500, color: "#4b5563", lineHeight: 1.5 }}>{message}</p>
            </div>
            <div style={{ background: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
              {TIERS.map(t => {
                const active = t.label === tier.label;
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

      {/* Progress */}
      {(() => {
        const last30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); });
        const prev30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 30 - i); return d.toISOString().slice(0, 10); });
        const scoreHistory: ScoreSnapshot[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:score-history") || "[]"); } catch { return []; } })();
        const hydLogs: HydrationEntry[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]"); } catch { return []; } })();
        const habitsArr: HabitsEntry[] = (() => { try { const raw = localStorage.getItem("padelop:habits"); if (!raw) return []; const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })();
        const recentScores = scoreHistory.filter(s => last30.includes(s.date));
        const prevScores   = scoreHistory.filter(s => prev30.includes(s.date));
        const recentHyd  = hydLogs.filter(h => last30.includes(h.ts.slice(0, 10)));
        const prevHyd    = hydLogs.filter(h => prev30.includes(h.ts.slice(0, 10)));
        const recentH    = habitsArr.filter(h => last30.includes(h.date));
        const prevH      = habitsArr.filter(h => prev30.includes(h.date));
        const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const qualNum = (q: string) => q === "great" ? 1 : q === "ok" ? 0.6 : 0.3;
        const recoveryRate = recentH.length > 0 ? recentH.filter(h => h.foamRoll || h.lightWalk || h.coldShower).length / recentH.length : 0;
        const mobilityRate = recentH.length > 0 ? recentH.filter(h => h.mobility).length / recentH.length : 0;
        const hydPct   = recentHyd.length > 0 ? avg(recentHyd.map(h => qualNum(h.quality))) : 0.5;
        const sleepPct = recentScores.length > 0 ? Math.max(0, avg(recentScores.map(s => (s.recovery - 65) / 35))) : 0.5;
        const prevHydPct   = prevHyd.length > 0 ? avg(prevHyd.map(h => qualNum(h.quality))) : null;
        const prevMobRate  = prevH.length > 0 ? prevH.filter(h => h.mobility).length / prevH.length : null;
        const prevRecRate  = prevH.length > 0 ? prevH.filter(h => h.foamRoll || h.lightWalk || h.coldShower).length / prevH.length : null;
        const prevSleepPct = prevScores.length > 0 ? Math.max(0, avg(prevScores.map(s => (s.recovery - 65) / 35))) : null;
        const candidates = [
          prevHydPct   !== null ? { label: "Hydration consistency", delta: (hydPct       - prevHydPct)  * 100 } : null,
          prevMobRate  !== null ? { label: "Mobility consistency",   delta: (mobilityRate - prevMobRate) * 100 } : null,
          prevRecRate  !== null ? { label: "Recovery habits",        delta: (recoveryRate - prevRecRate) * 100 } : null,
          prevSleepPct !== null ? { label: "Sleep quality",          delta: (sleepPct     - prevSleepPct) * 100 } : null,
        ].filter((c): c is { label: string; delta: number } => c !== null && c.delta > 0).sort((a, b) => b.delta - a.delta);
        const topImprovement = candidates[0] ?? null;
        return (
          <>
            <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "18px 20px", boxShadow: "var(--shadow-card)" }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#1a1c1c" }}>Biggest improvement</p>
              {topImprovement
                ? <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 15, fontWeight: 600, color: "#2c3235" }}>{topImprovement.label}</span><span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>+{Math.round(topImprovement.delta)}%</span></div>
                : <p style={{ margin: 0, fontSize: 13, color: "#b0b8c1", fontWeight: 500 }}>Keep logging to compare your progress week over week.</p>
              }
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
        const doneTitles = schedDone[yesterdayStr] ?? [];
        let schedItems: ReturnType<typeof getScheduleData>["schedule"] = [];
        try { const tag = getTopNeedsWorkTag(); schedItems = getScheduleData("training", null, tag).schedule; } catch {}
        const schedTotal = schedItems.length;
        const schedDoneCount = schedItems.filter(s => doneTitles.includes(s.title)).length;
        const schedPct = schedTotal ? Math.round((schedDoneCount / schedTotal) * 100) : null;
        let meals: MealEntry[] = [];
        try { meals = (JSON.parse(localStorage.getItem("padelop:meal-log") || "[]") as MealEntry[]).filter(m => m.date === yesterdayStr); } catch {}
        const snap = deduped.find(s => s.date === yesterdayStr);
        let matchReview: ReviewEntry | null = null;
        try { matchReview = (JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]") as ReviewEntry[]).find(r => r.ts.slice(0, 10) === yesterdayStr) ?? null; } catch {}
        const hasYData = schedTotal > 0 || meals.length > 0 || snap;
        if (!hasYData) return null;
        const prevDays: string[] = [];
        for (let i = 2; i <= 9; i++) { const d = new Date(); d.setDate(d.getDate() - i); prevDays.push(d.toISOString().slice(0, 10)); }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>Yesterday&apos;s Summary</p>
                <span className="t-caption" style={{ color: "var(--c-hint)" }}>{yesterday.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
              </div>
              {schedTotal > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>Schedule</span>
                    <span className="t-body-sm" style={{ fontWeight: 700, color: pctColor(schedPct) }}>{schedDoneCount}/{schedTotal} tasks{schedPct !== null ? ` · ${schedPct}%` : ""}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${schedPct ?? 0}%`, borderRadius: 99, background: pctColor(schedPct), transition: "width 0.4s" }} />
                  </div>
                </div>
              )}
              {meals.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <span className="t-body-sm" style={{ fontWeight: 600, color: "var(--c-text)" }}>Food</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                    {meals.map(m => (
                      <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                        <span className="t-caption" style={{ color: "var(--c-text-sub)", lineHeight: 1.4 }}>{m.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(matchReview || snap) && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: "var(--c-green-bg)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-green)" }}>Went well</p>
                    <p className="t-caption" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                      {matchReview?.wellDone?.[0] ?? (snap ? (() => { const best = (["recovery", "training", "nutrition", "wellbeing"] as const).reduce((a, b) => (snap[a] ?? 0) > (snap[b] ?? 0) ? a : b); return `${best.charAt(0).toUpperCase() + best.slice(1)} was strong`; })() : "—")}
                    </p>
                  </div>
                  <div style={{ flex: 1, background: "#fffbeb", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#d97706" }}>To improve</p>
                    <p className="t-caption" style={{ color: "var(--c-text)", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                      {matchReview?.improved?.[0] ?? (snap ? (() => { const pillars = ["recovery", "training", "nutrition", "wellbeing"] as const; const best = pillars.reduce((a, b) => (snap[a] ?? 0) > (snap[b] ?? 0) ? a : b); const worst = pillars.filter(p => p !== best).reduce((a, b) => (snap[a] ?? 100) < (snap[b] ?? 100) ? a : b); return `${worst.charAt(0).toUpperCase() + worst.slice(1)} could be better`; })() : "—")}
                    </p>
                  </div>
                </div>
              )}
              {prevDays.some(d => schedDone[d]?.length || deduped.find(s => s.date === d)) && (
                <>
                  <button onClick={() => setPrevDaysOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-hint)" }}>Prev days</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-hint)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: prevDaysOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {prevDaysOpen && <div style={{ marginTop: 8 }}><PrevDaysList days={prevDays} schedDone={schedDone} deduped={deduped} pctColor={pctColor} /></div>}
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
            const state = pillarStates[row.key];
            const meta = STATUS_META[state.status];
            const sparkData = last14.map(s => s[row.key] as number);
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
          {thisWeekAvg !== null && lastWeekAvg !== null
            ? <span className="t-body-sm" style={{ fontWeight: 700, color: thisWeekAvg >= lastWeekAvg ? "var(--c-green)" : "var(--c-red)" }}>{thisWeekAvg >= lastWeekAvg ? "▲" : "▼"} {Math.abs(thisWeekAvg - lastWeekAvg)} pts vs last week</span>
            : <span className="t-caption" style={{ color: "var(--c-hint)" }}>last week: {lastWeekAvg ?? "–"}</span>
          }
        </div>
      )}

      {/* Strengths & Focus Areas */}
      {reviews.length > 0 && (() => {
        const countTags = (tags: string[]) => { const c: Record<string, number> = {}; tags.forEach(t => { c[t] = (c[t] ?? 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
        const strengths  = countTags(reviews.flatMap(r => r.wellDone ?? [])).slice(0, 6);
        const focusAreas = countTags(reviews.flatMap(r => r.improved ?? [])).slice(0, 6);
        if (!strengths.length && !focusAreas.length) return null;
        const maxS = strengths[0]?.[1] ?? 1, maxF = focusAreas[0]?.[1] ?? 1;
        return (
          <div style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "20px", boxShadow: "var(--shadow-card)" }}>
            <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 16px" }}>Game Profile</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                { title: "Strengths", items: strengths, color: "var(--c-green)", max: maxS },
                { title: "Focus Areas", items: focusAreas, color: "var(--c-amber)", max: maxF },
              ] as const).map(({ title, items, color, max }) => (
                <div key={title}>
                  <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color }}>{title}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {items.length ? items.map(([tag, count]) => (
                      <div key={tag}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>{tag}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color, opacity: 0.7 }}>{count}×</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(count / max) * 100}%`, borderRadius: 99, background: color }} />
                        </div>
                      </div>
                    )) : <p className="t-caption" style={{ color: "var(--c-hint)" }}>None logged yet</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Food & Hydration */}
      {(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const viewDate = selectedFoodDate ?? todayStr;
        const isToday = viewDate === todayStr;
        const viewMeals: MealEntry[] = isToday ? todayMeals : (() => { try { return (JSON.parse(localStorage.getItem("padelop:meal-log") || "[]") as MealEntry[]).filter(m => m.date === viewDate); } catch { return []; } })();
        const analysis = analyzeMeals(viewMeals);
        const displayScore = isToday && aiInsight ? aiInsight.score : analysis.score;
        const grade = foodGrade(displayScore);
        const matchToday2 = !!nextMatch && nextMatch.date === todayStr;
        const matchYesterday2 = (() => { try { const allR: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); const y = new Date(); y.setDate(y.getDate() - 1); return allR.some(r => r.ts.slice(0, 10) === y.toISOString().slice(0, 10)); } catch { return false; } })();
        const dayTypeLocal: "match" | "recovery" | "training" = matchToday2 ? "match" : matchYesterday2 ? "recovery" : "training";
        const coverage = compareMealsToSchedule(viewMeals, dayTypeLocal);
        const barMax = Math.max(...foodHistory.map(d => d.score), 1);
        const dateLabel = isToday ? "Today" : new Date(viewDate + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        const LITRE_MID: Record<string, number> = { "<1L": 0.75, "1–1.5L": 1.25, "1.5–2L": 1.75, "2–2.5L": 2.25, "2.5–3L": 2.75, "3L+": 3.25 };
        let hydLogs2: { ts: string; litres: string }[] = [];
        try { hydLogs2 = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]"); } catch {}
        const hydAvg2 = (entries: typeof hydLogs2) => { const vals = entries.map(e => LITRE_MID[e.litres]).filter(v => v !== undefined); return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null; };
        const hyd7 = hydAvg2(hydLogs2.filter(e => Date.now() - new Date(e.ts).getTime() < 7 * 864e5));
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
                  const isSelected = date === viewDate, isT = date === todayStr;
                  const h = barMax > 0 ? Math.max(4, (score / barMax) * 36) : 4;
                  const barColor = isT ? grade.color : score >= 65 ? "#bbf7d0" : score > 0 ? "#fed7aa" : "#f0f0f0";
                  return (
                    <button key={date} onClick={() => setSelectedFoodDate(isSelected && !isT ? null : date)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 44, background: "none", border: "none", cursor: "pointer", padding: "0 0 4px", gap: 3 }}>
                      <div style={{ width: "100%", height: h, borderRadius: 3, background: barColor, outline: isSelected ? `2px solid ${barColor === "#f0f0f0" ? "#b0b8c1" : barColor}` : "none", outlineOffset: 2, transition: "height 0.3s" }} />
                      {isSelected && <div style={{ width: 4, height: 4, borderRadius: "50%", background: barColor === "#f0f0f0" ? "#b0b8c1" : barColor, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[{ label: "Protein", active: analysis.protein }, { label: "Veg", active: analysis.veg }, { label: "Carbs", active: analysis.carbs }].map(({ label, active }) => (
                <span key={label} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: active ? "#f0fdf4" : "#f4f4f6", color: active ? "#16a34a" : "#b0b8c1", border: active ? "1px solid #bbf7d0" : "1px solid #e8eaed" }}>{active ? "✓ " : ""}{label}</span>
              ))}
            </div>
            {isToday && aiInsight && (
              <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color: "#2653d4" }}>AI Assessment</p>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>Weekly Shopping List</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          </div>
        );
      })()}

    </div>
  );
}
