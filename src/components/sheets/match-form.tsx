"use client";

import React, { useRef, useState } from "react";
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

// Full "Add Match" experience: choose between uploading a screenshot (read by
// Claude via /api/extract-match) or entering details manually, with a
// confirm step after a successful screenshot read. This is the same flow
// used on the home page's Next Match card — shared here so any other entry
// point (e.g. the Schedule sheet's month view) gets the identical
// experience instead of a bare form.
export function AddMatchModal({ open, title = "Add Match", onClose, onSaved }: {
  open: boolean; title?: string; onClose: () => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState<"pick" | "confirm" | "manual">("pick");
  const [form, setForm] = useState<MatchForm>(EMPTY_MATCH_FORM);
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function reset() {
    setTab("pick");
    setForm(EMPTY_MATCH_FORM);
    setUploadError(null);
    setUploadExtracting(false);
  }
  function handleClose() {
    reset();
    onClose();
  }
  function handleSave() {
    if (!form.date || !form.time) return;
    addUpcomingMatch(form);
    reset();
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-5" style={{ paddingTop: 24, paddingBottom: 24 }} onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-[#f0f0f0]">
          <div>
            <p className="text-[18px] font-bold text-[#1a1c1c]">{title}</p>
            <p className="text-[13px] text-[#6b7480] mt-0.5">Upload a screenshot or enter manually</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#f4f4f6" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {tab === "pick" && (
          <div className="px-6 py-6 flex flex-col gap-3">
            {uploadExtracting && (
              <div className="flex items-center justify-center gap-3 py-4">
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                <span className="text-[14px] font-medium text-[#2653d4]">Reading screenshot…</span>
              </div>
            )}
            {uploadError && (
              <div className="px-4 py-3 rounded-2xl text-[13px] text-[#c0392b]" style={{ background: "#fff0f0", border: "1.5px solid #ffd0d0" }}>{uploadError}</div>
            )}
            <button
              disabled={uploadExtracting}
              onClick={() => { setUploadError(null); uploadRef.current?.click(); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:opacity-70 transition-opacity"
              style={{ background: "#f4f6ff", border: "1.5px solid #2653d418", opacity: uploadExtracting ? 0.5 : 1 }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[#1a1c1c]">Upload screenshot</p>
                <p className="text-[12px] text-[#6b7480] mt-0.5">From your camera roll or files</p>
              </div>
            </button>
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploadError(null);
              setUploadExtracting(true);
              try {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve, reject) => {
                  reader.onload = () => resolve((reader.result as string).split(",")[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
                const res = await fetch("/api/extract-match", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ image: base64, mediaType: file.type }),
                });
                const data = await res.json();
                if (!res.ok || data.error) {
                  setUploadError(data.message || "Could not read the screenshot. Please enter manually.");
                  setUploadExtracting(false);
                  return;
                }
                setForm({
                  date: data.date ?? "", time: data.time ?? "", club: data.club ?? "", court: data.court ?? "",
                  p1: data.player_1 ?? "", p2: data.player_2 ?? "", p3: data.player_3 ?? "", p4: data.player_4 ?? "",
                });
                setTab("confirm");
              } catch {
                setUploadError("Upload failed. Please try again or enter manually.");
              }
              setUploadExtracting(false);
              if (uploadRef.current) uploadRef.current.value = "";
            }} />
            <button
              disabled={uploadExtracting}
              onClick={() => setTab("manual")}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:opacity-70 transition-opacity"
              style={{ background: "#f9f9f9", border: "1.5px solid #f0f0f0", opacity: uploadExtracting ? 0.5 : 1 }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1a1c1c" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="13" y2="18"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[#1a1c1c]">Enter manually</p>
                <p className="text-[12px] text-[#6b7480] mt-0.5">Date, time, club and players</p>
              </div>
            </button>
          </div>
        )}

        {tab === "confirm" && (
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f0fdf4" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-[13px] font-semibold text-[#16a34a]">We read your screenshot — does this look right?</p>
            </div>
            <div style={{ background: "#f9f9f9", borderRadius: 16, overflow: "hidden", border: "1px solid #f0f0f0" }}>
              {[
                { label: "Date", value: form.date ? new Date(form.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—" },
                { label: "Time", value: form.time || "—" },
                { label: "Club", value: form.club || "—" },
                { label: "Players", value: [form.p1, form.p2, form.p3, form.p4].filter(Boolean).join(", ") || "—" },
              ].map((row, i, arr) => (
                <div key={row.label} className="flex items-center px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#8a9096] w-16 flex-shrink-0">{row.label}</span>
                  <span className="text-[14px] font-medium text-[#1a1c1c]">{row.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleSave}
              className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
              style={{ background: (!form.date || !form.time) ? "#c4c7c7" : "#2653d4" }}
            >
              Yes, save match
            </button>
            <button onClick={() => setTab("manual")} className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-70 transition-opacity" style={{ background: "#f4f4f6", color: "#4a5050" }}>
              Edit details
            </button>
          </div>
        )}

        {tab === "manual" && (
          <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            <MatchFormFields form={form} onChange={setForm} onSave={handleSave} saveLabel="Save Match" saveColor="#2653d4" />
            <button onClick={() => setTab("pick")} className="w-full py-2 text-[13px] font-semibold text-[#6b7480]">← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
