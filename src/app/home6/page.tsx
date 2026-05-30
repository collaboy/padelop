"use client";

import React, { useState, useEffect } from "react";
import Nav2a from "@/components/nav2a";
import LogSheet from "@/components/log-sheet";
import { computeScores, loadScoringData } from "@/lib/scoring";

type ScheduleBlock = {
  time: string;
  title: string;
  subtitle?: string;
  category: "wake" | "nutrition" | "training" | "game" | "recovery" | "rest" | "tip";
};

const SCHEDULE_COLORS: Record<ScheduleBlock["category"], string> = {
  wake:      "#f59e0b",
  nutrition: "#16a34a",
  training:  "#2653d4",
  game:      "#1e3a1e",
  recovery:  "#7c3aed",
  rest:      "#94a3b8",
  tip:       "#0891b2",
};

const SCHEDULE_DETAILS: Record<string, string> = {
  "Wake up & hydrate": "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.",
  "Light breakfast": "A light pre-match breakfast fuels short anaerobic bursts without weighing you down. Banana provides fast-releasing carbs and potassium. Toast offers sustained energy.",
  "Breakfast": "Oats are a slow-releasing carbohydrate that keeps blood sugar stable for hours. Eggs deliver complete protein to protect muscle. Fruit provides natural sugars and hydrating water content.",
  "Pre-workout breakfast": "Fuelling before a gym or court session prevents muscle breakdown and boosts output by 10–20%. Oats give sustained energy; banana adds fast carbs and potassium to delay cramping.",
  "Morning mobility": "Light mobility work increases range of motion and blood flow without fatiguing your muscles before a match. Key areas for padel: hip flexors, IT band, calves, thoracic spine.",
  "Foam roll & stretch": "Foam rolling applies sustained pressure to muscle tissue to break up adhesions. Roll slowly — pause on tight spots for 20–30 seconds. Key areas: hip flexors, IT band, calves, thoracic spine.",
  "Warmup & activation": "Dynamic warmup primes the neuromuscular system — it signals your fast-twitch fibres that explosive movement is coming. Lateral drills mimic court-side movement patterns.",
  "Pre-game meal": "A small solid meal 60–90 min before the match tops off energy stores without sitting heavy in your stomach. Keep portions modest — you want fuel, not a full stomach on court.",
  "Pre-match snack": "A light snack 60–90 min before the match avoids blood sugar dips without causing digestive discomfort during play. Banana provides potassium which reduces cramp risk.",
  "Match": "Match time. Focus on early rhythm — the first few games set the tempo. Communicate constantly with your partner. Stay hydrated between sets.",
  "Post-match cool down": "Cooling down gradually lowers your heart rate. Static stretching (30-sec holds) is most effective now — muscles are warm and pliable. Focus on quads, hip flexors, calves, and shoulders.",
  "Recovery meal": "The 30-minute post-exercise window has the highest rate of muscle protein synthesis. Aim for 20–40g protein + 60–80g carbs. A protein shake + banana works; so does chicken + rice.",
  "Post-workout fuel": "The anabolic window (first 30 minutes post-workout) is when muscles are most receptive to protein synthesis. 20–30g of fast-absorbing protein maximises muscle repair.",
  "Lunch": "On game days, carbohydrates are your primary fuel. Complex carbs (rice, pasta, sweet potato) convert to glycogen — your muscles' preferred energy source.",
  "Protein-rich lunch": "Post-match recovery demands high protein intake. Chicken, legumes, and fish provide all essential amino acids needed for muscle repair.",
  "Dinner": "Post-training dinner should lean toward protein and vegetables with moderate carbs. Protein at dinner supports overnight muscle protein synthesis.",
  "Active recovery": "20 minutes of walking or light swimming at low intensity accelerates lactate clearance — the metabolic byproduct responsible for muscle soreness.",
  "Rest": "Active rest lowers cortisol while maintaining light blood flow. A 20-minute nap can increase alertness — keep it under 25 min to avoid sleep inertia.",
  "Recovery": "Foam rolling and stretching after a training session reduces delayed-onset muscle soreness by increasing blood flow to worked tissue.",
  "Strength session": "Padel demands explosive lateral movement, shoulder stability, and rotational power. Lower body work builds the foundation for court speed.",
  "Light movement": "Easy movement on recovery days maintains circulation without adding training load. A walk at conversation pace keeps your joints mobile.",
  "Optional drills": "Light technical drill work on non-game days sharpens patterns without accumulating fatigue. Focus on mechanics: bandeja angle, serve placement, volley touch.",
  "Match review": "Athletes who review and self-reflect improve measurably faster than those who don't. Log while it's fresh — note patterns, not one-off mistakes.",
  "Review & plan": "End-of-day reflection closes the loop on your training. Ask: what worked? What do I want to sharpen? Writing it down converts thoughts into actionable training cues.",
  "Prepare for game day": "Visualisation is a proven cognitive rehearsal technique. Spend 5–10 minutes seeing yourself play well: your best shots, your positioning, your communication with your partner.",
  "Wind down": "Blue light from screens suppresses melatonin production by up to 50%. In the 60 minutes before bed: dim lights, avoid screens, try light reading or slow breathing.",
  "Sleep": "Deep sleep is when growth hormone is released and muscle tissue is repaired. 8 hours at a consistent time improves reaction time, shot accuracy, and pain tolerance.",
};

function offsetYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDaySchedule(todayYMD: string, gameDays: string[], gameTimes: Record<string, string>): ScheduleBlock[] {
  const isGameToday = gameDays.includes(todayYMD);
  const isRecoveryDay = !isGameToday && gameDays.includes(offsetYMD(todayYMD, -1));
  const gameTime = gameTimes[todayYMD];

  if (isGameToday) {
    if (gameTime === "morning") return [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
      { time: "07:30", title: "Light breakfast", subtitle: "Toast, banana, black coffee", category: "nutrition" },
      { time: "08:15", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
      { time: "09:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
      { time: "10:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
      { time: "11:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
      { time: "13:00", title: "Lunch", subtitle: "Balanced — stay off heavy carbs", category: "nutrition" },
      { time: "15:00", title: "Rest", subtitle: "20-min nap or feet up", category: "rest" },
      { time: "19:00", title: "Dinner", subtitle: "High protein, vegetables, good fats", category: "nutrition" },
      { time: "22:30", title: "Wind down", subtitle: "No screens — sleep by 23:00", category: "rest" },
    ];
    if (gameTime === "afternoon") return [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
      { time: "08:00", title: "Breakfast", subtitle: "Oats, eggs, fruit", category: "nutrition" },
      { time: "09:30", title: "Morning mobility", subtitle: "Light stretching & foam roll", category: "recovery" },
      { time: "11:00", title: "Pre-match snack", subtitle: "Banana, rice cakes — keep it light", category: "nutrition" },
      { time: "12:00", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
      { time: "13:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
      { time: "14:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
      { time: "15:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
      { time: "19:00", title: "Dinner", subtitle: "High protein, vegetables, good fats", category: "nutrition" },
      { time: "22:30", title: "Wind down", subtitle: "No screens — sleep by 23:00", category: "rest" },
    ];
    if (gameTime === "night") return [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
      { time: "08:00", title: "Breakfast", subtitle: "Oats, eggs, fruit", category: "nutrition" },
      { time: "10:00", title: "Morning mobility", subtitle: "Light stretching & foam roll", category: "recovery" },
      { time: "13:00", title: "Lunch", subtitle: "Carb-heavy: rice, chicken, veg", category: "nutrition" },
      { time: "17:00", title: "Pre-match snack", subtitle: "Banana, rice cakes — keep it light", category: "nutrition" },
      { time: "19:00", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
      { time: "20:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
      { time: "21:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
      { time: "22:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
      { time: "23:30", title: "Wind down", subtitle: "Adrenaline will linger — plan a sleep routine", category: "rest" },
    ];
    return [
      { time: "06:55", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
      { time: "07:15", title: "Breakfast", subtitle: "Oats, eggs, fruit", category: "nutrition" },
      { time: "09:30", title: "Morning mobility", subtitle: "Light stretching & foam roll", category: "recovery" },
      { time: "14:00", title: "Lunch", subtitle: "Carb-heavy: rice, chicken, veg", category: "nutrition" },
      { time: "17:30", title: "Pre-match snack", subtitle: "Banana, rice cakes — keep it light", category: "nutrition" },
      { time: "19:30", title: "Warmup & activation", subtitle: "Dynamic stretches, lateral drills", category: "training" },
      { time: "20:00", title: "Pre-game meal", subtitle: "2 eggs and toast", category: "nutrition" },
      { time: "21:00", title: "Match", subtitle: "Focus on strategy and intensity", category: "game" },
      { time: "22:30", title: "Post-match cool down", subtitle: "Mobility & stretch, 15 min", category: "recovery" },
      { time: "23:00", title: "Recovery meal", subtitle: "Protein + carbs within 30 min of finishing", category: "nutrition" },
      { time: "23:45", title: "Wind down", subtitle: "Adrenaline will linger — plan a sleep routine", category: "rest" },
    ];
  }

  if (isRecoveryDay) return [
    { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water, no alarm stress", category: "wake" },
    { time: "08:00", title: "Light breakfast", subtitle: "Eggs, fruit, coffee", category: "nutrition" },
    { time: "09:00", title: "Active recovery", subtitle: "20-min walk or light swim", category: "recovery" },
    { time: "10:30", title: "Foam roll & stretch", subtitle: "Focus on hips, calves, shoulders", category: "recovery" },
    { time: "13:00", title: "Protein-rich lunch", subtitle: "Chicken, legumes, vegetables", category: "nutrition" },
    { time: "15:00", title: "Rest", subtitle: "20-min nap if needed", category: "rest" },
    { time: "17:00", title: "Light movement", subtitle: "Easy walk, no court intensity", category: "recovery" },
    { time: "19:00", title: "Dinner", subtitle: "Balanced: protein, veg, good fats", category: "nutrition" },
    { time: "21:00", title: "Match review", subtitle: "Log your last match while it's fresh", category: "tip" },
    { time: "22:30", title: "Wind down", subtitle: "Aim for 8h sleep tonight", category: "rest" },
  ];

  const nextGameYMD = (() => { for (let i = 1; i <= 7; i++) { const y = offsetYMD(todayYMD, i); if (gameDays.includes(y)) return y; } return null; })();
  const gameIstomorrow = nextGameYMD === offsetYMD(todayYMD, 1);
  return [
    { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before anything else", category: "wake" },
    { time: "08:00", title: "Pre-workout breakfast", subtitle: "Oats, banana, coffee", category: "nutrition" },
    { time: "09:00", title: "Strength session", subtitle: "Lower body, lateral hops, rotator cuff — 45 min", category: "training" },
    { time: "10:30", title: "Post-workout fuel", subtitle: "Protein shake or eggs within 30 min", category: "nutrition" },
    { time: "13:00", title: "Lunch", subtitle: "Balanced: carbs, protein, veg", category: "nutrition" },
    { time: "15:00", title: "Recovery", subtitle: "Foam roll, stretch, hydrate", category: "recovery" },
    { time: "17:00", title: "Optional drills", subtitle: "Bandeja, serve practice — keep it light", category: "training" },
    { time: "19:00", title: "Dinner", subtitle: gameIstomorrow ? "Carb-up tonight — game tomorrow" : "High protein, vegetables", category: "nutrition" },
    { time: "21:00", title: gameIstomorrow ? "Prepare for game day" : "Review & plan", subtitle: gameIstomorrow ? "Visualise your shots. Sleep by 22:30." : "Log training, plan tomorrow", category: "tip" },
    { time: "23:00", title: "Sleep", subtitle: "Aim for 8 hours", category: "rest" },
  ];
}

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

export default function Home6() {
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [doNowOpen, setDoNowOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [readiness, setReadiness] = useState(65);
  const [gameDays, setGameDays] = useState<string[]>([]);
  const [gameTimes, setGameTimes] = useState<Record<string, string>>({});
  const [scheduleModal, setScheduleModal] = useState<{ title: string; subtitle?: string; category: ScheduleBlock["category"]; detail: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  function refreshScore() {
    const data = loadScoringData();
    const s = computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek, data.habits);
    setReadiness(Math.round(s.overall));
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) { const m = JSON.parse(raw); if (m.date && m.time) setMatchTime(`${m.date}T${m.time}`); }
    } catch {}
    try {
      const s = localStorage.getItem("padelop:game-days");
      if (s) setGameDays(JSON.parse(s));
    } catch {}
    try {
      const t = localStorage.getItem("padelop:game-times");
      if (t) setGameTimes(JSON.parse(t));
    } catch {}
    refreshScore();
    const openLog = () => setLogOpen(true);
    window.addEventListener("open-log-sheet", openLog);
    window.addEventListener("storage", refreshScore);
    return () => {
      window.removeEventListener("open-log-sheet", openLog);
      window.removeEventListener("storage", refreshScore);
    };
  }, []);

  const todayYMD = new Date().toISOString().slice(0, 10);
  const schedule = getDaySchedule(todayYMD, gameDays, gameTimes);

  const datePart = matchTime?.split("T")[0] ?? null;
  const timePart = matchTime?.split("T")[1] ?? null;
  const dateLabel = (() => {
    if (!datePart) return null;
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const d = new Date(datePart + "T12:00");
    if (datePart === today) return "Today";
    if (datePart === tomorrow) return "Tomorrow";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  })();

  const matchObj = matchTime
    ? { date: matchTime.split("T")[0], time: matchTime.split("T")[1] }
    : null;

  const S = {
    label: { fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 8px" },
    h2: { fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 700, color: "#1a1c1c", margin: "0 0 6px", letterSpacing: "-0.01em" },
    sub: { fontFamily: "Inter, sans-serif", fontSize: 15, color: "#6b7480", lineHeight: 1.5, margin: 0 },
    divider: { height: 1, background: "#e2e2e0" },
    card: { background: "white", border: "1.5px solid #1a1c1c", borderRadius: 0, textAlign: "left" as const, padding: "20px 20px", display: "block", width: "100%", marginBottom: 12 },
  };

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const parseMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  return (
    <main
      className="h1-font min-h-screen flex flex-col px-6 pt-16 pb-44"
      style={{ background: "#f9f9f9" }}
    >
      <style>{`@keyframes colonBlink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>

      {/* Greeting */}
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9096", margin: "0 0 6px" }}>
        {greeting()}
      </p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 800, color: "#1a1c1c", lineHeight: 1.15, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
        Eddie
      </p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: "#6b7480", lineHeight: 1.6, margin: "0 0 20px" }}>
        {getDayMsg(matchObj, new Date())}
      </p>

      <div style={{ ...S.divider, margin: "0 0 20px" }} />

      {/* Do This Now */}
      <button onClick={() => setDoNowOpen(true)} style={{ ...S.card, cursor: "pointer" }} className="active:opacity-60 transition-opacity">
        <p style={{ ...S.label, color: "#f59e0b" }}>Do This Now</p>
        <p style={S.h2}>Drink 500ml water</p>
        <p style={S.sub}>Before anything else this morning</p>
      </button>

      {/* Today */}
      {(() => {
        const isGameToday = gameDays.includes(todayYMD);
        const isRecoveryDay = !isGameToday && gameDays.includes(offsetYMD(todayYMD, -1));
        const dayType = isGameToday ? "Game Day" : isRecoveryDay ? "Recovery Day" : "Training Day";
        const dayTypeColor = isGameToday ? "#16a34a" : isRecoveryDay ? "#7c3aed" : "#2653d4";
        const d = new Date(todayYMD + "T12:00");
        const dateStr = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
        return (
          <div style={{ ...S.card, marginBottom: 12, padding: 0 }}>
            {/* Header row */}
            <button
              onClick={() => setScheduleOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "20px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              className="active:opacity-60 transition-opacity"
            >
              <div>
                <p style={{ ...S.label, color: "#8a9096" }}>Today</p>
                <p style={S.h2}>{dateStr}</p>
                <span style={{ display: "inline-block", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: dayTypeColor, background: dayTypeColor + "14", padding: "4px 10px", borderRadius: 99, marginTop: 4 }}>{dayType}</span>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, marginLeft: 12, transform: scheduleOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {/* Dropdown schedule */}
            {scheduleOpen && (
              <div style={{ borderTop: "1.5px solid #1a1c1c", padding: "16px 20px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {schedule.map((block, idx, arr) => {
                    const color = SCHEDULE_COLORS[block.category];
                    const isLast = idx === arr.length - 1;
                    const blockMins = parseMins(block.time);
                    const nextMins = !isLast ? parseMins(arr[idx + 1].time) : 24 * 60;
                    const isCurrentSegment = !isLast && currentMins >= blockMins && currentMins < nextMins;
                    const segmentPct = isCurrentSegment ? ((currentMins - blockMins) / (nextMins - blockMins)) * 100 : 0;
                    const detail = SCHEDULE_DETAILS[block.title];
                    return (
                      <div key={idx} style={{ display: "flex", gap: 12 }}>
                        <div style={{ width: 40, flexShrink: 0, paddingTop: 2 }}>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: "#8a9096", textAlign: "right", lineHeight: 1 }}>{block.time}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 2, flexShrink: 0 }} />
                          {!isLast && (
                            <div style={{ position: "relative", width: 1, flex: 1, background: "#e2e2e0", minHeight: 28, overflow: "visible", marginTop: 4 }}>
                              {isCurrentSegment && (
                                <div style={{ position: "absolute", display: "flex", alignItems: "center", top: `${segmentPct}%`, right: 0, transform: "translateY(-50%)" }}>
                                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: "white", background: "#2653d4", padding: "3px 7px", whiteSpace: "nowrap", marginRight: 2 }}>
                                    {String(now.getHours()).padStart(2, "0")}<span style={{ animation: "colonBlink 1s step-start infinite" }}>:</span>{String(now.getMinutes()).padStart(2, "0")}
                                  </span>
                                  <svg width="6" height="8" viewBox="0 0 6 8"><polygon points="0,0 6,4 0,8" fill="#171c1f" /></svg>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => detail && setScheduleModal({ title: block.title, subtitle: block.subtitle, category: block.category, detail })}
                          style={{ paddingBottom: 16, flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, textAlign: "left", background: "none", border: "none", cursor: detail ? "pointer" : "default" }}
                          className={detail ? "active:opacity-60 transition-opacity" : ""}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 700, color: "#1a1c1c", lineHeight: 1.2, margin: 0 }}>{block.title}</p>
                            {block.subtitle && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#6b7480", marginTop: 2, lineHeight: 1.4 }}>{block.subtitle}</p>}
                          </div>
                          {detail && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 3 }}>
                              <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Next Match */}
      <button onClick={() => setMatchOpen(true)} style={{ ...S.card, cursor: "pointer" }} className="active:opacity-60 transition-opacity">
        <p style={{ ...S.label, color: "#8a9096" }}>Next Match</p>
        {dateLabel ? (
          <>
            <p style={S.h2}>{dateLabel}</p>
            <p style={{ ...S.sub, fontWeight: 600, color: "#2653d4" }}>{timePart}</p>
          </>
        ) : (
          <p style={{ ...S.sub, fontWeight: 600, color: "#2653d4" }}>+ Add a match</p>
        )}
      </button>

      {/* Readiness */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-log-sheet"))}
        style={{ ...S.card, cursor: "pointer", marginBottom: 12 }}
        className="active:opacity-60 transition-opacity"
      >
        <p style={{ ...S.label, color: "#8a9096" }}>Readiness</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 48, fontWeight: 800, color: "#2653d4", margin: "0 0 12px", lineHeight: 1, letterSpacing: "-0.03em" }}>
          {readiness}
          <span style={{ fontSize: 18, fontWeight: 600, color: "#8a9096", marginLeft: 4 }}>/100</span>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e05c3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2h6M12 2v4M5 8l2 2M19 8l-2 2M3 13h3M18 13h3M5 20l2-2M19 20l-2-2M8 6a4 4 0 0 0-4 4v3a8 8 0 0 0 16 0v-3a4 4 0 0 0-4-4H8z"/>
          </svg>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#e05c3a", fontWeight: 600 }}>Sleep data missing — score may be lower</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#2653d4", fontWeight: 600 }} onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("open-log-sheet")); }}>Add data</span>
        </div>
      </button>

      <Nav2a />

      {/* Do This Now modal */}
      {doNowOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setDoNowOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4" style={{ background: "#f59e0b18" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#f59e0b" }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Wake up &amp; hydrate</h3>
              <p className="text-[15px] text-[#6b7480] mt-0.5">Drink 500ml water</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[17px] text-[#2c3235] leading-relaxed">
                Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Next Match modal */}
      {matchOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setMatchOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white rounded-[28px] px-6 py-7" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 700, color: "#1a1c1c", margin: "0 0 16px" }}>Next Match</p>
            {dateLabel ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>{dateLabel}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 600, color: "#2653d4", margin: 0 }}>{timePart}</p>
              </div>
            ) : (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 17, color: "#6b7480", margin: 0 }}>No match scheduled yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Schedule block detail modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setScheduleModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4" style={{ background: SCHEDULE_COLORS[scheduleModal.category] + "18" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: SCHEDULE_COLORS[scheduleModal.category] }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: SCHEDULE_COLORS[scheduleModal.category] }}>{scheduleModal.category}</p>
              </div>
              <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{scheduleModal.title}</h3>
              {scheduleModal.subtitle && <p className="text-[15px] text-[#6b7480] mt-0.5">{scheduleModal.subtitle}</p>}
            </div>
            <div className="px-6 py-5">
              <p className="text-[17px] text-[#2c3235] leading-relaxed">{scheduleModal.detail}</p>
            </div>
          </div>
        </div>
      )}

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </main>
  );
}
