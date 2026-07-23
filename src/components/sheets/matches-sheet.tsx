"use client";

import React, { useState, useEffect } from "react";
import type { ReviewEntry } from "@/lib/scoring";
import { saveUpcomingMatch, deleteUpcomingMatchFromDb } from "@/lib/db";

type StoredMatch = {
  date: string; time: string; club: string; court?: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};
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
  return { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${filled ? "#2653d4" : "#e2e2e2"}`, background: filled ? "#f4f6ff" : "#fff", fontSize: 32, color: "#1a1c1c", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
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
          <p style={{ fontSize: 22, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>DATE</p>
          <input type="date" value={form.date} onChange={set("date")} style={mfInputStyle(!!form.date)} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>TIME</p>
          <input type="time" value={form.time} onChange={set("time")} style={mfInputStyle(!!form.time)} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>CLUB</p>
        <input type="text" placeholder="e.g. Club Padel BCN" value={form.club} onChange={set("club")} style={mfInputStyle(!!form.club)} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>COURT</p>
        <input type="text" placeholder="e.g. 3" value={form.court} onChange={set("court")} style={mfInputStyle(!!form.court)} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>PLAYERS</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["p1", "p2", "p3", "p4"] as const).map((k, i) => (
            <input key={k} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={form[k]} onChange={set(k)} style={mfInputStyle(!!form[k])} />
          ))}
        </div>
      </div>
      <button onClick={onSave} disabled={!valid} style={{ marginTop: 4, padding: "13px", borderRadius: 16, border: "none", cursor: valid ? "pointer" : "default", fontSize: 30, fontWeight: 700, color: "#fff", background: valid ? saveColor : "#c4c7c7" }}>{saveLabel}</button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: "10px", borderRadius: 16, border: "1.5px solid #fee2e2", background: "#fff5f5", fontSize: 28, fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>Delete match</button>
      )}
    </div>
  );
}

export default function MatchesContent() {
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<StoredMatch[]>([]);
  const [matchExpandedIdx, setMatchExpandedIdx] = useState<number | null>(null);
  const [matchAddOpen, setMatchAddOpen] = useState(false);
  const [matchEditForms, setMatchEditForms] = useState<Record<number, MatchForm>>({});
  const [matchHistoryOpen, setMatchHistoryOpen] = useState(false);
  const [matchAddForm, setMatchAddForm] = useState<MatchForm>(EMPTY_FORM);
  const [matchRecordExpanded, setMatchRecordExpanded] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewEntry | null>(null);

  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem("padelop:match-reviews");
        setReviews(raw ? (JSON.parse(raw) as ReviewEntry[]).sort((a, b) => b.ts.localeCompare(a.ts)) : []);
      } catch { setReviews([]); }
      try {
        const all: StoredMatch[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
        const today2 = new Date().toISOString().slice(0, 10);
        const upcoming2 = all.filter(m => m.date >= today2).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        setUpcomingMatches(upcoming2);
        const forms: Record<number, MatchForm> = {};
        upcoming2.forEach((m, i) => { forms[i] = { date: m.date, time: m.time, club: m.club || "", court: m.court || "", p1: m.player_1 || "", p2: m.player_2 || "", p3: m.player_3 || "", p4: m.player_4 || "" }; });
        setMatchEditForms(forms);
      } catch {}
    }
    load();
    window.addEventListener("storage", load);
    window.addEventListener("padelop:sync-done", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("padelop:sync-done", load);
    };
  }, []);

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
    const m = upcomingMatches[idx];
    matchSaveList(upcomingMatches.filter((_, i) => i !== idx));
    if (m) deleteUpcomingMatchFromDb(m.date, m.time ?? "");
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

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reviews.length > 0 && (() => {
          const last7 = reviews.slice(0, 7);
          const wins = last7.filter(r => r.result === "win").length;
          const winRate = Math.round((wins / last7.length) * 100);
          const ringColor = winRate >= 60 ? "#16a34a" : winRate >= 40 ? "#f59e0b" : "#dc2626";
          const rr = 56, stroke = 9, size = 140;
          const circ = 2 * Math.PI * rr;
          const offset = circ * (1 - winRate / 100);
          return (
            <div style={{ padding: "4px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <svg width={size} height={size}>
                  <circle cx={size / 2} cy={size / 2} r={rr} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
                  <circle cx={size / 2} cy={size / 2} r={rr} fill="none" stroke={ringColor} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 56, fontWeight: 800, color: "#1a1c1c", lineHeight: 1 }}>{winRate}%</span>
                  <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096" }}>wins</span>
                </div>
              </div>
              <button
                onClick={() => setMatchRecordExpanded(v => !v)}
                style={{ margin: 0, width: "100%", fontSize: 30, fontWeight: 700, color: "#3a4550", background: "#f8f9fa", border: "none", borderRadius: 14, padding: "16px 14px", cursor: "pointer", textAlign: "center" }}
              >
                You&rsquo;ve won {wins} out of the last {last7.length} games...
              </button>
              {matchRecordExpanded && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                  {last7.map((rev, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 600, color: "#8a9096", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {new Date(rev.ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      <div style={{ height: 22, borderRadius: 8, display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, background: rev.result === "win" ? "#dcfce7" : rev.result === "draw" ? "#fef9c3" : "#fee2e2" }}>
                        <span style={{ fontSize: 22, fontWeight: 700, textTransform: "capitalize", color: rev.result === "win" ? "#16a34a" : rev.result === "draw" ? "#a16207" : "#dc2626" }}>
                          {rev.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {matchAddOpen && (
          <div style={{ background: "#f8f9fa", borderRadius: 14, padding: "14px 14px" }}>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#1a1c1c" }}>New match</p>
            <MatchFormWidget form={matchAddForm} onChange={setMatchAddForm} onSave={matchSaveAdd} saveLabel="Save match" saveColor="#16a34a" />
          </div>
        )}
        {upcomingMatches.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: "4px 4px 0", fontSize: 22, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>UPCOMING</p>
            {upcomingMatches.map((m, idx) => {
              const expanded = matchExpandedIdx === idx;
              const form = matchEditForms[idx] ?? EMPTY_FORM;
              const players = [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean);
              const countdown = fmtCountdown(m.date, m.time);
              const isToday2 = countdown === "Today";
              return (
                <div key={idx} style={{ background: "#f8f9fa", borderRadius: 14, overflow: "hidden" }}>
                  <button onClick={() => { setMatchExpandedIdx(expanded ? null : idx); setMatchAddOpen(false); }} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                    <div style={{ flexShrink: 0, width: 84, textAlign: "center", background: isToday2 ? "#eef2ff" : "#fff", borderRadius: 12, padding: "8px 4px" }}>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 40, fontWeight: 900, color: isToday2 ? "#2653d4" : "#1a1c1c", lineHeight: 1 }}>{new Date(m.date + "T12:00").getDate()}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 600, color: isToday2 ? "#2653d4" : "#8a9096", lineHeight: 1 }}>{new Date(m.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 30, fontWeight: 800, color: "#1a1c1c" }}>{m.time || "—"}</span>
                        {m.club && <span style={{ fontSize: 28, color: "#8a9096", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {m.club}{m.court ? ` #${m.court}` : ""}</span>}
                      </div>
                      {players.length > 0 && <p style={{ margin: 0, fontSize: 28, color: "#8a9096", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{players.join(", ")}</p>}
                      <span style={{ display: "inline-block", marginTop: 5, fontSize: 22, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isToday2 ? "#eef2ff" : "#f4f6f8", color: isToday2 ? "#2653d4" : "#8a9096" }}>{countdown}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  {expanded && (
                    <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f0f2f5" }}>
                      <MatchFormWidget form={form} onChange={f => setMatchEditForms(prev => ({ ...prev, [idx]: f }))} onSave={() => matchSaveEdit(idx)} onDelete={() => matchDelete(idx)} saveLabel="Save changes" saveColor="#2653d4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !matchAddOpen && (
          <div style={{ background: "#f8f9fa", borderRadius: 14, padding: "22px 18px", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 30, fontWeight: 800, color: "#1a1c1c" }}>No upcoming matches</p>
            <p style={{ margin: "0 0 14px", fontSize: 28, color: "#8a9096" }}>Schedule your next game</p>
          </div>
        )}
        <button
          onClick={() => { setMatchAddOpen(o => !o); setMatchExpandedIdx(null); if (!matchAddOpen) setMatchAddForm(EMPTY_FORM); }}
          style={{ alignSelf: "flex-start", background: matchAddOpen ? "#e8edf8" : "#2653d4", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 28, fontWeight: 700, color: matchAddOpen ? "#2653d4" : "#fff", cursor: "pointer" }}
        >
          {matchAddOpen ? "Cancel" : "+ Add"}
        </button>
        {reviews.length > 0 && (
          <div style={{ background: "#f8f9fa", borderRadius: 14, overflow: "hidden" }}>
            <button onClick={() => setMatchHistoryOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>HISTORY</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: "#b0b8c1" }}>{reviews.length} match{reviews.length !== 1 ? "es" : ""}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: matchHistoryOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>
            {matchHistoryOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingBottom: 8 }}>
                {[...reviews].sort((a, b) => b.ts.localeCompare(a.ts)).map((r, i) => {
                  const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
                  const resultBg = r.result === "win" ? "#f0fdf4" : r.result === "loss" ? "#fff5f5" : "#f4f6f8";
                  const opponentNames = typeof (r as ReviewEntry & { opponentNames?: string }).opponentNames === "string" && (r as ReviewEntry & { opponentNames?: string }).opponentNames ? (r as ReviewEntry & { opponentNames?: string }).opponentNames : null;
                  return (
                    <button key={i} onClick={() => setSelectedReview(r)} style={{ width: "calc(100% - 16px)", alignSelf: "center", background: "#fff", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, border: "none", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ flexShrink: 0, width: 76, textAlign: "center", background: "#f8f9fa", borderRadius: 10, padding: "6px 4px" }}>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#8a9096" }}>{new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                        <p style={{ margin: "1px 0 0", fontSize: 36, fontWeight: 900, color: "#1a1c1c", lineHeight: 1 }}>{new Date(r.ts.slice(0, 10) + "T12:00").getDate()}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {opponentNames ? (
                          <p style={{ margin: "0 0 2px", fontSize: 30, fontWeight: 700, color: "#1a1c1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>vs {opponentNames}</p>
                        ) : (
                          r.feeling && <p style={{ margin: "0 0 2px", fontSize: 28, color: "#8a9096" }}>{r.feeling}</p>
                        )}
                        {(r.wellDone?.length > 0 || r.improved?.length > 0) && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                            {r.wellDone?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 20, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#f0fdf4", color: "#16a34a" }}>{t}</span>)}
                            {r.improved?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 20, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#fff5f5", color: "#ef4444" }}>{t}</span>)}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        {r.result && <span style={{ fontSize: 22, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: resultBg, color: resultColor }}>{r.result.charAt(0).toUpperCase() + r.result.slice(1)}</span>}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedReview && (() => {
        const r = selectedReview;
        const opponentNames = typeof (r as ReviewEntry & { opponentNames?: string }).opponentNames === "string" ? (r as ReviewEntry & { opponentNames?: string }).opponentNames : "";
        const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
        const resultBg = r.result === "win" ? "#f0fdf4" : r.result === "loss" ? "#fff5f5" : "#f4f6f8";
        const dateStr = new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
        const FEELING_LABEL: Record<string, string> = { great: "Felt great", ok: "Felt OK", bad: "Felt rough" };
        const ENERGY_LABEL: Record<string, string> = { high: "High energy", mid: "Medium energy", low: "Low energy" };
        const MENTAL_LABEL: Record<string, string> = { calm: "Calm", focused: "Focused", nervous: "Nervous", overwhelmed: "Overwhelmed", confident: "Confident" };
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
              style={{ borderRadius: "28px 28px 0 0", maxHeight: "88dvh", minHeight: "55dvh", animation: "reviewUp 0.32s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -4px 40px rgba(0,0,0,0.18)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#e2e2e2]" />
              </div>
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
              <div className="overflow-y-auto flex-1 px-6 pb-8 flex flex-col gap-5" style={{ overscrollBehavior: "contain" }}>
                {r.notes && (
                  <div className="p-4 rounded-2xl" style={{ background: "#fff" }}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0] mb-2">Notes</p>
                    <p className="text-[15px] text-[#1a1c1c] leading-relaxed">{r.notes}</p>
                  </div>
                )}
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
                {(r.feeling || r.energy || r.mentalBefore || r.mentalDuring || r.mentalAfter) && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa5b0]">On the day</p>
                    <div className="flex flex-wrap gap-2">
                      {r.feeling && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">{FEELING_LABEL[r.feeling] ?? r.feeling}</span>}
                      {r.energy && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">{ENERGY_LABEL[r.energy] ?? r.energy}</span>}
                      {r.mentalBefore && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">Before: {MENTAL_LABEL[r.mentalBefore] ?? r.mentalBefore}</span>}
                      {r.mentalDuring && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">During: {MENTAL_LABEL[r.mentalDuring] ?? r.mentalDuring}</span>}
                      {r.mentalAfter && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-[#f4f6f8] text-[#4a5050]">After: {MENTAL_LABEL[r.mentalAfter] ?? r.mentalAfter}</span>}
                      {r.injury && r.injury !== "no" && <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full" style={{ background: "#fff7ed", color: "#c2410c" }}>Injury: {r.injury}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
