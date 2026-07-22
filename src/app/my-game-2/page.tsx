"use client";

import React, { useState, useEffect } from "react";
import { getScheduleData, getDayType, type DayType } from "@/lib/schedule-data";
import { computeScores, loadScoringData, type ReviewEntry } from "@/lib/scoring";
import { hydrateFromSupabase } from "@/lib/sync";

type StoredMatch = { date: string; time: string; club?: string; court?: string };

function readHydrationMl(): number {
  const today = new Date().toISOString().slice(0, 10);
  const LITRE_ML: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
  try {
    const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
    if (hq?.date === today && typeof hq.ml === "number" && hq.ml > 0) return hq.ml;
    const logs: { ts: string; litres: string }[] = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
    const todayLog = logs.find(e => new Date(e.ts).toISOString().slice(0, 10) === today);
    if (todayLog) return LITRE_ML[todayLog.litres] ?? 0;
    const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
    if (ci?.date === today && ci?.waterOnWaking === true) return 500;
  } catch {}
  return 0;
}

const DAY_META: Record<DayType, { label: string; color: string }> = {
  match:        { label: "Match Day",       color: "#2653d4" },
  "pre-match":  { label: "Pre-Match Day",   color: "#d97706" },
  recovery:     { label: "Recovery Day",    color: "#7c3aed" },
  training:     { label: "Training Day",    color: "#16a34a" },
  maintenance:  { label: "Maintenance Day", color: "#0e7490" },
  baseline:     { label: "Training Day",    color: "#16a34a" },
};

function Row({ color, title, value, sub }: { color: string; title: string; value: React.ReactNode; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, padding: "12px 14px", background: "#fff", boxShadow: "0 0 0 1px #f0f0f0" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1e` }}>
        <div style={{ width: 13, height: 13, borderRadius: "50%", background: color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px", color }}>{title}</p>
        <p style={{ fontSize: "clamp(17px, 4.4vw, 20px)", fontWeight: 700, margin: 0, lineHeight: 1.25, color: "#1a1c1c" }}>{value}</p>
        <p style={{ fontSize: "clamp(12px, 3.1vw, 14px)", margin: "2px 0 0", color: "#6b7480" }}>{sub}</p>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 12px", marginBottom: 20 }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#b0b8c1", margin: "0 0 4px 4px" }}>{label}</p>
      {children}
    </div>
  );
}

export default function MyGame2Page() {
  const [dayType, setDayType] = useState<DayType>("training");
  const [nextMatch, setNextMatch] = useState<StoredMatch | null>(null);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [scheduleDone, setScheduleDone] = useState(0);
  const [readiness, setReadiness] = useState(65);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [insightsCount, setInsightsCount] = useState(0);
  const [patternsCount, setPatternsCount] = useState(0);

  useEffect(() => {
    hydrateFromSupabase();
    let lastSync = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 30_000) {
        lastSync = Date.now();
        hydrateFromSupabase();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    function load() {
      const todayKey = new Date().toISOString().slice(0, 10);

      let nm: StoredMatch | null = null;
      try { nm = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}
      setNextMatch(nm);

      let upcoming: StoredMatch[] = [];
      try { upcoming = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]"); } catch {}
      let gameDays: string[] = [];
      try { gameDays = JSON.parse(localStorage.getItem("padelop:game-days") || "[]"); } catch {}
      const dt = getDayType(gameDays, nm, upcoming);
      setDayType(dt);

      const matchTime = nm?.date === todayKey ? nm.time : null;
      const { schedule } = getScheduleData(dt === "baseline" ? "training" : dt, matchTime, null);
      setScheduleTotal(schedule.length);

      let schedDone: Record<string, string[]> = {};
      try { schedDone = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}"); } catch {}
      setScheduleDone((schedDone[todayKey] ?? []).length);
      setLifetimePoints(Object.values(schedDone).flat().length);

      const d = loadScoringData();
      setReadiness(computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training).overall);

      let reviews: ReviewEntry[] = [];
      try { reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); } catch {}
      const wins = reviews.filter(r => r.result === "win").length;
      const decided = reviews.filter(r => r.result === "win" || r.result === "loss").length;
      setWinRate(decided > 0 ? Math.round((wins / decided) * 100) : null);
      const wellCount = reviews.flatMap(r => r.wellDone ?? []).length;
      const badCount = reviews.flatMap(r => r.improved ?? []).length;
      setInsightsCount(wellCount + badCount);
      setPatternsCount(wellCount + badCount);

      let habitDates = new Set<string>();
      try {
        const habits: { date: string }[] = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
        habitDates = new Set(habits.map(h => h.date));
      } catch {}
      const cur = new Date();
      if (!habitDates.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
      let streakCount = 0;
      while (habitDates.has(cur.toISOString().slice(0, 10))) { streakCount++; cur.setDate(cur.getDate() - 1); }
      setStreak(streakCount);

      setHydrationMl(readHydrationMl());
    }

    load();
    window.addEventListener("storage", load);
    window.addEventListener("padelop:sync-done", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("padelop:sync-done", load);
    };
  }, []);

  const meta = DAY_META[dayType];
  const today = new Date().toISOString().slice(0, 10);
  const nmDiff = nextMatch ? Math.round((new Date(nextMatch.date + "T12:00").getTime() - new Date(today + "T12:00").getTime()) / 86400000) : null;
  const nmValue = nmDiff === null ? "—" : nmDiff === 0 ? "Today" : nmDiff === 1 ? "Tmrw" : `${nmDiff}d`;
  const hydrationPct = Math.round(Math.min(hydrationMl / 3000, 1) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f6", paddingBottom: 100 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 32px" }}>
        <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: `${meta.color}18`, color: meta.color }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 13, color: "#b0b8c1", fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        <Section label="Today">
          <Row color="#2653d4" title="Next Match" value={nmValue} sub={nextMatch ? (nextMatch.time + (nextMatch.club ? ` · ${nextMatch.club}` : "")) : "None scheduled"} />
          <Row color="#16a34a" title="Schedule" value={`${scheduleDone}/${scheduleTotal}`} sub="completed today" />
          <Row color="#7c3aed" title="Form" value={readiness} sub="overall readiness" />
        </Section>

        <Section label="Lifetime">
          <Row color="#1a1c1c" title="Padla Pts" value={lifetimePoints > 0 ? lifetimePoints : "—"} sub="tasks completed" />
          <Row color="#f59e0b" title="Streak" value={streak > 0 ? streak : "—"} sub={streak > 0 ? "days in a row" : "start today"} />
          <Row color="#dc2626" title="Win Rate" value={winRate !== null ? `${winRate}%` : "—"} sub={winRate !== null ? (winRate >= 60 ? "strong" : winRate >= 40 ? "building" : "keep going") : "no matches logged"} />
        </Section>

        <Section label="Wellness">
          <Row color="#0ea5e9" title="Hydration" value={hydrationMl > 0 ? `${hydrationMl}ml` : "—"} sub={hydrationMl > 0 ? `${hydrationPct}% of 3L goal` : "not logged today"} />
          <Row color="#f59e0b" title="Insights" value={insightsCount > 0 ? insightsCount : "—"} sub="available from match reviews" />
          <Row color="#e11d48" title="Patterns" value={patternsCount > 0 ? patternsCount : "—"} sub="tags logged" />
        </Section>
      </div>
    </div>
  );
}
