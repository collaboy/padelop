"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Nav2a from "@/components/nav2a";

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
  fontFamily: "Inter, sans-serif",
  fontSize: 17,
  fontWeight: 400,
  color: "#111",
  lineHeight: 1.6,
};

const fieldS: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  fontWeight: 400,
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
  fontFamily: "Inter, sans-serif",
  fontSize: 11,
  fontWeight: 400,
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
  const [slideIdx, setSlideIdx] = useState(1);
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; players?: string[] } | null>(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", time: "", venue: "", player1: "", player2: "", player3: "", player4: "" });
  const [schedItemModal, setSchedItemModal] = useState<{ title: string; subtitle?: string; detail: string; color: string } | null>(null);
  const [logThumb, setLogThumb] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [newCatActive, setNewCatActive] = useState(false);
  const [newCatValue, setNewCatValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const logCameraRef = useRef<HTMLInputElement>(null);
  const logUploadRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swipeAxis = useRef<"h" | "v" | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const curItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) {
          const matchMs = new Date(`${m.date}T${m.time}`).getTime();
          if (matchMs > Date.now()) setMatch({
            date: m.date, time: m.time,
            club: m.club || undefined,
            players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean),
          });
        }
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    function onTouchMove(e: TouchEvent) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (swipeAxis.current === null) swipeAxis.current = dx > dy ? "h" : "v";
      if (swipeAxis.current === "h") e.preventDefault();
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  useEffect(() => {
    if (slideIdx !== 2) return;
    const t = setTimeout(() => {
      curItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 380);
    return () => clearTimeout(t);
  }, [slideIdx]);

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

  function confirmCategory() {
    setLogSuccess(true);
    setTimeout(() => {
      setLogSuccess(false);
      setLogThumb(null);
      setNewCatActive(false);
      setNewCatValue("");
    }, 2000);
  }

  function handleLogFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const url = URL.createObjectURL(file);
    setLogThumb(url);
    setSlideIdx(0);
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
    <main style={{ ...S, padding: "24px 20px 160px", minHeight: "100vh", background: "#f9f9f9" }}>

      {(() => {
        const item = getCurrentItem(match?.date ?? null, match?.time ?? null);
        const { schedule, currentIdx, dayType } = getScheduleData(match?.date ?? null, match?.time ?? null);
        const meta = DAY_TYPE_META[dayType];
        const curMins = now.getHours() * 60 + now.getMinutes();
        void now;
        return (
          <>
            {/* Page overlay — darkens content outside carousel when on Log anything */}
            <div
              className="fixed inset-0 pointer-events-none"
              style={{ background: "rgba(0,0,0,0.45)", opacity: slideIdx === 0 ? 1 : 0, transition: "opacity 0.35s ease", zIndex: 5 }}
            />

            {/* Swipeable carousel */}
            <div
              ref={carouselRef}
              className="w-full aspect-square overflow-hidden"
              style={{ borderRadius: 24, marginBottom: 10, position: "relative", zIndex: 6 }}
              onTouchStart={e => {
                touchStartX.current = e.touches[0].clientX;
                touchStartY.current = e.touches[0].clientY;
                swipeAxis.current = null;
              }}
              onTouchEnd={e => {
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                if (swipeAxis.current === "h" && Math.abs(dx) > 40)
                  setSlideIdx(prev => dx < 0 ? Math.min(prev + 1, 2) : Math.max(prev - 1, 0));
              }}
            >
              <div
                style={{
                  display: "flex",
                  height: "100%",
                  transform: `translateX(-${slideIdx * 100}%)`,
                  transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                {/* Slide 0: Log anything */}
                <div style={{ flex: "0 0 100%", height: "100%" }}>
                  <div
                    className="bg-white flex flex-col"
                    style={{ width: "100%", height: "100%", borderRadius: 24, boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "1px solid #e8e8e8", overflow: "hidden" }}
                  >
                    {logSuccess ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#22c55e18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        <p style={{ fontSize: 20, fontWeight: 700, color: "#1a1c1c", margin: "0 0 6px" }}>Great!</p>
                        <p style={{ fontSize: 15, color: "#6b7480", margin: 0, lineHeight: 1.5 }}>We&apos;ll add it to your log</p>
                      </div>
                    ) : logThumb ? (
                      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                          <button onClick={() => { setLogThumb(null); setNewCatActive(false); setNewCatValue(""); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#5a7055", margin: 0 }}>Categorise</p>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                          <img src={logThumb} alt="upload" style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
                          <p style={{ fontSize: 15, color: "#6b7480", lineHeight: 1.5, margin: 0, alignSelf: "center" }}>What is this?<br/><span style={{ color: "#a0a5aa", fontSize: 13 }}>Pick a category below</span></p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {["Food pic", "Hydration", "Racket grip"].map(cat => (
                            <button key={cat} onClick={confirmCategory} style={{ background: "#f4f6ff", border: "none", borderRadius: 14, padding: "13px 16px", fontSize: 16, fontWeight: 600, color: "#2653d4", cursor: "pointer", textAlign: "left" }}>{cat}</button>
                          ))}
                          {newCatActive ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <input autoFocus value={newCatValue} onChange={e => setNewCatValue(e.target.value)} placeholder="Category name" style={{ flex: 1, border: "1.5px solid #2653d4", borderRadius: 14, padding: "10px 14px", fontSize: 15, outline: "none", background: "#fff" }} />
                              <button onClick={() => { if (newCatValue.trim()) confirmCategory(); }} style={{ background: "#2653d4", border: "none", borderRadius: 14, padding: "0 16px", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Save</button>
                            </div>
                          ) : (
                            <button onClick={() => setNewCatActive(true)} style={{ background: "none", border: "1.5px dashed #d0d3d6", borderRadius: 14, padding: "10px 16px", fontSize: 15, fontWeight: 600, color: "#8a9096", cursor: "pointer", textAlign: "left" }}>+ New category</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#5a7055", margin: 0, textAlign: "center" }}>Log anything</p>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
                          <button onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.setAttribute("capture", "environment"); input.onchange = (ev) => { const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return; const url = URL.createObjectURL(file); setLogThumb(url); }; input.click(); }} style={{ width: "100%", background: "#f4f6ff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2653d418", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            </div>
                            <div style={{ textAlign: "left" }}><p style={{ fontSize: 16, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>Camera</p><p style={{ fontSize: 13, color: "#8a9096", margin: 0 }}>Take a photo now</p></div>
                          </button>
                          <button onClick={() => logUploadRef.current?.click()} style={{ width: "100%", background: "#f4f6ff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2653d418", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            </div>
                            <div style={{ textAlign: "left" }}><p style={{ fontSize: 16, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>Upload</p><p style={{ fontSize: 13, color: "#8a9096", margin: 0 }}>Choose from library</p></div>
                          </button>
                          <button onClick={() => setWizardOpen(true)} style={{ width: "100%", background: "#f4f6ff", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2653d418", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            </div>
                            <div style={{ textAlign: "left" }}><p style={{ fontSize: 16, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>Wizard</p><p style={{ fontSize: 13, color: "#8a9096", margin: 0 }}>Step-by-step logging</p></div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slide 1: Do This Now */}
                <div style={{ flex: "0 0 100%", height: "100%" }}>
                  <button
                    onClick={() => setDoModalOpen(true)}
                    className="bg-white rounded-[24px] px-6 py-6 flex items-center gap-5 active:opacity-60 transition-opacity text-left w-full h-full"
                    style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "2px solid #f59e0b" }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b18" }}>
                      <div className="w-3.5 h-3.5 rounded-full animate-breathe" style={{ background: "#f59e0b", ["--glow" as string]: "#f59e0b" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055] mb-1">Do this now</p>
                      <p className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Drink 500ml water</p>
                      <span className="inline-flex items-center gap-1 mt-1">
                        <span className="text-[13px] text-[#6b7480] leading-snug">Before anything else this morning</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </span>
                    </div>
                  </button>
                </div>

                {/* Slide 2: Today's Schedule */}
                <div style={{ flex: "0 0 100%", height: "100%", overflow: "hidden" }}>
                  <div
                    className="bg-white flex flex-col"
                    style={{ width: "100%", height: "100%", borderRadius: 24, boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "1px solid #e8e8e8", overflowY: "auto" }}
                  >
                    <div className="px-5 pt-4 pb-2 flex-shrink-0">
                      <p style={{ ...S, fontSize: 22, fontWeight: 700, color: "#111", margin: "0 0 4px", lineHeight: 1.2 }}>{greeting()} Eddie</p>
                      <p style={{ ...S, fontSize: 15, color: "#888", margin: "0 0 14px", lineHeight: 1.5 }}>{getDayMsg(match, now)}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055]">Today&apos;s Schedule</p>
                        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                      </div>
                    </div>
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
                </div>

              </div>
            </div>

            {/* Hidden upload input */}
            <input ref={logUploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogFile} />

            {/* Dot navigation */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
              {[0, 1, 2].map(i => (
                <button
                  key={i}
                  onClick={() => setSlideIdx(i)}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: i === slideIdx ? "#1a1c1c" : "#d0d3d6", border: "none", padding: 0, cursor: "pointer", transition: "background 0.2s" }}
                />
              ))}
            </div>

            {/* Wizard modal */}
            {wizardOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setWizardOpen(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className="relative w-full max-w-sm bg-white rounded-[28px] px-6 py-7"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-[22px] font-bold text-[#1a1c1c] mb-1">Wizard</p>
                  <p className="text-[15px] text-[#8a9096] mb-5">What would you like to log?</p>
                  <div className="flex flex-col gap-2">
                    {["Check-in", "Hydration", "Nutrition", "Match Review"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setWizardOpen(false)}
                        className="w-full text-left px-4 py-3.5 rounded-2xl text-[17px] font-medium text-[#1a1c1c] active:opacity-60 transition-opacity"
                        style={{ background: "#f4f6ff" }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {schedItemModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setSchedItemModal(null)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden max-h-[88vh] overflow-y-auto"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-6 pt-5 pb-4" style={{ background: `${schedItemModal.color}18` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: schedItemModal.color }} />
                      <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: schedItemModal.color }}>Today&apos;s Schedule</p>
                    </div>
                    <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{schedItemModal.title}</h3>
                    {schedItemModal.subtitle && <p className="text-[15px] text-[#6b7480] mt-1">{schedItemModal.subtitle}</p>}
                  </div>
                  <div className="px-6 py-5">
                    <p className="text-[17px] text-[#2c3235] leading-relaxed">{schedItemModal.detail}</p>
                  </div>
                </div>
              </div>
            )}

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
                      <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#f59e0b" }}>Today&apos;s Schedule</p>
                    </div>
                    <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{item.title}</h3>
                    {item.subtitle && <p className="text-[15px] text-[#6b7480] mt-0.5">{item.subtitle}</p>}
                  </div>
                  {SCHEDULE_DETAILS[item.title] && (
                    <div className="px-6 py-5">
                      <p className="text-[17px] text-[#2c3235] leading-relaxed">{SCHEDULE_DETAILS[item.title]}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      <hr style={{ width: 80, margin: "0 auto 24px", border: "none", borderTop: "1.5px solid #ccc" }} />

      {match ? (
        <button
          onClick={() => setMatchModalOpen(true)}
          style={{ ...S, background: "none", border: "none", padding: 0, margin: "0 0 32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", width: "100%" }}
        >
          {matchLabel(match.date, match.time)}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8a9096" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      ) : (
        <button onClick={() => setAddOpen(true)} style={{ ...S, background: "none", border: "none", padding: 0, margin: "0 0 32px", cursor: "pointer", display: "block", width: "100%", textAlign: "center" }}>
          + Add a match
        </button>
      )}

      <hr style={{ width: 80, margin: "0 auto 32px", border: "none", borderTop: "1.5px solid #ccc" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[
          { href: "/insights2a", label: "View Insights" },
          { href: "/track2a", label: "Track Something" },
          { href: "/matches2a", label: "Upcoming Matches" },
        ].map(({ href, label }, i, arr) => (
          <Link key={href} href={href} style={{ ...S, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, paddingBottom: i < arr.length - 1 ? 4 : 0 }}>
            {label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        ))}
      </div>

      {/* Match detail modal */}
      {matchModalOpen && match && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setMatchModalOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4" style={{ background: "#2653d418" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#2653d4" }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#2653d4" }}>Next Match</p>
              </div>
              <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{matchLabel(match.date, match.time).replace("Next Match: ", "")}</h3>
              {match.club && <p className="text-[15px] text-[#6b7480] mt-1">{match.club}</p>}
            </div>
            {match.players && match.players.length > 0 && (
              <div className="px-6 py-5">
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#8a9096] mb-3">Players</p>
                <div className="flex flex-col gap-2">
                  {match.players.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold text-white" style={{ background: "#2653d4" }}>
                        {p.trim()[0]?.toUpperCase()}
                      </div>
                      <p className="text-[17px] text-[#1a1c1c]" style={{ fontFamily: "Inter, sans-serif" }}>{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => { setMatchModalOpen(false); setAddOpen(true); }}
                className="flex-1 text-[15px] font-semibold py-2.5 rounded-2xl active:opacity-60 transition-opacity"
                style={{ background: "#f4f4f4", border: "none", cursor: "pointer", color: "#1a1c1c" }}
              >
                Edit
              </button>
              <button
                onClick={() => setMatchModalOpen(false)}
                className="flex-1 text-[15px] font-semibold py-2.5 rounded-2xl active:opacity-60 transition-opacity"
                style={{ background: "#2653d4", border: "none", cursor: "pointer", color: "#fff" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Match modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)" }} onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: "22px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ ...S, fontSize: 20, fontWeight: 700 }}>Add a match</p>
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
                    style={{ ...S, fontSize: 15, background: "#f4f4f4", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                    <div>
                      <div>Upload screenshot</div>
                      <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Booking confirmation or chat — autofilled</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setStep("form")}
                    style={{ ...S, fontSize: 15, background: "#f4f4f4", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <div>
                      <div>Enter manually</div>
                      <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Date, time, venue, players</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2: upload */}
              {step === "upload" && (
                <div>
                  {uploading ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <p style={{ ...S, color: "#888" }}>Analysing screenshot…</p>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: "block", border: "2px dashed #ddd", borderRadius: 14, padding: "36px 20px", textAlign: "center", cursor: "pointer" }}>
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFile} />
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                        <p style={{ ...S, color: "#555" }}>Choose screenshot</p>
                        <p style={{ ...S, fontSize: 13, color: "#aaa", marginTop: 4 }}>Booking confirmation or WhatsApp</p>
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
                    <button onClick={() => setStep("pick")} style={{ ...S, flex: 1, padding: "10px 0", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer", background: "#fff" }}>Back</button>
                    <button onClick={saveMatch} style={{ ...S, flex: 2, padding: "10px 0", border: "none", borderRadius: 10, cursor: "pointer", background: "#111", color: "#fff" }}>Save match</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      <Nav2a />
    </main>
  );
}
