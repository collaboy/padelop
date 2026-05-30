"use client";

import React, { useState, useEffect, useRef } from "react";
import Nav4 from "@/components/nav4";

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
  return { schedule, currentIdx: idx };
}

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
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; players?: string[] } | null>(null);
  const [now, setNow] = useState(new Date());
  const [doSlideIdx, setDoSlideIdx] = useState(0);
  const doTouchStartX = useRef(0);

  useEffect(() => {
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
            setDoSlideIdx(getScheduleData(m.date, m.time).currentIdx);
          }
        }
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);


  return (
    <main style={{ ...S, padding: "24px 20px 120px", minHeight: "100vh", background: "#f9f9f9" }}>

      {(() => {
        const { schedule, currentIdx } = getScheduleData(match?.date ?? null, match?.time ?? null);
        const safeDoIdx = Math.min(doSlideIdx, schedule.length - 1);
        const doItem = schedule[safeDoIdx];
        void now;
        return (
          <>
            {/* Do This Now — swipeable through schedule items */}
            <div
              className="w-full overflow-hidden"
              style={{ borderRadius: 24, marginBottom: 10, aspectRatio: "1" }}
              onTouchStart={e => { doTouchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                const dx = e.changedTouches[0].clientX - doTouchStartX.current;
                if (Math.abs(dx) > 40)
                  setDoSlideIdx(prev => dx < 0 ? Math.min(prev + 1, schedule.length - 1) : Math.max(prev - 1, 0));
              }}
            >
              <div style={{
                display: "flex",
                height: "100%",
                transform: `translateX(calc(-${safeDoIdx} * 100%))`,
                transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
              }}>
                {schedule.map((s, i) => (
                  <div key={i} style={{ flex: "0 0 100%", height: "100%", flexShrink: 0 }}>
                    <button
                      onClick={() => setDoModalOpen(true)}
                      className="bg-white rounded-[24px] px-6 py-6 flex flex-col justify-end active:opacity-60 transition-opacity text-left w-full h-full relative overflow-hidden"
                      style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: `2px solid ${s.color}` }}
                    >
                      <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200" fill="none" stroke={s.color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                        {(i % 6 === 0) && <><path d="M 98,32 C 122,32 165,50 165,72 C 165,95 138,145 112,145 C 85,145 52,125 52,100 C 52,75 74,32 98,32 Z" /><path d="M 48,142 C 56,142 62,150 62,158 C 62,166 56,174 48,174 C 40,174 34,166 34,158 C 34,150 40,142 48,142 Z" /><path d="M 38,30 C 47,30 54,38 54,46 C 54,54 47,62 38,62 C 29,62 22,54 22,46 C 22,38 29,30 38,30 Z" /></>}
                        {(i % 6 === 1) && <><path d="M 75,30 C 98,30 118,58 118,82 C 118,108 100,158 78,158 C 56,158 40,122 40,95 C 40,68 52,30 75,30 Z" /><path d="M 145,90 C 158,90 168,100 168,112 C 168,124 160,132 148,132 C 136,132 126,122 126,112 C 126,102 132,90 145,90 Z" /><path d="M 155,30 C 163,30 170,38 170,46 C 170,54 163,62 155,62 C 147,62 140,54 140,46 C 140,38 147,30 155,30 Z" /></>}
                        {(i % 6 === 2) && <><path d="M 95,28 C 130,28 168,58 168,90 C 168,122 142,168 105,168 C 68,168 32,132 32,100 C 32,68 60,28 95,28 Z" /><path d="M 155,148 C 164,148 172,155 172,162 C 172,169 164,176 155,176 C 146,176 138,169 138,162 C 138,155 146,148 155,148 Z" /></>}
                        {(i % 6 === 3) && <><path d="M 62,35 C 86,35 108,55 108,78 C 108,102 92,128 70,128 C 48,128 30,105 30,82 C 30,59 38,35 62,35 Z" /><path d="M 148,92 C 160,92 170,102 170,115 C 170,128 162,138 150,138 C 138,138 128,128 128,115 C 128,102 136,92 148,92 Z" /><path d="M 158,32 C 166,32 172,39 172,46 C 172,53 166,60 158,60 C 150,60 144,53 144,46 C 144,39 150,32 158,32 Z" /></>}
                        {(i % 6 === 4) && <><path d="M 100,35 C 130,35 160,60 160,88 C 160,116 138,152 108,152 C 78,152 48,128 48,100 C 48,72 70,35 100,35 Z" /><path d="M 42,32 C 51,32 58,40 58,50 C 58,60 51,68 42,68 C 33,68 26,60 26,50 C 26,40 33,32 42,32 Z" /><path d="M 158,152 C 166,152 172,158 172,165 C 172,172 166,178 158,178 C 150,178 144,172 144,165 C 144,158 150,152 158,152 Z" /></>}
                        {(i % 6 === 5) && <><path d="M 95,40 C 132,40 165,60 165,82 C 165,104 142,132 108,132 C 74,132 36,110 36,88 C 36,66 58,40 95,40 Z" /><path d="M 158,30 C 167,30 174,38 174,46 C 174,54 167,62 158,62 C 149,62 142,54 142,46 C 142,38 149,30 158,30 Z" /><path d="M 42,148 C 51,148 58,155 58,162 C 58,169 51,176 42,176 C 33,176 26,169 26,162 C 26,155 33,148 42,148 Z" /></>}
                      </svg>
                      {/* Dot — centered in card */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-36 h-36 rounded-full flex items-center justify-center" style={{ background: `${s.color}12` }}>
                          {i === currentIdx ? (
                            <div className="w-16 h-16 rounded-full breathe-strong" style={{ background: s.color, ["--glow" as string]: s.color } as React.CSSProperties} />
                          ) : (
                            <div className="w-16 h-16 rounded-full" style={{ background: s.color }} />
                          )}
                        </div>
                      </div>
                      {/* Text — bottom */}
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055] mb-1">{i === currentIdx ? "Do this now" : s.time}</p>
                        <p className="text-[22px] font-bold text-[#1a1c1c] leading-tight">{s.title}</p>
                        {s.subtitle && <span className="inline-flex items-center gap-1 mt-1"><span className="text-[13px] text-[#6b7480] leading-snug">{s.subtitle}</span></span>}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

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
                </div>
              </div>
            )}
          </>
        );
      })()}

      <Nav4 />
    </main>
  );
}
