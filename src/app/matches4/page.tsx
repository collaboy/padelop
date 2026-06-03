"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";

const S = { fontFamily: "Inter, sans-serif" };
const card: React.CSSProperties = { boxShadow: "0px 4px 20px rgba(0,0,0,0.04)" };

type StoredMatch = {
  date: string; time: string; club: string;
  player_1: string; player_2: string; player_3: string; player_4: string;
};

type ReviewEntry = {
  ts: string;
  feeling: string;
  result: string;
  opponent: string;
  energy: string;
  wellDone: string[];
  improved: string[];
};

const AVATAR_COLORS = ["#2653d4", "#0891b2", "#7c3aed", "#0d9488", "#dc2626", "#ea580c", "#16a34a"];

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 text-[14px]" : "w-10 h-10 text-[11px]";
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-black text-white ring-2 ring-white flex-shrink-0`} style={{ background: color }}>
      {initials(name)}
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const TABS = ["All", "Upcoming", "Past"] as const;
type Tab = (typeof TABS)[number];

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
      <div className="flex items-center justify-around px-5 py-6">
        <div className="flex flex-col items-center gap-2.5">
          <Avatar name={p1} color="#2653d4" size="lg" />
          <p className="text-[14px] text-[#1a1c1c] font-medium">{firstName(p1)}{p2 ? ` & ${firstName(p2)}` : ""}</p>
        </div>
        <span className="text-[14px] font-semibold text-[#9aab96] uppercase tracking-widest">vs</span>
        <div className="flex flex-col items-center gap-2.5">
          <Avatar name={p3} color={AVATAR_COLORS[4]} size="lg" />
          <p className="text-[14px] text-[#1a1c1c] font-medium">{firstName(p3)}{p4 ? ` & ${firstName(p4)}` : ""}</p>
        </div>
      </div>
      {match.club ? (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="flex items-center px-5 py-4 gap-2 text-[14px] text-[#747878]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
            {match.club}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PastMatchCard({ review }: { review: ReviewEntry }) {
  const date = review.ts.slice(0, 10);
  const resultColor = review.result === "win" ? "#496640" : review.result === "loss" ? "#dc2626" : "#747878";
  const resultLabel = review.result === "win" ? "Win" : review.result === "loss" ? "Loss" : "Played";
  return (
    <div className="bg-white rounded-[20px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex justify-between items-start gap-3">
        <div>
          <p className="text-[13px] font-bold text-[#496640] uppercase tracking-wide">Match</p>
          <p className="text-[13px] text-[#747878] mt-0.5">{formatDate(date)}</p>
        </div>
        <p className="text-[13px] font-bold flex-shrink-0" style={{ color: resultColor }}>{resultLabel}</p>
      </div>
      {review.opponent ? (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="px-5 py-3 text-[13px] text-[#747878]">
            vs <span className="font-medium text-[#1a1c1c]">{review.opponent}</span>
          </div>
        </>
      ) : null}
      {review.wellDone.length > 0 || review.improved.length > 0 ? (
        <>
          <div className="border-t border-[#ebebeb]" />
          <div className="px-5 py-3 flex flex-col gap-1.5">
            {review.wellDone.slice(0, 2).map(t => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-[#496640]">
                <span>✓</span><span>{t}</span>
              </div>
            ))}
            {review.improved.slice(0, 1).map(t => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-[#2653d4]">
                <span>↑</span><span>{t}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Matches4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [nextMatch, setNextMatch] = useState<StoredMatch | null>(null);
  const [pastReviews, setPastReviews] = useState<ReviewEntry[]>([]);

  function loadData() {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw) as StoredMatch;
        setNextMatch(m.date ? m : null);
      } else {
        setNextMatch(null);
      }
    } catch { setNextMatch(null); }

    try {
      const raw = localStorage.getItem("padelop:match-reviews");
      const reviews = raw ? (JSON.parse(raw) as ReviewEntry[]) : [];
      setPastReviews(reviews.sort((a, b) => b.ts.localeCompare(a.ts)));
    } catch { setPastReviews([]); }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  const showUpcoming = tab === "All" || tab === "Upcoming";
  const showPast = tab === "All" || tab === "Past";

  const hasUpcoming = !!nextMatch;
  const hasPast = pastReviews.length > 0;

  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "40px 16px 176px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ ...S, fontSize: 22, fontWeight: 700, color: "#1a1c1c", margin: 0, letterSpacing: "-0.01em" }}>My Matches</h2>
          <p style={{ ...S, fontSize: 14, color: "#747878", margin: "4px 0 0" }}>
            {hasPast ? `${pastReviews.filter(r => r.result === "win").length} wins from ${pastReviews.length} logged matches` : "No matches logged yet"}
          </p>
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-white border border-[#e2e2e2] flex items-center justify-center active:scale-90 transition-transform relative"
          style={card}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {tab !== "All" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#496640]" />}
        </button>
      </div>

      {/* Filter modal */}
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

      {/* Upcoming */}
      {showUpcoming && (
        <>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Next Match</p>
          {hasUpcoming ? (
            <NextMatchCard match={nextMatch!} />
          ) : (
            <div className="bg-white rounded-[20px] border border-[#e2e2e2] px-5 py-6 text-center" style={card}>
              <p className="text-[15px] font-medium text-[#747878]">No upcoming match set</p>
              <p className="text-[13px] text-[#9aab96] mt-1">Add one from the home screen</p>
            </div>
          )}
        </>
      )}

      {/* Past */}
      {showPast && (
        <>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0, marginTop: showUpcoming ? 4 : 0 }}>Past</p>
          {hasPast ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pastReviews.map(r => <PastMatchCard key={r.ts} review={r} />)}
            </div>
          ) : (
            <div className="bg-white rounded-[20px] border border-[#e2e2e2] px-5 py-6 text-center" style={card}>
              <p className="text-[15px] font-medium text-[#747878]">No match reviews yet</p>
              <p className="text-[13px] text-[#9aab96] mt-1">Log a match review after your next game</p>
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: "#496640", boxShadow: "0 4px 16px #49664055" }}
        aria-label="Log activity"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <Nav4 />
      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
    </main>
  );
}
