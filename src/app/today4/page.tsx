"use client";

import React, { useState, useEffect, useRef } from "react";
import Nav4 from "@/components/nav4";

const S = { fontFamily: "Inter, sans-serif" };

const pad = (n: number) => String(n).padStart(2, "0");
const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

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

const DAY_TYPE_META = {
  match:    { label: "Game Day",     bg: "#1e3a1e18", color: "#1e3a1e" },
  recovery: { label: "Recovery Day", bg: "#7c3aed18", color: "#7c3aed" },
  rest:     { label: "Rest Day",     bg: "#94a3b818", color: "#64748b" },
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

function buildMonthCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function Today4() {
  const [match, setMatch] = useState<{ date: string; time: string } | null>(null);
  const [now, setNow] = useState(new Date());
  const [schedItemModal, setSchedItemModal] = useState<{ title: string; subtitle?: string; detail: string; color: string } | null>(null);
  const curItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) setMatch({ date: m.date, time: m.time });
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      curItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const matchDate = match?.date ?? null;
  const matchTime = match?.time ?? null;
  const { schedule, currentIdx, dayType } = getScheduleData(matchDate, matchTime);
  const meta = DAY_TYPE_META[dayType];
  const curMins = now.getHours() * 60 + now.getMinutes();

  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const cells = buildMonthCalendar(year, month);
  const matchDayNum = matchDate?.startsWith(`${year}-${pad(month + 1)}`)
    ? parseInt(matchDate.split("-")[2])
    : null;

  return (
    <main style={{ ...S, background: "#e2e5e9", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 176px" }}>

      {/* Greeting */}
      <div style={{ padding: "8px 4px 0", textAlign: "center" }}>
        <p style={{ ...S, fontSize: 22, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{greeting()} Eddie</p>
        <p style={{ ...S, fontSize: 15, color: "#888", margin: 0 }}>{getDayMsg(match, now)}</p>
      </div>

      {/* Header */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ ...S, fontSize: 26, fontWeight: 700, color: "#1a1c1c", margin: 0, letterSpacing: "-0.01em" }}>Today</p>
          <span style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 999, background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <p style={{ ...S, fontSize: 14, color: "#8a9096", margin: "4px 0 0" }}>
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Slide 2 card — Today's Schedule */}
      <div
        className="bg-white flex flex-col"
        style={{ borderRadius: 24, boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "1px solid #e8e8e8", overflow: "hidden" }}
      >
        <div className="px-4 pb-6">
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
                  ...(isCur ? { boxShadow: `0 0 0 1px ${s.color}`, borderRadius: 14, padding: "8px 8px 8px 8px", marginBottom: i < schedule.length - 1 ? 4 : 0 } : { padding: "8px 0", paddingLeft: 8 }),
                }}
                onClick={() => detail && setSchedItemModal({ title: s.title, subtitle: s.subtitle, detail, color: s.color })}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: isPast ? "#f0f0f0" : `${s.color}18` }}
                >
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
        </div>
      </div>

      {/* Month at a Glance */}
      <div style={{ background: "#fff", borderRadius: 24, padding: "20px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ ...S, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a7055", margin: 0 }}>Month at a Glance</p>
          <p style={{ ...S, fontSize: 13, fontWeight: 600, color: "#6b7480", margin: 0 }}>{MONTH_NAMES[month]} {year}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {DOW.map(d => (
            <div key={d} style={{ textAlign: "center", padding: "4px 0" }}>
              <span style={{ ...S, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "#b0b4b8" }}>{d}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((day, i) => {
            const isToday = day === todayDate;
            const isMatch = day === matchDayNum;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
                {day ? (
                  <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", position: "relative", background: isToday ? "#2653d4" : "transparent" }}>
                    <span style={{ ...S, fontSize: 13, fontWeight: 600, color: isToday ? "#fff" : "#1a1c1c" }}>{day}</span>
                    {isMatch && !isToday && <span style={{ position: "absolute", bottom: 2, width: 6, height: 6, borderRadius: "50%", background: "#2653d4" }} />}
                    {isMatch && isToday && <span style={{ position: "absolute", bottom: 2, width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                ) : <div style={{ width: 32, height: 32 }} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f4f4f4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4" }} />
            <span style={{ ...S, fontSize: 11, color: "#8a9096" }}>Today</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2653d4", opacity: 0.4 }} />
            <span style={{ ...S, fontSize: 11, color: "#8a9096" }}>Match</span>
          </div>
        </div>
      </div>

      {/* Schedule item detail modal */}
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

      <Nav4 />
    </main>
  );
}
