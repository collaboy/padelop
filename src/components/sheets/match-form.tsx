"use client";

import React from "react";
import { saveUpcomingMatch } from "@/lib/db";
import { pad } from "@/lib/schedule-data";

// Shared "add/edit a match" building block — the form fields plus the
// storage/DB persistence helpers, used by both the Matches stats card and
// the Schedule sheet's month view so neither has to re-implement it.

export type MatchForm = { date: string; time: string; club: string; court: string; p1: string; p2: string; p3: string; p4: string };
export const EMPTY_MATCH_FORM: MatchForm = { date: "", time: "", club: "", court: "", p1: "", p2: "", p3: "", p4: "" };

export type StoredMatchFull = {
  date: string; time: string; club: string; court?: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function matchFormToStored(f: MatchForm): StoredMatchFull {
  return { date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 };
}

// Writes the full upcoming-matches list to localStorage, keeps next-match in
// sync, and notifies other open components via the "storage" event.
export function persistUpcomingMatches(list: StoredMatchFull[]) {
  const today = localToday();
  const future = list.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  localStorage.setItem("padelop:upcoming-matches", JSON.stringify(future));
  if (future.length > 0) localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
  else localStorage.removeItem("padelop:next-match");
  window.dispatchEvent(new Event("storage"));
}

// Appends one new match, reading the current list fresh from storage — for
// callers that don't already keep their own upcomingMatches state in sync.
export function addUpcomingMatch(f: MatchForm) {
  if (!f.date || !f.time) return;
  let all: StoredMatchFull[] = [];
  try { all = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]"); } catch {}
  persistUpcomingMatches([...all, matchFormToStored(f)]);
  saveUpcomingMatch({ date: f.date, time: f.time, club: f.club, court: f.court, player_1: f.p1, player_2: f.p2, player_3: f.p3, player_4: f.p4 });
}

function matchInputStyle(filled: boolean): React.CSSProperties {
  return { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${filled ? "#2653d4" : "#e2e2e2"}`, background: filled ? "#f4f6ff" : "#fff", fontSize: 22, color: "#1a1c1c", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
}

export function MatchFormFields({ form, onChange, onSave, onDelete, saveLabel, saveColor }: {
  form: MatchForm; onChange: (f: MatchForm) => void; onSave: () => void;
  onDelete?: () => void; saveLabel: string; saveColor: string;
}) {
  const valid = !!(form.date && form.time);
  const set = (k: keyof MatchForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [k]: e.target.value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>DATE</p>
          <input type="date" value={form.date} onChange={set("date")} style={matchInputStyle(!!form.date)} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>TIME</p>
          <input type="time" value={form.time} onChange={set("time")} style={matchInputStyle(!!form.time)} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>CLUB</p>
        <input type="text" placeholder="e.g. Club Padel BCN" value={form.club} onChange={set("club")} style={matchInputStyle(!!form.club)} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>COURT</p>
        <input type="text" placeholder="e.g. 3" value={form.court} onChange={set("court")} style={matchInputStyle(!!form.court)} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#8a9096", marginBottom: 4 }}>PLAYERS</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["p1", "p2", "p3", "p4"] as const).map((k, i) => (
            <input key={k} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={form[k]} onChange={set(k)} style={matchInputStyle(!!form[k])} />
          ))}
        </div>
      </div>
      <button onClick={onSave} disabled={!valid} style={{ marginTop: 4, padding: "13px", borderRadius: 16, border: "none", cursor: valid ? "pointer" : "default", fontSize: 21, fontWeight: 700, color: "#fff", background: valid ? saveColor : "#c4c7c7" }}>{saveLabel}</button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: "10px", borderRadius: 16, border: "1.5px solid #fee2e2", background: "#fff5f5", fontSize: 20, fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>Delete match</button>
      )}
    </div>
  );
}
