"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import LogSheet from "@/components/log-sheet";
import { computeScores, loadScoringData } from "@/lib/scoring";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function getDayMsg(match: { date: string; time: string } | null, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
  if (match?.date === today) {
    const [mH, mM] = match.time.split(":").map(Number);
    const diffMins = mH * 60 + mM - now.getHours() * 60 - now.getMinutes();
    if (diffMins > 180) { const hrs = Math.floor(diffMins / 60); return `Match in ${hrs}h. Stay light, hydrate steadily, and eat your pre-game meal ${hrs > 4 ? "a few hours before" : "soon"}.`; }
    if (diffMins > 60) return "Time to warm up. Dynamic activation, no heavy food — just sip water and focus.";
    if (diffMins > 0) return "Almost game time. Breathe, visualise, and trust your prep.";
    return "Great match today. Prioritise recovery — stretch, eat protein, and rest up.";
  }
  if (match?.date === yesterday) return "Recovery day. Keep moving gently, drink plenty of water, and get your protein in.";
  return "Rest day. Let your body absorb the work. Hydrate, eat well, and take it easy.";
}

const pad = (n: number) => String(n).padStart(2, "0");
const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const ITEM_COLORS: Record<string, string> = {
  "Wake up & hydrate": "#0891b2", "Light breakfast": "#16a34a", "Breakfast": "#16a34a",
  "Morning mobility": "#7c3aed", "Light mobility": "#7c3aed",
  "Pre-game meal": "#16a34a", "Warmup & activation": "#f59e0b",
  "Match": "#2653d4", "Post-match cool down": "#7c3aed",
  "Recovery meal": "#16a34a", "Recovery walk": "#0891b2",
  "Foam roll & stretch": "#7c3aed", "Protein-rich lunch": "#16a34a",
  "Cold shower": "#0891b2", "Dinner": "#16a34a",
  "Early wind down": "#8b5cf6", "Balanced lunch": "#16a34a",
  "Active recovery": "#0891b2", "Visualisation": "#8b5cf6",
  "Wind down": "#8b5cf6",
};

function getScheduleData(matchDate: string | null, matchTime: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  let dayType: "match" | "recovery" | "rest" = "rest";
  if (matchDate === today) dayType = "match";
  else if (matchDate === yesterday) dayType = "recovery";

  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 18;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "18:30";

  const schedules = {
    match: [
      { time: "07:00", title: "Wake up & hydrate",   subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",            subtitle: "Oats, eggs, fruit" },
      { time: "09:00", title: "Morning mobility",     subtitle: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Pre-game meal",        subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation",  subtitle: "Dynamic drills, 30 min" },
      { time: mt,                    title: "Match",                 subtitle: "Game time" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",        subtitle: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down",            subtitle: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",   subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Light breakfast",      subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Recovery walk",        subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Foam roll & stretch",  subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Protein-rich lunch",   subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower",          subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",               subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Early wind down",      subtitle: "Sleep is your best recovery tool tonight" },
    ],
    rest: [
      { time: "07:00", title: "Wake up & hydrate",   subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",            subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",       subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "12:30", title: "Balanced lunch",       subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",      subtitle: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",               subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",        subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",            subtitle: "No screens, consistent bedtime" },
    ],
  };

  const schedule = schedules[dayType].map(item => ({ ...item, color: ITEM_COLORS[item.title] ?? "#8a9096" }));
  const curMins = new Date().getHours() * 60 + new Date().getMinutes();
  let idx = 0;
  if (curMins >= toMins(schedule[schedule.length - 1].time)) {
    idx = schedule.length - 1;
  } else {
    for (let i = 0; i < schedule.length - 1; i++) {
      if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { idx = i; break; }
    }
  }
  return { schedule, currentIdx: idx, dayType };
}

const DAY_TYPE_META = {
  match:    { label: "Game Day",     bg: "#1e3a1e18", color: "#1e3a1e" },
  recovery: { label: "Recovery Day", bg: "#7c3aed18", color: "#7c3aed" },
  rest:     { label: "Rest Day",     bg: "#94a3b818", color: "#64748b" },
};

const SCHEDULE_DETAILS: Record<string, string> = {
  "Wake up & hydrate": "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.",
  "Breakfast": "Oats are a slow-releasing carbohydrate that keeps blood sugar stable for hours. Eggs deliver complete protein to protect muscle. Fruit provides natural sugars and hydrating water content.",
  "Light breakfast": "Keep it light and easily digestible on a recovery day. Eggs provide amino acids for tissue repair. Greek yogurt delivers protein and probiotics. Avoid heavy or greasy foods that slow digestion and increase inflammation.",
  "Morning mobility": "Light mobility work increases range of motion and blood flow without fatiguing your muscles before a match. Foam rolling uses your body weight to apply pressure and release adhesions. Key areas for padel: hip flexors, IT band, calves, thoracic spine.",
  "Light mobility": "On rest days, gentle mobility keeps joints lubricated and prevents stiffness from accumulating. Focus on hip flexors (60-sec holds), thoracic rotation, and ankle circles. 10–15 minutes is enough — this is maintenance, not training.",
  "Pre-game meal": "A small solid meal 60–90 min before the match tops off energy stores without sitting heavy in your stomach. Eggs provide fast-absorbing protein; toast adds digestible carbs. Keep portions modest.",
  "Warmup & activation": "Dynamic warmup primes the neuromuscular system — it signals your fast-twitch fibres that explosive movement is coming. Lateral drills mimic court-side movement patterns. Build from 60% to 80–90% intensity.",
  "Match": "Match time. Focus on early rhythm — the first few games set the tempo. Communicate constantly with your partner. If losing points from the back, use the lob as a reset rather than going for winners. Stay hydrated between sets.",
  "Post-match cool down": "Cooling down gradually lowers your heart rate. Static stretching (30-sec holds) is most effective now — muscles are warm and pliable. Focus on quads, hip flexors, calves, and shoulder external rotators.",
  "Recovery meal": "The 30-minute post-exercise window has the highest rate of muscle protein synthesis. Aim for 20–40 g protein + 60–80 g carbs. A protein shake + banana works; so does chicken + rice.",
  "Recovery walk": "Low-intensity movement increases blood flow to fatigued muscles without adding stress. Walking at a comfortable pace for 20 minutes helps flush metabolic waste, reduces soreness, and keeps your aerobic system active without loading your joints.",
  "Foam roll & stretch": "Post-match, your muscles are still warm enough to respond well to sustained pressure. Work through quads, IT band, hip flexors, glutes, and calves. Spend 60–90 seconds on each area. Finish with static stretches — your range of motion is at its peak the day after a session.",
  "Protein-rich lunch": "Muscle repair peaks in the 24 hours after exercise. Aim for 30–40g of protein at lunch from high-quality sources. Combine with complex carbs to restore glycogen and healthy fats to reduce inflammation.",
  "Cold shower": "Two minutes of cold water constricts blood vessels, reduces inflammation, and blunts delayed onset muscle soreness. It also activates the nervous system — useful if you have low energy on a recovery day.",
  "Dinner": "Evening meals should focus on anti-inflammatory foods: fatty fish (omega-3s), leafy greens (magnesium), and complex carbs to restore glycogen for tomorrow. Avoid alcohol — it significantly impairs muscle protein synthesis overnight.",
  "Early wind down": "After a match, your nervous system is still activated — cortisol and adrenaline take hours to clear. An early wind-down accelerates recovery: dim lights by 9pm, avoid screens, and aim to be in bed by 10:30. Tonight's sleep quality directly determines how fast you recover.",
  "Balanced lunch": "Rest days are an opportunity to catch up on micronutrients. Build your lunch around a variety of colours — each pigment represents a different class of antioxidant that supports tissue repair and immune function. Don't under-eat on rest days; your body is still rebuilding.",
  "Active recovery": "Light aerobic activity on rest days maintains cardiovascular fitness without accumulating fatigue. Swimming is ideal — zero impact, full range of motion. Cycling works well too. Keep heart rate below 130 bpm and duration under 45 minutes.",
  "Visualisation": "Mental rehearsal activates the same motor pathways as physical practice. Spend 5 minutes visualising your strongest patterns: a sharp bandeija from the net, your positioning after a deep lob, your return when under pressure.",
  "Wind down": "Blue light from screens suppresses melatonin production by up to 50%. In the 60 minutes before bed: dim lights, avoid screens, try light reading or slow breathing. A consistent bedtime stabilises your circadian rhythm.",
};

const S: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 17,
  fontWeight: 400,
  color: "#111",
  lineHeight: 1.6,
};

export default function Home4() {
  const [doModalOpen, setDoModalOpen] = useState(false);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedItemModal, setSchedItemModal] = useState<{ title: string; subtitle?: string; color: string; detail: string } | null>(null);
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; players?: string[] } | null>(null);
  const [now, setNow] = useState(new Date());
  const [doSlideIdx, setDoSlideIdx] = useState(() => getScheduleData(null, null).currentIdx + 1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [readiness, setReadiness] = useState(65);
  const doTouchStartX = useRef(0);
  const curItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function loadReadiness() {
      const d = loadScoringData();
      setReadiness(computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek).overall);
    }
    loadReadiness();
    window.addEventListener("storage", loadReadiness);

    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) {
          const matchMs = new Date(`${m.date}T${m.time}`).getTime();
          if (matchMs > Date.now()) {
            setMatch({
              date: m.date, time: m.time,
              club: m.club || undefined,
              players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean),
            });
            setDoSlideIdx(getScheduleData(m.date, m.time).currentIdx + 1);
          }
        }
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => { clearInterval(id); window.removeEventListener("storage", loadReadiness); };
  }, []);


  const { schedule: _s } = getScheduleData(match?.date ?? null, match?.time ?? null);
  const isSleepytime = doSlideIdx === 0 || doSlideIdx >= _s.length + 1;
  const _safeDoIdx = Math.min(doSlideIdx, _s.length + 1);
  const accentColor = (_safeDoIdx >= 1 && _safeDoIdx <= _s.length) ? _s[_safeDoIdx - 1].color : "#7c3aed";

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 55, pointerEvents: "none", opacity: isSleepytime ? 1 : 0, transition: "opacity 0.35s ease" }} />
    <main style={{ ...S, position: "fixed", inset: 0, paddingTop: "4rem", paddingLeft: 20, paddingRight: 20, paddingBottom: 0, overflow: "hidden", background: `${accentColor}2e`, transition: "background 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 60 }}>

      {(() => {
        const { schedule, currentIdx, dayType } = getScheduleData(match?.date ?? null, match?.time ?? null);
        const meta = DAY_TYPE_META[dayType];
        const safeDoIdx = Math.min(doSlideIdx, schedule.length + 1);
        const doItem = schedule[safeDoIdx - 1];
        const curMins = now.getHours() * 60 + now.getMinutes();
        return (
          <>

            {/* Do This Now — square carousel */}
            <div
              className="w-full overflow-hidden"
              style={{ height: "calc(100dvh - 4rem)", touchAction: "none" }}
              onTouchStart={e => { doTouchStartX.current = e.touches[0].clientY; }}
              onTouchEnd={e => {
                const dy = e.changedTouches[0].clientY - doTouchStartX.current;
                if (Math.abs(dy) > 40)
                  setDoSlideIdx(prev => dy < 0 ? Math.min(prev + 1, schedule.length + 1) : Math.max(prev - 1, 0));
              }}
            >
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                transform: `translateY(calc((100dvh - 4rem - 56px - (100vw - 40px)) / 2 - 24px - ${safeDoIdx + 1} * (100vw - 24px)))`,
                transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
              }}>
                {([null, null, ...schedule, null, null] as (typeof schedule[0] | null)[]).map((s, i) => (
                  <div key={i} style={{ height: "calc(100vw - 40px)", width: "100%", flexShrink: 0, opacity: i === safeDoIdx + 1 ? 1 : 0.35, filter: i === safeDoIdx + 1 ? "none" : "grayscale(1)", transition: "opacity 0.35s cubic-bezier(0.4,0,0.2,1), filter 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
                    {s === null ? (
                      i === schedule.length + 3 ? (
                        /* Last phantom — brand watermark */
                        <div className="rounded-[24px] w-full h-full relative overflow-hidden" style={{ background: "#e2e5e9", border: "2px solid #1a1c1c" }}>
                          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }}>
                            <defs>
                              <pattern id="wm-last" x="0" y="0" width="90" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
                                <circle cx="16" cy="10" r="7" fill="#1a1c1c" />
                                <text x="0" y="38" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif" fill="#1a1c1c" letterSpacing="0.06em">padla</text>
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#wm-last)" />
                          </svg>
                        </div>
                      ) : (
                        /* Sleepytime slide (first phantom top + both sleepytime bookends) */
                        <div
                          className="rounded-[24px] flex flex-col items-center justify-center w-full h-full gap-3"
                          style={{ background: "#e2e5e9", border: "2px solid #1a1c1c" }}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                          </svg>
                          <p className="text-[22px] font-bold text-[#1a1c1c] leading-none">Sleepytime</p>
                        </div>
                      )
                    ) : (() => {
                      const schedIdx = i - 2;
                      const isDone = completed.has(schedIdx);
                      const nextSlide = schedule[schedIdx + 1];
                      const minsUntilNext = nextSlide ? toMins(nextSlide.time) - curMins : 0;
                      const fmtMins = (m: number) => {
                        if (m <= 0) return "a moment";
                        const h = Math.floor(m / 60), rem = m % 60;
                        if (h > 0 && rem > 0) return `${h}h ${rem}m`;
                        if (h > 0) return `${h}h`;
                        return `${rem}m`;
                      };
                      const isReady = curMins >= toMins(s.time);
                      return (
                        <button
                          onClick={() => setDoModalOpen(true)}
                          className="bg-white rounded-[24px] px-6 py-6 flex flex-col items-center transition-opacity w-full h-full relative overflow-hidden"
                          style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: `2px solid ${s.color}` }}
                        >
                          {isDone ? (
                            /* Completion state — replace all content */
                            <div className="flex flex-col items-center justify-center w-full h-full text-center px-6">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: `${s.color}18` }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </div>
                              <p className="text-[26px] font-bold text-[#1a1c1c] leading-none">Good Job!</p>
                              <p className="text-[15px] font-semibold text-[#4a5050] mt-1 leading-none">{s.title} complete</p>
                              {nextSlide && (
                                <div className="mt-4">
                                  <p className="text-[13px] text-[#8a9096] leading-none">See you in <span className="font-semibold text-[#4a5050]">{fmtMins(minsUntilNext)}</span> for:</p>
                                  <p className="text-[14px] font-bold text-[#1a1c1c] mt-1 leading-none">{nextSlide.title}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Normal state */
                            <>
                              {/* Label — top center */}
                              <p className="text-[13px] font-bold tracking-widest uppercase mb-0" style={{ color: schedIdx === currentIdx ? "#5a7055" : "#9aa5b0" }}>
                                {schedIdx === currentIdx ? "Do this now" : schedIdx > currentIdx ? `Up Next · ${s.time}` : s.time}
                              </p>
                              {/* Title — above dot */}
                              <p className="text-[26px] font-bold text-[#1a1c1c] leading-none text-center mt-2">{s.title}</p>
                              {/* Dot — center */}
                              <div className="flex-1 flex items-center justify-center w-full pointer-events-none">
                                <div className="w-36 h-36 rounded-full flex items-center justify-center" style={{ background: `${s.color}12` }}>
                                  {schedIdx === currentIdx ? (
                                    <div className="w-16 h-16 rounded-full breathe-strong" style={{ background: s.color, ["--glow" as string]: s.color } as React.CSSProperties} />
                                  ) : (
                                    <div className="w-16 h-16 rounded-full" style={{ background: s.color }} />
                                  )}
                                </div>
                              </div>
                              {/* Subtitle + complete button — below dot */}
                              <div className="text-center">
                                {s.subtitle && <p className="text-[16px] text-[#6b7480] leading-none">{s.subtitle}</p>}
                                <div className="flex justify-center mt-4">
                                  <span className="text-[13px] font-semibold px-5 py-2 rounded-full" style={{
                                    background: isReady ? `${s.color}18` : "#f0f0f0",
                                    color: isReady ? s.color : "#b0b5ba",
                                  }}>
                                    Complete
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>

            {completed.has(safeDoIdx - 1) && (
              <>
                {/* Mean time prompt */}
                <p style={{ ...S, fontSize: 13, color: "#9aa5b0", textAlign: "center", margin: "0" }}>
                  or in the mean time check out...
                </p>

                {/* Today's Schedule */}
                <div className="bg-white flex flex-col" style={{ borderRadius: 24, boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "1px solid #e8e8e8", overflow: "hidden" }}>
                  <button
                    onClick={() => setSchedOpen(o => !o)}
                    className="px-5 pt-3 pb-4 flex items-center justify-center flex-shrink-0 w-full active:opacity-60 transition-opacity"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <span style={{ ...S, fontSize: 15, fontWeight: 600, color: "#1a1c1c", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      Today&apos;s schedule
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: schedOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                  {schedOpen && <div className="px-5 pb-2 flex items-center justify-center gap-2">
                    <span style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, background: meta.bg, color: meta.color, margin: 0 }}>{meta.label}</span>
                  </div>}
              {schedOpen && <div className="px-4 pb-6">
                {schedule.map((s, i) => {
                  const isCur = i === currentIdx;
                  const isPast = !isCur && curMins > toMins(s.time);
                  const detail = SCHEDULE_DETAILS[s.title];
                  return (
                    <div
                      key={i}
                      ref={isCur ? curItemRef : undefined}
                      className="flex items-center gap-3 active:opacity-60 transition-opacity"
                      style={{
                        borderBottom: isCur ? "none" : i < schedule.length - 1 ? "1px solid #f4f4f4" : "none",
                        cursor: detail ? "pointer" : "default",
                        ...(isCur
                          ? { boxShadow: `0 0 0 1px ${s.color}`, borderRadius: 14, padding: "8px", marginBottom: i < schedule.length - 1 ? 4 : 0 }
                          : { padding: "8px 0", paddingLeft: 8 }),
                      }}
                      onClick={() => detail && setSchedItemModal({ title: s.title, subtitle: s.subtitle, color: s.color, detail })}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isPast ? "#f0f0f0" : `${s.color}18` }}>
                        {isCur ? (
                          <div className="w-3 h-3 rounded-full animate-breathe" style={{ background: s.color, ["--glow" as string]: s.color } as React.CSSProperties} />
                        ) : (
                          <div className="w-3 h-3 rounded-full" style={{ background: isPast ? "#d0d3d6" : s.color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold tracking-widest uppercase mb-0.5" style={{ color: isPast ? "#c4c7c7" : s.color }}>{s.time}</p>
                        <p className="text-[16px] font-semibold leading-snug" style={{ color: isPast ? "#a0a5aa" : "#1a1c1c" }}>{s.title}</p>
                        {s.subtitle && <p className="text-[13px] mt-0.5 leading-snug" style={{ color: isPast ? "#c4c7c7" : "#6b7480" }}>{s.subtitle}</p>}
                      </div>
                      {detail && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      )}
                    </div>
                  );
                })}
                  </div>}
                </div>

                {/* +Track something */}
                <button
                  onClick={() => setLogSheetOpen(true)}
                  className="w-full bg-white flex items-center justify-center active:opacity-60 transition-opacity"
                  style={{ borderRadius: 24, boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "1px solid #e8e8e8", padding: "14px 20px", cursor: "pointer", marginTop: 12 }}
                >
                  <span style={{ ...S, fontSize: 15, fontWeight: 600, color: "#1a1c1c", margin: 0 }}>+Track something</span>
                </button>
              </>
            )}

            {doModalOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setDoModalOpen(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden max-h-[88vh] overflow-y-auto"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-6 pt-5 pb-4" style={{ background: `${doItem.color}18` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: doItem.color }} />
                      <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: doItem.color }}>Today&apos;s Schedule</p>
                    </div>
                    <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{doItem.title}</h3>
                    {doItem.subtitle && <p className="text-[15px] text-[#6b7480] mt-0.5">{doItem.subtitle}</p>}
                  </div>
                  {SCHEDULE_DETAILS[doItem.title] && (
                    <div className="px-6 py-5">
                      <p className="text-[17px] text-[#2c3235] leading-relaxed">{SCHEDULE_DETAILS[doItem.title]}</p>
                    </div>
                  )}
                  <div className="px-6 pb-6">
                    {(() => {
                      const isComplete = completed.has(doSlideIdx - 1);
                      return (
                    <button
                      onClick={() => {
                        setDoModalOpen(false);
                        setCompleted(prev => {
                          const next = new Set(prev);
                          isComplete ? next.delete(doSlideIdx - 1) : next.add(doSlideIdx - 1);
                          return next;
                        });
                      }}
                      className="w-full py-3.5 rounded-2xl text-[15px] font-bold active:scale-[0.98] transition-transform"
                      style={isComplete ? { background: `${doItem.color}18`, color: doItem.color } : { background: doItem.color, color: "#fff" }}
                    >
                      {isComplete ? "Mark as incomplete" : "Mark as complete"}
                    </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            {schedItemModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setSchedItemModal(null)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div className="relative bg-white rounded-[28px] px-7 py-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                  <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: schedItemModal.color }}>{schedItemModal.title}</p>
                  {schedItemModal.subtitle && <p className="text-[15px] text-[#6b7480] mb-3">{schedItemModal.subtitle}</p>}
                  <p className="text-[17px] text-[#2c3235] leading-relaxed">{schedItemModal.detail}</p>
                  <button onClick={() => setSchedItemModal(null)} className="mt-6 w-full py-3 rounded-2xl text-[15px] font-bold" style={{ background: schedItemModal.color + "18", color: schedItemModal.color }}>Got it</button>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* FAB */}
      {(() => {
        const { schedule } = getScheduleData(match?.date ?? null, match?.time ?? null);
        const schedIdx = doSlideIdx - 1;
        const TENNIS_GREEN = "#c5e840";
        const fabColor = (schedIdx >= 0 && schedIdx < schedule.length) ? schedule[schedIdx].color : TENNIS_GREEN;
        return (
      <button
        onClick={() => setLogSheetOpen(true)}
        className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
          width: 56,
          height: 56,
          borderRadius: 28,
          background: fabColor,
          boxShadow: `0 4px 16px ${fabColor}55`,
        }}
        aria-label="Log activity"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
        );
      })()}

      <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
    </main>
    </>
  );
}
