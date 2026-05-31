"use client";

import React, { useState, useEffect } from "react";
import Nav4 from "@/components/nav4";
import LogSheet from "@/components/log-sheet";

const S = { fontFamily: "Inter, sans-serif" };
const card: React.CSSProperties = { boxShadow: "0px 4px 20px rgba(0,0,0,0.04)" };

type MatchEntry = {
  id: string;
  date: string;
  time: string;
  matchType?: string;
  status: "confirmed" | "pending";
  partner: string;
  opponent1: string;
  opponent2: string;
  club: string;
  result?: "win" | "loss";
  score?: string;
};

const AVATAR_COLORS = ["#2653d4", "#0891b2", "#7c3aed", "#0d9488", "#dc2626", "#ea580c", "#16a34a"];

function initials(name: string) {
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

function StatusPill({ status }: { status: "confirmed" | "pending" }) {
  return (
    <span className="flex-shrink-0 text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-full uppercase"
      style={{ background: status === "confirmed" ? "#caecbc" : "#fef3c7", color: status === "confirmed" ? "#496640" : "#92400e" }}>
      {status === "confirmed" ? "Confirmed" : "Pending"}
    </span>
  );
}

function NextMatchCard({ match }: { match: MatchEntry }) {
  const d = new Date(match.date + "T00:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  const firstName = (n: string) => n.split(" ")[0];
  const timeFormatted = (() => {
    const [h, m] = match.time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  })();
  return (
    <div className="bg-white rounded-[24px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-5 pb-4 flex justify-between items-start gap-3">
        <div>
          <p className="text-[15px] font-bold text-[#496640] leading-snug uppercase tracking-wide">{match.matchType ?? "Friendly Match"}</p>
          <p className="text-[15px] text-[#1a1c1c] mt-1">{dateLabel} • {timeFormatted}</p>
        </div>
        <StatusPill status={match.status} />
      </div>
      <div className="border-t border-[#ebebeb]" />
      <div className="flex items-center justify-around px-5 py-6">
        <div className="flex flex-col items-center gap-2.5">
          <Avatar name="Me" color="#2653d4" size="lg" />
          <p className="text-[14px] text-[#1a1c1c] font-medium">You & {firstName(match.partner)}</p>
        </div>
        <span className="text-[14px] font-semibold text-[#9aab96] uppercase tracking-widest">vs</span>
        <div className="flex flex-col items-center gap-2.5">
          <Avatar name={match.opponent1} color={AVATAR_COLORS[4]} size="lg" />
          <p className="text-[14px] text-[#1a1c1c] font-medium">{firstName(match.opponent1)} & {firstName(match.opponent2)}</p>
        </div>
      </div>
      <div className="border-t border-[#ebebeb]" />
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-[14px] text-[#747878]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
          </svg>
          {match.club}
        </div>
        <button className="text-[14px] font-bold text-[#1a1c1c] active:opacity-50 transition-opacity">Details</button>
      </div>
    </div>
  );
}

function MatchCard({ match, isPast }: { match: MatchEntry; isPast?: boolean }) {
  const d = new Date(match.date + "T00:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  const firstName = (n: string) => n.split(" ")[0];
  const resultColor = match.result === "win" ? "#496640" : "#dc2626";
  return (
    <div className="bg-white rounded-[20px] border border-[#e2e2e2] overflow-hidden" style={card}>
      <div className="px-5 pt-4 pb-3 flex justify-between items-start gap-3">
        <div>
          <p className="text-[13px] font-bold text-[#496640] uppercase tracking-wide">{match.matchType ?? "Friendly Match"}</p>
          <p className="text-[13px] text-[#747878] mt-0.5">{dateLabel} • {match.time}</p>
        </div>
        {isPast && match.result ? (
          <div className="text-right flex-shrink-0">
            <p className="text-[13px] font-bold" style={{ color: resultColor }}>{match.result === "win" ? "Win" : "Loss"}</p>
            {match.score && <p className="text-[11px] text-[#747878]">{match.score}</p>}
          </div>
        ) : (
          <StatusPill status={match.status} />
        )}
      </div>
      <div className="border-t border-[#ebebeb]" />
      <div className="flex items-center justify-around px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name="Me" color="#2653d4" size="md" />
          <p className="text-[12px] text-[#1a1c1c] font-medium">You & {firstName(match.partner)}</p>
        </div>
        <span className="text-[12px] font-semibold text-[#9aab96] uppercase tracking-widest">vs</span>
        <div className="flex items-center gap-2.5">
          <Avatar name={match.opponent1} color={AVATAR_COLORS[4]} size="md" />
          <p className="text-[12px] text-[#1a1c1c] font-medium">{firstName(match.opponent1)} & {firstName(match.opponent2)}</p>
        </div>
      </div>
      <div className="border-t border-[#ebebeb]" />
      <div className="flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-[#747878]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
          </svg>
          {match.club}
        </div>
        <button className="text-[12px] font-bold text-[#1a1c1c] active:opacity-50 transition-opacity">Details</button>
      </div>
    </div>
  );
}

const TABS = ["All", "Upcoming", "Past"] as const;
type Tab = (typeof TABS)[number];

const NEXT_MATCH: MatchEntry = {
  id: "next", date: "2026-05-28", time: "19:00", matchType: "Friendly Match", status: "confirmed",
  partner: "Alex Ramos", opponent1: "Carlos Vega", opponent2: "David Puig", club: "Club Padel BCN",
};

const UPCOMING: MatchEntry[] = [
  { id: "u1", date: "2026-06-03", time: "18:30", status: "confirmed", partner: "Alex Ramos", opponent1: "Marc Torres", opponent2: "Jordi Gil", club: "Padel Indoor BCN" },
  { id: "u2", date: "2026-06-10", time: "20:00", status: "pending", partner: "Sergi Mas", opponent1: "Carlos Vega", opponent2: "Pau Ferrer", club: "Club Padel BCN" },
];

const PAST: MatchEntry[] = [
  { id: "p1", date: "2026-05-20", time: "19:30", status: "confirmed", partner: "Alex Ramos", opponent1: "Marc Torres", opponent2: "Jordi Gil", club: "Padel Indoor BCN", result: "win", score: "6-3 6-4" },
  { id: "p2", date: "2026-05-14", time: "18:00", status: "confirmed", partner: "Sergi Mas", opponent1: "Carlos Vega", opponent2: "David Puig", club: "Club Padel BCN", result: "loss", score: "4-6 3-6" },
  { id: "p3", date: "2026-05-07", time: "20:00", status: "confirmed", partner: "Alex Ramos", opponent1: "Pau Ferrer", opponent2: "Jordi Gil", club: "Padel Indoor BCN", result: "win", score: "6-2 7-5" },
];

export default function Matches4() {
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const showUpcoming = tab === "All" || tab === "Upcoming";
  const showPast = tab === "All" || tab === "Past";

  const [_match, _setMatch] = useState<{ date: string; time: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) _setMatch(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "40px 16px 176px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ ...S, fontSize: 22, fontWeight: 700, color: "#1a1c1c", margin: 0, letterSpacing: "-0.01em" }}>My Matches</h2>
          <p style={{ ...S, fontSize: 14, color: "#747878", margin: "4px 0 0" }}>
            <span style={{ fontWeight: 600, color: "#1a1c1c" }}>Interesting…</span> you win 73% when you take the first set.
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
                {tab === t && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {showUpcoming && (
        <>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Next Match</p>
          <NextMatchCard match={NEXT_MATCH} />
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Upcoming</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {UPCOMING.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </>
      )}
      {showPast && (
        <>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: 0 }}>Past</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PAST.map(m => <MatchCard key={m.id} match={m} isPast />)}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
          width: 56, height: 56, borderRadius: 28,
          background: "#496640",
          boxShadow: "0 4px 16px #49664055",
        }}
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
