"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

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

function matchLabel(date: string, time: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const d = new Date(date + "T12:00");
  const dayNum = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const dateStr = date === today ? "Today" : date === tomorrow ? "Tomorrow" : `${weekday} ${dayNum} ${month}`;
  return `Next Match: ${dateStr} · ${time}`;
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

function getCurrentItem(matchDate: string | null, matchTime: string | null) {
  const { schedule, currentIdx } = getScheduleData(matchDate, matchTime);
  return schedule[currentIdx];
}

const S: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 16,
  fontWeight: 300,
  color: "#111",
  lineHeight: 1.5,
};

const fieldS: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 14,
  fontWeight: 300,
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "8px 10px",
  width: "100%",
  background: "#fafafa",
  boxSizing: "border-box",
  outline: "none",
};

const labelS: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 11,
  fontWeight: 300,
  color: "#888",
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
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

type Step = "pick" | "upload" | "form";

export default function Home4() {
  const [doModalOpen, setDoModalOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [todaySchedOpen, setTodaySchedOpen] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string } | null>(null);
  const [now, setNow] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", time: "", venue: "", player1: "", player2: "", player3: "", player4: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) {
          const matchMs = new Date(`${m.date}T${m.time}`).getTime();
          if (matchMs > Date.now()) setMatch({ date: m.date, time: m.time });
        }
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  function saveMatch() {
    if (!form.date || !form.time) return;
    const data = {
      date: form.date, time: form.time,
      club: form.venue,
      player_1: form.player1, player_2: form.player2,
      player_3: form.player3, player_4: form.player4,
    };
    localStorage.setItem("padelop:next-match", JSON.stringify(data));
    window.dispatchEvent(new Event("storage"));
    setMatch({ date: form.date, time: form.time });
    closeModal();
  }

  function closeModal() {
    setAddOpen(false);
    setStep("pick");
    setUploading(false);
    setUploadError(null);
    setForm({ date: "", time: "", venue: "", player1: "", player2: "", player3: "", player4: "" });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 4 * 1024 * 1024) { setUploadError("Image too large (max 4 MB)."); return; }
    setUploadError(null);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/extract-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType: file.type }),
        });
        const data = await res.json();
        if (data.error) { setUploadError(data.message || "Couldn't read screenshot."); setUploading(false); return; }
        setForm({
          date: data.date ?? "", time: data.time ?? "", venue: data.club ?? "",
          player1: data.player_1 ?? "", player2: data.player_2 ?? "",
          player3: data.player_3 ?? "", player4: data.player_4 ?? "",
        });
        setStep("form");
        setUploading(false);
      } catch { setUploadError("Network error. Try again."); setUploading(false); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main style={{ ...S, padding: "24px 20px", minHeight: "100vh", background: "#f9f9f9", fontWeight: 300 }}>

      <p style={{ margin: "0 0 6px" }}>{greeting()} Eddie</p>
      <p style={{ ...S, fontSize: 13, color: "#888", fontWeight: 300, margin: "0 0 16px", lineHeight: 1.5 }}>{getDayMsg(match, now)}</p>
      <hr style={{ width: 160, margin: "0 0 24px", border: "none", borderTop: "1.5px solid #111" }} />

      {(() => {
        const item = getCurrentItem(match?.date ?? null, match?.time ?? null);
        void now;
        return (
          <>
            <button
              onClick={() => setDoModalOpen(true)}
              className="bg-white rounded-[24px] p-6 aspect-square flex flex-col items-center justify-between active:opacity-60 transition-opacity w-full"
              style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "2px solid #f59e0b", marginBottom: 32 }}
            >
              <p className="text-[13px] font-bold tracking-widest uppercase text-[#5a7055] w-full text-center">Do this now</p>
              <div className="w-16 h-16 rounded-full animate-breathe" style={{ background: "#f59e0b", ["--glow" as string]: "#f59e0b" }} />
              <div className="w-full text-center">
                <p className="text-[20px] font-bold text-[#1a1c1c] leading-tight">{item.title}</p>
                {item.subtitle && <p className="text-[13px] text-[#4a5050] mt-1 leading-snug">{item.subtitle}</p>}
              </div>
            </button>

            {doModalOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setDoModalOpen(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden max-h-[88vh] overflow-y-auto"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-6 pt-5 pb-4" style={{ background: "#f59e0b18" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                      <p className="text-[14px] font-bold tracking-wide" style={{ color: "#f59e0b" }}>Today&apos;s Schedule</p>
                    </div>
                    <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{item.title}</h3>
                    {item.subtitle && <p className="text-[13px] text-[#2c3235] mt-0.5">{item.subtitle}</p>}
                  </div>
                  {SCHEDULE_DETAILS[item.title] && (
                    <div className="px-6 py-5">
                      <p className="text-[15px] text-[#2c3235] leading-relaxed">{SCHEDULE_DETAILS[item.title]}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Today's Schedule collapsible */}
      {(() => {
        const { schedule, currentIdx, dayType } = getScheduleData(match?.date ?? null, match?.time ?? null);
        const meta = DAY_TYPE_META[dayType];
        const curMins = now.getHours() * 60 + now.getMinutes();
        return (
          <div className="bg-white rounded-[24px] mb-8" style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "1px solid #e8e8e8" }}>
            <button
              onClick={() => setTodaySchedOpen(o => !o)}
              className="w-full px-5 pt-4 pb-4 flex items-center justify-between active:opacity-60 transition-opacity"
            >
              <p className="text-[13px] font-bold tracking-widest uppercase text-[#5a7055]">Today&apos;s Schedule</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: todaySchedOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </button>
            {todaySchedOpen && (
              <div className="px-5 pb-4" style={{ borderTop: "1px solid #f4f4f4" }}>
                {schedule.map((s, i) => {
                  const isCur = i === currentIdx;
                  const isPast = !isCur && curMins > toMins(s.time);
                  return (
                    <div key={i} className="flex gap-4 py-2.5" style={{ borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f4" : "none" }}>
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                        <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: isPast ? "#d0d3d6" : s.color, boxShadow: isCur ? `0 0 0 3px ${s.color}28` : "none" }} />
                        {i < schedule.length - 1 && <div className="w-0.5 mt-1 flex-1" style={{ background: isPast ? "#e2e2e2" : "#ebebeb", minHeight: 20 }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold tracking-widest uppercase mb-0.5" style={{ color: isPast ? "#c4c7c7" : s.color }}>{s.time}</p>
                        <p className="text-[15px] font-semibold leading-snug" style={{ color: isPast ? "#a0a5aa" : "#1a1c1c" }}>{s.title}</p>
                        {s.subtitle && <p className="text-[12px] mt-0.5 leading-snug" style={{ color: isPast ? "#c4c7c7" : "#4a5050" }}>{s.subtitle}</p>}
                      </div>
                      {isCur && (
                        <div className="flex-shrink-0 self-center">
                          <div className="w-2.5 h-2.5 rounded-full animate-breathe" style={{ background: s.color, ["--glow" as string]: s.color }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <hr style={{ width: 160, margin: "0 0 24px", border: "none", borderTop: "1.5px solid #111" }} />

      {match ? (
        <p style={{ margin: "0 0 32px" }}>{matchLabel(match.date, match.time)}</p>
      ) : (
        <div style={{ margin: "0 0 32px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <p style={{ margin: 0 }}>Next Match:</p>
          <button onClick={() => setAddOpen(true)} style={{ ...S, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            + Add a match
          </button>
        </div>
      )}

      <hr style={{ width: 160, margin: "0 0 32px", border: "none", borderTop: "1.5px solid #111" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <Link href="/insights2a" style={{ ...S, textDecoration: "none", display: "block", marginBottom: 4 }}>View Insights</Link>
        <Link href="/track2a" style={{ ...S, textDecoration: "none", display: "block", marginBottom: 4 }}>Track Something</Link>
        <Link href="/matches2a" style={{ ...S, textDecoration: "none", display: "block" }}>Upcoming Matches</Link>
      </div>

      {/* Add Match modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)" }} onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: "22px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ ...S, fontSize: 17 }}>Add a match</p>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ padding: "18px 22px 24px" }}>

              {/* Step 1: pick method */}
              {step === "pick" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={() => setStep("upload")}
                    style={{ ...S, fontSize: 14, background: "#f4f4f4", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                    <div>
                      <div style={{ fontWeight: 400 }}>Upload screenshot</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Booking confirmation or chat — autofilled</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setStep("form")}
                    style={{ ...S, fontSize: 14, background: "#f4f4f4", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <div>
                      <div style={{ fontWeight: 400 }}>Enter manually</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Date, time, venue, players</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2: upload */}
              {step === "upload" && (
                <div>
                  {uploading ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <p style={{ ...S, fontSize: 14, color: "#888" }}>Analysing screenshot…</p>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: "block", border: "2px dashed #ddd", borderRadius: 14, padding: "36px 20px", textAlign: "center", cursor: "pointer" }}>
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFile} />
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                        <p style={{ ...S, fontSize: 14, color: "#555" }}>Choose screenshot</p>
                        <p style={{ ...S, fontSize: 12, color: "#aaa", marginTop: 4 }}>Booking confirmation or WhatsApp</p>
                      </label>
                      {uploadError && <p style={{ ...S, fontSize: 13, color: "#dc2626", marginTop: 10 }}>{uploadError}</p>}
                      <button onClick={() => setStep("pick")} style={{ ...S, fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", marginTop: 14, padding: 0 }}>← Back</button>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: form (manual or autofilled) */}
              {step === "form" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelS}>Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={fieldS} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelS}>Time</label>
                      <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={fieldS} />
                    </div>
                  </div>
                  <div>
                    <label style={labelS}>Venue</label>
                    <input type="text" value={form.venue} placeholder="Club / court" onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} style={fieldS} />
                  </div>
                  <div>
                    <label style={labelS}>Players</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(["player1","player2","player3","player4"] as const).map((k, i) => (
                        <input key={k} type="text" value={form[k]} placeholder={i === 0 ? "You" : `Player ${i + 1}`} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={fieldS} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button onClick={() => setStep("pick")} style={{ ...S, flex: 1, fontSize: 14, padding: "10px 0", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer", background: "#fff" }}>Back</button>
                    <button onClick={saveMatch} style={{ ...S, flex: 2, fontSize: 14, padding: "10px 0", border: "none", borderRadius: 10, cursor: "pointer", background: "#111", color: "#fff" }}>Save match</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </main>
  );
}
