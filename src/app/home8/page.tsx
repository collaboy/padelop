"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LogSheet from "@/components/log-sheet";
import { computeScores, loadScoringData } from "@/lib/scoring";

const pad = (n: number) => String(n).padStart(2, "0");
const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const ITEM_COLORS: Record<string, string> = {
  "Wake up & hydrate": "#0e7490", "Light breakfast": "#16a34a", "Breakfast": "#16a34a",
  "Morning mobility": "#64748b", "Light mobility": "#64748b",
  "Pre-game meal": "#16a34a", "Warmup & activation": "#d97706",
  "Match": "#2653d4", "Post-match cool down": "#64748b",
  "Recovery meal": "#16a34a", "Recovery walk": "#0e7490",
  "Foam roll & stretch": "#64748b", "Protein-rich lunch": "#16a34a",
  "Cold shower": "#0e7490", "Dinner": "#16a34a",
  "Early wind down": "#64748b", "Balanced lunch": "#16a34a",
  "Active recovery": "#0e7490", "Visualisation": "#64748b",
  "Wind down": "#64748b",
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
      { time: addMins(mH, mM, -360), title: "Pre-game meal",       subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation", subtitle: "Dynamic drills, 30 min" },
      { time: mt,                    title: "Match",                subtitle: "Game time" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",       subtitle: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down", subtitle: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",  subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Light breakfast",     subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Recovery walk",       subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Foam roll & stretch", subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Protein-rich lunch",  subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower",         subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",              subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Early wind down",     subtitle: "Sleep is your best recovery tool tonight" },
    ],
    rest: [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",          subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",     subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "12:30", title: "Balanced lunch",     subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",    subtitle: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",             subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",      subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",          subtitle: "No screens, consistent bedtime" },
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

const SCHEDULE_DETAILS: Record<string, string> = {
  "Wake up & hydrate": "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.",
  "Breakfast": "Oats are a slow-releasing carbohydrate that keeps blood sugar stable for hours. Eggs deliver complete protein to protect muscle. Fruit provides natural sugars and hydrating water content.",
  "Light breakfast": "Keep it light and easily digestible on a recovery day. Eggs provide amino acids for tissue repair. Greek yogurt delivers protein and probiotics.",
  "Morning mobility": "Light mobility work increases range of motion and blood flow without fatiguing your muscles before a match. Key areas for padel: hip flexors, IT band, calves, thoracic spine.",
  "Light mobility": "On rest days, gentle mobility keeps joints lubricated and prevents stiffness. Focus on hip flexors, thoracic rotation, and ankle circles. 10–15 minutes is enough.",
  "Pre-game meal": "A small solid meal 60–90 min before the match tops off energy stores without sitting heavy in your stomach.",
  "Warmup & activation": "Dynamic warmup primes the neuromuscular system. Lateral drills mimic court-side movement patterns. Build from 60% to 80–90% intensity.",
  "Match": "Match time. Focus on early rhythm. Communicate constantly with your partner. Stay hydrated between sets.",
  "Post-match cool down": "Cooling down gradually lowers your heart rate. Static stretching (30-sec holds) is most effective now — muscles are warm and pliable.",
  "Recovery meal": "The 30-minute post-exercise window has the highest rate of muscle protein synthesis. Aim for 20–40 g protein + 60–80 g carbs.",
  "Recovery walk": "Low-intensity movement increases blood flow to fatigued muscles without adding stress. 20 minutes helps flush metabolic waste.",
  "Foam roll & stretch": "Work through quads, IT band, hip flexors, glutes, and calves. Spend 60–90 seconds on each area.",
  "Protein-rich lunch": "Muscle repair peaks in the 24 hours after exercise. Aim for 30–40g of protein from high-quality sources.",
  "Cold shower": "Two minutes of cold water constricts blood vessels, reduces inflammation, and blunts delayed onset muscle soreness.",
  "Dinner": "Focus on anti-inflammatory foods: fatty fish, leafy greens, and complex carbs. Avoid alcohol — it significantly impairs muscle protein synthesis overnight.",
  "Early wind down": "An early wind-down accelerates recovery: dim lights by 9pm, avoid screens, and aim to be in bed by 10:30.",
  "Balanced lunch": "Build your lunch around a variety of colours — each pigment represents a different class of antioxidant that supports tissue repair.",
  "Active recovery": "Light aerobic activity on rest days maintains cardiovascular fitness without accumulating fatigue. Keep heart rate below 130 bpm.",
  "Visualisation": "Mental rehearsal activates the same motor pathways as physical practice. Spend 5 minutes visualising your strongest patterns.",
  "Wind down": "Blue light from screens suppresses melatonin production by up to 50%. In the 60 minutes before bed: dim lights, avoid screens.",
};

const S: React.CSSProperties = { fontFamily: "Inter, sans-serif", fontSize: 17, fontWeight: 400, color: "#111", lineHeight: 1.6 };

export default function Home8() {
  const router = useRouter();
  const [doModalOpen, setDoModalOpen] = useState(false);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; players?: string[] } | null>(null);
  const [now, setNow] = useState(new Date());
  const [doIdx, setDoIdx] = useState(0); // -1 = top holder, 0 = do-this-now, 1 = see schedule
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [readiness, setReadiness] = useState(65);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeDirRef = useRef<'h' | 'v' | null>(null);
  const [cardSnap, setCardSnap] = useState<'none' | 'left' | 'right'>('none');
  const [liveX, setLiveX] = useState(0);

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
        if (m.date && m.time && new Date(`${m.date}T${m.time}`).getTime() > Date.now()) {
          setMatch({ date: m.date, time: m.time, club: m.club || undefined, players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean) });
        }
      }
    } catch {}
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => { clearInterval(id); window.removeEventListener("storage", loadReadiness); };
  }, []);

  useEffect(() => { setCardSnap('none'); setLiveX(0); }, [doIdx]);

  const { schedule, currentIdx } = getScheduleData(match?.date ?? null, match?.time ?? null);
  const doItem = schedule[currentIdx];
  const curMins = now.getHours() * 60 + now.getMinutes();

  const goNext = () => setDoIdx(i => Math.min(i + 1, 1));
  const goPrev = () => setDoIdx(i => Math.max(i - 1, -1));

  return (
    <>
      <main style={{ ...S, position: "fixed", inset: 0, paddingTop: "4rem", paddingLeft: 10, paddingRight: 10, paddingBottom: 0, overflow: "hidden", background: "#ffffff", zIndex: 60 }}>

        {/* Horizontal strip: [readiness | carousel | log] */}
        <div
          style={{
            display: "flex", width: "300%", marginLeft: "-100%",
            height: "calc(100dvh - 4rem)", touchAction: "none",
            transform: cardSnap === 'right' ? "translateX(33.333%)" : cardSnap === 'left' ? "translateX(-33.333%)" : `translateX(${liveX}px)`,
            transition: liveX !== 0 ? "none" : "transform 0s cubic-bezier(0.4,0,0.2,1)",
          }}
          onTouchStart={e => {
            touchStartYRef.current = e.touches[0].clientY;
            touchStartXRef.current = e.touches[0].clientX;
            swipeDirRef.current = null;
          }}
          onTouchMove={e => {
            const dx = e.touches[0].clientX - touchStartXRef.current;
            const dy = e.touches[0].clientY - touchStartYRef.current;
            if (!swipeDirRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
              swipeDirRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (swipeDirRef.current === 'h' && cardSnap === 'none') setLiveX(dx);
          }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartXRef.current;
            const dy = e.changedTouches[0].clientY - touchStartYRef.current;
            if (swipeDirRef.current === 'h') {
              setLiveX(0);
              if (cardSnap === 'none') {
                if (dx < -60) setCardSnap('left');
                else if (dx > 60) setCardSnap('right');
              } else if (cardSnap === 'left' && dx > 60) setCardSnap('none');
              else if (cardSnap === 'right' && dx < -60) setCardSnap('none');
            } else if (swipeDirRef.current === 'v' && cardSnap === 'none') {
              if (dy < -40) goNext();
              else if (dy > 40) goPrev();
            }
            swipeDirRef.current = null;
          }}
        >
          {/* Log panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingRight: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, transform: "translateY(calc(50dvh - 4rem - 3 * (100vw - 40px) / 2 - 10px))" }}>
              {/* Placeholder above */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "white", opacity: 0 }} />
              {/* Main card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", background: "white", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px", marginRight: cardSnap === 'right' ? 0 : -40, opacity: cardSnap === 'right' ? 1 : 0, transition: "margin 0s cubic-bezier(0.4,0,0.2,1), opacity 0s cubic-bezier(0.4,0,0.2,1)" }}>
                <p className="text-[13px] font-bold tracking-widest uppercase" style={{ color: "#9aa5b0" }}>Log Data</p>
                {([
                  { label: "Hydration", color: "#0891b2" },
                  { label: "Check-in", color: "#2653d4" },
                  { label: "Nutrition", color: "#16a34a" },
                  { label: "Recovery", color: "#64748b" },
                ] as const).map(item => (
                  <button key={item.label} onClick={() => { setCardSnap('none'); setLogSheetOpen(true); }} className="w-full py-3 rounded-2xl text-[15px] font-semibold" style={{ background: `${item.color}18`, color: item.color }}>{item.label}</button>
                ))}
              </div>
              {/* Placeholder below */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "white", opacity: 0 }} />
            </div>
          </div>

          {/* Carousel center — all schedule cards, doIdx in transform */}
          <div className="overflow-hidden" style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingLeft: 10, paddingRight: 10 }}>
            <div style={{
              display: "flex", flexDirection: "column", gap: 10,
              transform: `translateY(calc(50dvh - 4rem - (100vw - 40px) / 2 - ${doIdx + 2} * (100vw - 30px)))`,
              transition: "transform 0s cubic-bezier(0.4,0,0.2,1)",
            }}>
              {/* Logo above top card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.12 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 56, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1c1c", display: "flex", alignItems: "flex-end", gap: 1 }}>
                  {["p","a","d","l","a"].map((ch, i) => (
                    <span key={i} style={{ display: "inline-block", transform: `translateY(${(5 - i) * 1.5}px)` }}>{ch}</span>
                  ))}
                  <span style={{ display: "inline-block", width: "0.45em", height: "0.45em", borderRadius: "50%", background: "#22c55e", marginLeft: 3, marginBottom: 8 }} />
                </span>
              </div>

              {/* Card 0: next match */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, overflow: "hidden", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", gap: 8, opacity: cardSnap === 'none' && doIdx === -1 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)" }}>
                <p className="text-[13px] font-bold tracking-widest uppercase text-center" style={{ color: "#9aa5b0" }}>Next Match</p>
                {match ? (() => {
                  const [y, mo, d] = match.date.split('-').map(Number);
                  const dt = new Date(y, mo - 1, d);
                  const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <>
                      <p className="text-[26px] font-bold text-[#1a1c1c] leading-tight text-center">{dateStr}</p>
                      <p className="text-[18px] font-semibold text-[#4a5050] leading-none text-center">{match.time}</p>
                      {match.club && <p className="text-[14px] text-[#6b7480] leading-none text-center">{match.club}</p>}
                      {match.players && match.players.length > 0 && <p className="text-[13px] text-[#9aa5b0] leading-snug text-center">{match.players.join(' · ')}</p>}
                      <button onClick={() => router.push("/matches4")} className="mt-1 text-[13px] font-semibold px-5 py-2 rounded-full" style={{ background: "#2653d418", color: "#2653d4" }}>See Details</button>
                    </>
                  );
                })() : (
                  <>
                    <p className="text-[18px] font-semibold text-[#9aa5b0] text-center">No match set</p>
                    <button onClick={() => router.push("/matches4")} className="mt-1 text-[13px] font-semibold px-5 py-2 rounded-full" style={{ background: "#2653d418", color: "#2653d4" }}>Add Match</button>
                  </>
                )}
              </div>

              {/* Card 1: do-this-now */}
              {(() => {
                const s = doItem;
                const isDone = completed.has(currentIdx);
                const isReady = curMins >= toMins(s.time);
                const nextSlide = schedule[currentIdx + 1];
                const minsUntilNext = nextSlide ? toMins(nextSlide.time) - curMins : 0;
                const fmtMins = (m: number) => { if (m <= 0) return "a moment"; const h = Math.floor(m / 60), rem = m % 60; if (h > 0 && rem > 0) return `${h}h ${rem}m`; return h > 0 ? `${h}h` : `${rem}m`; };
                const cardStyle: React.CSSProperties = { width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, overflow: "hidden", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", opacity: cardSnap === 'none' && doIdx === 0 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)" };
                if (isDone) return (
                  <div key="active" style={cardStyle} onClick={() => setDoModalOpen(true)}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: `${s.color}18` }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p className="text-[52px] font-bold text-[#1a1c1c] leading-none text-center">Good Job!</p>
                    <p className="text-[30px] font-semibold text-[#4a5050] mt-1 leading-none text-center">{s.title} complete</p>
                    {nextSlide && <div className="mt-4 text-center"><p className="text-[26px] text-[#8a9096] leading-none">See you in <span className="font-semibold text-[#4a5050]">{fmtMins(minsUntilNext)}</span> for:</p><p className="text-[28px] font-bold text-[#1a1c1c] mt-1 leading-none">{nextSlide.title}</p></div>}
                  </div>
                );
                return (
                  <div key="active" style={cardStyle} onClick={() => setDoModalOpen(true)}>
                    <p className="text-[24px] font-bold tracking-widest uppercase leading-none mb-1" style={{ color: "#5a7055" }}>Do this now</p>
                    <p className="text-[48px] font-bold text-[#1a1c1c] leading-tight text-center">{s.title}</p>
                    {s.subtitle && <p className="text-[30px] text-[#6b7480] leading-none text-center mt-0.5">{s.subtitle}</p>}
                    <button onClick={e => { e.stopPropagation(); setDoModalOpen(true); }} className="mt-3 text-[26px] font-semibold px-5 py-2 rounded-full" style={{ background: isReady ? `${s.color}18` : "#f0f0f0", color: isReady ? s.color : "#b0b5ba" }}>Complete</button>
                  </div>
                );
              })()}

              {/* Card 2: today's schedule */}
              <div key="sched" style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, overflow: "hidden", background: "white", display: "flex", flexDirection: "column", padding: "20px 0 0", opacity: cardSnap === 'none' && doIdx === 1 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)" }}>
                <p className="text-[13px] font-bold tracking-widest uppercase text-center mb-3" style={{ color: "#9aa5b0", flexShrink: 0 }}>Today&apos;s Schedule</p>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
                  {schedule.map((s, i) => {
                    const isCur = i === currentIdx;
                    const isPast = !isCur && curMins > toMins(s.time);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < schedule.length - 1 ? "1px solid #f4f4f4" : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: isPast ? "#f0f0f0" : `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isPast ? "#d0d3d6" : s.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isPast ? "#c4c7c7" : s.color, margin: 0 }}>{s.time}</p>
                          <p style={{ fontSize: 14, fontWeight: isCur ? 700 : 500, color: isPast ? "#a0a5aa" : "#1a1c1c", margin: 0, lineHeight: 1.3 }}>{s.title}</p>
                        </div>
                        {isCur && <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Readiness panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingLeft: 20, paddingTop: "calc(50dvh - 4rem - (100vw - 40px) / 2)" }}>
            <div style={{ width: "100%", height: "calc(100vw - 40px)", background: "white", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 24px", marginLeft: cardSnap === 'left' ? 0 : -40, opacity: cardSnap === 'left' ? 1 : 0, transition: "margin 0s cubic-bezier(0.4,0,0.2,1), opacity 0s cubic-bezier(0.4,0,0.2,1)" }}>
              <p className="text-[13px] font-bold tracking-widest uppercase" style={{ color: "#9aa5b0" }}>Match Readiness</p>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#2653d4" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - readiness / 100)}`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="700" fill="#1a1c1c" fontFamily="Inter, sans-serif">{readiness}</text>
              </svg>
              <button onClick={() => router.push("/insights4")} className="text-[13px] font-semibold px-5 py-2 rounded-full" style={{ background: "#2653d418", color: "#2653d4" }}>See Breakdown</button>
            </div>
          </div>
        </div>

        {/* Complete modal */}
        {doModalOpen && doItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setDoModalOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden max-h-[88vh] overflow-y-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
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
                  const isComplete = completed.has(currentIdx);
                  return (
                    <button
                      onClick={() => { setDoModalOpen(false); setCompleted(prev => { const n = new Set(prev); isComplete ? n.delete(currentIdx) : n.add(currentIdx); return n; }); }}
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


        {/* FAB */}
        <button
          onClick={() => setLogSheetOpen(true)}
          className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: doItem?.color ?? "#2653d4", boxShadow: `0 4px 16px ${doItem?.color ?? "#2653d4"}55` }}
          aria-label="Log activity"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <LogSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
      </main>
    </>
  );
}
