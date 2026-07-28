"use client";

import React, { useState } from "react";
import type { ReviewEntry } from "@/lib/scoring";

type SummarySection = { title: string; text: string };
type Summary = { ts: string; sections?: SummarySection[]; text?: string };

const SUMMARIES_KEY = "padelop:notes-summaries";

function loadNotes(): { date: string; text: string }[] {
  const reviews: ReviewEntry[] = (() => { try { const raw = localStorage.getItem("padelop:match-reviews"); return raw ? JSON.parse(raw) as ReviewEntry[] : []; } catch { return []; } })();
  return reviews
    .filter(r => r.notes)
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map(r => ({ date: r.ts.slice(0, 10), text: r.notes as string }));
}

function loadSummaries(): Summary[] {
  try { return JSON.parse(localStorage.getItem(SUMMARIES_KEY) || "[]"); } catch { return []; }
}

export function getNotesSummaryCount() {
  return loadSummaries().length;
}

export default function NotesSummaryContent() {
  const [summaries, setSummaries] = useState<Summary[]>(loadSummaries());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const notes = loadNotes();

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notes-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Couldn't create a summary — try again in a bit.");
        return;
      }
      const next = [{ ts: new Date().toISOString(), sections: data.sections as SummarySection[] }, ...summaries];
      setSummaries(next);
      localStorage.setItem(SUMMARIES_KEY, JSON.stringify(next));
      setExpandedIdx(0);
    } catch {
      setError("Couldn't create a summary — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (notes.length === 0) {
    return <p style={{ fontSize: 21, color: "#9aa0a6", margin: 0 }}>No match notes yet — write notes when you rate a match to build a summary here.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        onClick={handleCreate}
        disabled={loading}
        style={{ background: "#2653d4", border: "none", borderRadius: 999, padding: "12px 20px", fontSize: 20, fontWeight: 700, color: "#fff", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, alignSelf: "flex-start" }}
      >
        {loading ? "Summarizing…" : "Create summary from my notes"}
      </button>
      {error && <p style={{ margin: 0, fontSize: 17, color: "#ef4444" }}>{error}</p>}
      {summaries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aa0a6" }}>Past summaries</p>
          {summaries.map((s, i) => {
            const isOpen = expandedIdx === i;
            return (
              <div key={i} style={{ background: "#f8f9fa", borderRadius: 14, overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedIdx(v => v === i ? null : i)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#9aa0a6" }}>
                    {new Date(s.ts).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {s.sections?.length ? s.sections.map((sec, si) => (
                      <div key={si} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#2653d4", letterSpacing: "0.02em" }}>{sec.title}</p>
                        <p style={{ margin: 0, fontSize: 18, color: "#1a1c1c", lineHeight: 1.55 }}>{sec.text}</p>
                      </div>
                    )) : (
                      <p style={{ margin: 0, fontSize: 18, color: "#1a1c1c", lineHeight: 1.5 }}>{s.text}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
