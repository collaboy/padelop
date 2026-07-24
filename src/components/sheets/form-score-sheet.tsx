"use client";

import React from "react";
import { computeFormScore } from "@/lib/scoring";

export default function FormScoreContent() {
  const { components } = computeFormScore();
  const todayYMD2 = new Date().toISOString().slice(0, 10);

  const snapHistory: { date: string; recovery: number; wellbeing: number }[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:score-history") || "[]"); } catch { return []; } })();
  const cutoff7s = new Date(); cutoff7s.setDate(cutoff7s.getDate() - 7);
  const recentCheckins = snapHistory.filter(s => s.date >= cutoff7s.toISOString().slice(0, 10) && s.date <= todayYMD2).length;

  const matchRevs: { result: string }[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); } catch { return []; } })();
  const last5 = matchRevs.slice(0, 5);
  const mWins = last5.filter(r => r.result === "win").length;
  const mLosses = last5.filter(r => r.result === "loss").length;
  const mDraws = last5.filter(r => r.result === "draw").length;

  const sdLocal: Record<string, string[]> = (() => { try { return JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}"); } catch { return {}; } })();
  let ciDays = 0, sdDays = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); if (snapHistory.some(s => s.date === ds)) ciDays++; if (sdLocal[ds]?.length > 0) sdDays++; }

  const ACTIVITY_TITLES = new Set([
    "Mobility Exercise", "Light mobility", "Warm up", "Cool down", "Stretch",
    "Mental prep", "Visualisation", "Short walk", "Active recovery", "Rest",
  ]);
  const gdLocal: string[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:game-days") || "[]"); } catch { return []; } })();
  const gameDaySet = new Set(gdLocal);
  let activeDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (gameDaySet.has(ds) || (sdLocal[ds] ?? []).some(t => ACTIVITY_TITLES.has(t))) activeDays++;
  }

  const LMAP: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
  const hLogs2: { ts: string; litres: string }[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]"); } catch { return []; } })();
  const hq2 = (() => { try { return JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null"); } catch { return null; } })();
  const mlMap: Record<string, number> = {};
  hLogs2.forEach(h => { mlMap[new Date(h.ts).toISOString().slice(0, 10)] = LMAP[h.litres] ?? 0; });
  if (hq2?.date === todayYMD2 && typeof hq2.ml === "number" && hq2.ml > 0) mlMap[todayYMD2] = hq2.ml;
  const hDays: number[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); if (mlMap[ds] != null) hDays.push(mlMap[ds]); }
  const avgL = hDays.length > 0 ? (hDays.reduce((a, b) => a + b, 0) / hDays.length / 1000).toFixed(1) : null;

  const rows: { label: string; value: number | null; weight: string; context: string; action: string | null }[] = [
    {
      label: "Body", value: components.body, weight: "30%",
      context: recentCheckins < 2 ? `${recentCheckins} morning log this week` : `Sleep, energy & recovery · ${recentCheckins} of 7 days logged`,
      action: recentCheckins < 2 ? "Do your morning check-in — need 2+ days" : null,
    },
    {
      label: "Match form", value: components.matchForm, weight: "25%",
      context: last5.length === 0 ? "No match reviews yet" : `Last ${last5.length} match${last5.length > 1 ? "es" : ""} · ${mWins}W ${mLosses}L${mDraws > 0 ? ` ${mDraws}D` : ""}`,
      action: last5.length === 0 ? "Log a match result to unlock" : null,
    },
    {
      label: "Consistency", value: components.consistency, weight: "20%",
      context: (ciDays === 0 && sdDays === 0) ? "Nothing logged this week" : `${ciDays}/7 days checked in · ${sdDays} schedule days done`,
      action: ciDays === 0 ? "Do your morning check-in" : null,
    },
    {
      label: "Activity", value: components.activity, weight: "15%",
      context: activeDays === 0 ? "No matches or exercises in 14 days" : `${activeDays}/14 days with a match or exercise`,
      action: activeDays === 0 ? "Complete a warm up, stretch or walk" : null,
    },
    {
      label: "Hydration", value: components.hydration, weight: "10%",
      context: avgL === null ? "No hydration logged this week" : `7-day avg · ${avgL}L/day`,
      action: avgL === null ? "Log water intake in check-in" : null,
    },
  ];

  const scoreBar = (v: number) => {
    const c = v >= 70 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: "#ebebeb" }}>
          <div style={{ width: `${v}%`, height: "100%", borderRadius: 99, background: c, transition: "width 0.4s" }} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: c, minWidth: 24, textAlign: "right" }}>{v}</span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: "0 0 4px", fontSize: 18, color: "#6b7480", lineHeight: 1.5 }}>
        Overall Form is a weighted average of five things below — how your body&apos;s feeling, recent match results, how consistently you&apos;re logging, how active you&apos;ve been, and hydration. Each is scored 0–100 from your last 1–2 weeks, then blended by its weight, so a bad day won&apos;t tank it but a bad stretch will show.
      </p>
      {rows.map(r => (
        <div key={r.label} style={{ background: "#f8f9fa", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 21, fontWeight: 700, color: "#1a1c1c" }}>{r.label}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#c8cdd4" }}>{r.weight}</span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 18, color: r.value === null ? "#c0c7d0" : "#6b7480", lineHeight: 1.4 }}>
            {r.value === null ? (r.action ?? r.context) : r.context}
          </p>
          {r.value !== null && scoreBar(r.value)}
          {r.value !== null && r.action && (
            <p style={{ margin: "6px 0 0", fontSize: 17, fontWeight: 600, color: "#d97706" }}>{r.action}</p>
          )}
        </div>
      ))}
    </div>
  );
}
