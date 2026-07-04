"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startNavLoad } from "@/lib/nav-events";
import { saveUpcomingMatch } from "@/lib/db";
import { hydrateFromSupabase } from "@/lib/sync";

type StoredMatch = {
  date: string; time: string; club: string; court: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};

type ReviewEntry = {
  ts: string; result: string; feeling: string; energy: string;
  wellDone: string[]; improved: string[]; opponent?: string; opponentNames?: string;
};

type Form = { date: string; time: string; club: string; court: string; p1: string; p2: string; p3: string; p4: string };

const EMPTY_FORM: Form = { date: "", time: "", club: "", court: "", p1: "", p2: "", p3: "", p4: "" };

function fmtDate(d: string) {
  return new Date(d + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtCountdown(date: string, time: string) {
  const now = new Date();
  const match = new Date(date + "T" + (time || "00:00"));
  const diff = match.getTime() - now.getTime();
  if (diff < 0) return "Past";
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function inputStyle(filled: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "10px 12px", borderRadius: 12,
    border: `1.5px solid ${filled ? "#2653d4" : "#e2e2e2"}`,
    background: filled ? "#f4f6ff" : "#f8f9fa",
    fontSize: 16, color: "#1a1c1c", outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
}

function MatchForm({ form, onChange, onSave, onDelete, saveLabel, saveColor }: {
  form: Form;
  onChange: (f: Form) => void;
  onSave: () => void;
  onDelete?: () => void;
  saveLabel: string;
  saveColor: string;
}) {
  const valid = !!(form.date && form.time);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [k]: e.target.value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>DATE</p>
          <input type="date" value={form.date} onChange={set("date")} style={inputStyle(!!form.date)} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>TIME</p>
          <input type="time" value={form.time} onChange={set("time")} style={inputStyle(!!form.time)} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>CLUB</p>
        <input type="text" placeholder="e.g. Club Padel BCN" value={form.club} onChange={set("club")} style={inputStyle(!!form.club)} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>COURT</p>
        <input type="text" placeholder="e.g. 3" value={form.court} onChange={set("court")} style={inputStyle(!!form.court)} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>PLAYERS</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["p1", "p2", "p3", "p4"] as const).map((k, i) => (
            <input key={k} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={form[k]} onChange={set(k)} style={inputStyle(!!form[k])} />
          ))}
        </div>
      </div>
      <button
        onClick={onSave}
        disabled={!valid}
        style={{ marginTop: 4, padding: "13px", borderRadius: 16, border: "none", cursor: valid ? "pointer" : "default", fontSize: 15, fontWeight: 700, color: "#fff", background: valid ? saveColor : "#c4c7c7" }}
      >
        {saveLabel}
      </button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: "10px", borderRadius: 16, border: "1.5px solid #fee2e2", background: "#fff5f5", fontSize: 14, fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>
          Delete match
        </button>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editForms, setEditForms] = useState<Record<number, Form>>({});
  const [addForm, setAddForm] = useState<Form>(EMPTY_FORM);

  function load() {
    try {
      const raw = localStorage.getItem("padelop:upcoming-matches");
      const list: StoredMatch[] = raw ? JSON.parse(raw) : [];
      const today = new Date().toISOString().slice(0, 10);
      setMatches(list.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    } catch { setMatches([]); }
    try {
      const raw = localStorage.getItem("padelop:match-reviews");
      setReviews(raw ? JSON.parse(raw) : []);
    } catch { setReviews([]); }
  }

  useEffect(() => {
    load();
    hydrateFromSupabase();
    let lastSync = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 30_000) {
        lastSync = Date.now();
        hydrateFromSupabase();
      }
    };
    window.addEventListener("storage", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Seed edit forms when matches load
  useEffect(() => {
    const next: Record<number, Form> = {};
    matches.forEach((m, i) => {
      next[i] = { date: m.date, time: m.time, club: m.club || "", court: m.court || "", p1: m.player_1 || "", p2: m.player_2 || "", p3: m.player_3 || "", p4: m.player_4 || "" };
    });
    setEditForms(next);
  }, [matches]);

  function saveList(list: StoredMatch[]) {
    const today = new Date().toISOString().slice(0, 10);
    const future = list.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    localStorage.setItem("padelop:upcoming-matches", JSON.stringify(future));
    if (future.length > 0) localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
    else localStorage.removeItem("padelop:next-match");
    window.dispatchEvent(new Event("storage"));
  }

  function formToMatch(f: Form): StoredMatch {
    return { date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 };
  }

  function saveEdit(idx: number) {
    const f = editForms[idx];
    if (!f?.date || !f?.time) return;
    const updated = matches.map((m, i) => i === idx ? formToMatch(f) : m);
    saveList(updated);
    saveUpcomingMatch({ date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 });
    setExpandedIdx(null);
  }

  function deleteMatch(idx: number) {
    const updated = matches.filter((_, i) => i !== idx);
    saveList(updated);
    setExpandedIdx(null);
  }

  function saveAdd() {
    const f = addForm;
    if (!f.date || !f.time) return;
    const m = formToMatch(f);
    saveList([...matches, m]);
    saveUpcomingMatch({ date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 });
    setAddForm(EMPTY_FORM);
    setAddOpen(false);
  }

  const sortedReviews = [...reviews].sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <div style={{ minHeight: "100dvh", background: "#f0f2f5", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--c-bg, #f0f2f5)", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { startNavLoad(); router.back(); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg, #f0f2f5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text, #1a1c1c)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <h1 className="t-heading" style={{ color: "var(--c-text, #1a1c1c)", margin: 0 }}>Matches</h1>
          </div>
          <button
            onClick={() => { setAddOpen(o => !o); setExpandedIdx(null); if (!addOpen) setAddForm(EMPTY_FORM); }}
            style={{ background: addOpen ? "#e8edf8" : "#2653d4", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 14, fontWeight: 700, color: addOpen ? "#2653d4" : "#fff", cursor: "pointer" }}
          >
            {addOpen ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      <div style={{ padding: "4px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Add form */}
        {addOpen && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1a1c1c" }}>New match</p>
            <MatchForm
              form={addForm}
              onChange={setAddForm}
              onSave={saveAdd}
              saveLabel="Save match"
              saveColor="#16a34a"
            />
          </div>
        )}

        {/* Upcoming */}
        {matches.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: "4px 4px 0", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>UPCOMING</p>
            {matches.map((m, idx) => {
              const expanded = expandedIdx === idx;
              const form = editForms[idx] ?? EMPTY_FORM;
              const players = [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean);
              const countdown = fmtCountdown(m.date, m.time);
              const isToday = countdown === "Today";
              return (
                <div key={idx} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                  {/* Card header — tap to toggle */}
                  <button
                    onClick={() => { setExpandedIdx(expanded ? null : idx); setAddOpen(false); }}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                  >
                    {/* Date block */}
                    <div style={{ flexShrink: 0, width: 48, textAlign: "center", background: isToday ? "#eef2ff" : "#f4f6f8", borderRadius: 12, padding: "8px 4px" }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isToday ? "#2653d4" : "#8a9096", lineHeight: 1 }}>
                        {new Date(m.date + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: isToday ? "#2653d4" : "#1a1c1c", lineHeight: 1 }}>
                        {new Date(m.date + "T12:00").getDate()}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: isToday ? "#2653d4" : "#8a9096", lineHeight: 1 }}>
                        {new Date(m.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}
                      </p>
                    </div>

                    {/* Match info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1c1c" }}>{m.time || "—"}</span>
                        {m.club && <span style={{ fontSize: 13, color: "#8a9096", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {m.club}{m.court ? ` #${m.court}` : ""}</span>}
                      </div>
                      {players.length > 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: "#8a9096", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{players.join(", ")}</p>
                      )}
                      <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isToday ? "#eef2ff" : "#f4f6f8", color: isToday ? "#2653d4" : "#8a9096" }}>
                        {countdown}
                      </span>
                    </div>

                    {/* Chevron */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c4c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>

                  {/* Inline edit form */}
                  {expanded && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f2f5" }}>
                      <MatchForm
                        form={form}
                        onChange={f => setEditForms(prev => ({ ...prev, [idx]: f }))}
                        onSave={() => saveEdit(idx)}
                        onDelete={() => deleteMatch(idx)}
                        saveLabel="Save changes"
                        saveColor="#2653d4"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !addOpen && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 20px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
              </svg>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#1a1c1c" }}>No upcoming matches</p>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "#8a9096" }}>Schedule your next game</p>
            <button onClick={() => setAddOpen(true)} style={{ padding: "11px 28px", borderRadius: 999, background: "#2653d4", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              + Add a match
            </button>
          </div>
        )}

        {/* Past matches */}
        {sortedReviews.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <p style={{ margin: "4px 4px 0", fontSize: 12, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em" }}>HISTORY</p>
            {sortedReviews.map((r, i) => {
              const resultColor = r.result === "win" ? "#16a34a" : r.result === "loss" ? "#ef4444" : "#8a9096";
              const resultBg   = r.result === "win" ? "#f0fdf4" : r.result === "loss" ? "#fff5f5" : "#f4f6f8";
              return (
                <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flexShrink: 0, width: 44, textAlign: "center", background: "#f4f6f8", borderRadius: 11, padding: "7px 4px" }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#8a9096" }}>{new Date(r.ts.slice(0, 10) + "T12:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 900, color: "#1a1c1c", lineHeight: 1 }}>{new Date(r.ts.slice(0, 10) + "T12:00").getDate()}</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {(r.opponentNames || r.opponent) && <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#1a1c1c" }}>vs {r.opponentNames || r.opponent}</p>}
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
    </div>
  );
}
