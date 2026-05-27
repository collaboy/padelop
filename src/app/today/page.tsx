"use client";

import { useState, useEffect, useRef } from "react";

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
  "Pre-training meal": "Fuel up 1.5–2 hours before training: moderate carbs (oats, rice, banana) and some protein. Don't train fasted for high-intensity sessions — you'll fatigue faster and retain less of the session.",
  "Pre-training activation": "10 minutes of dynamic movement before training improves power output and reduces injury risk. Lateral shuffles, hip circles, leg swings, and arm rotations prime the patterns you'll use on court.",
  "Training session": "A padel training session is an opportunity to drill patterns deliberately — something match play doesn't always allow. Focus on one or two specific skills per session. Quality of repetitions matters more than volume.",
  "Post-training stretch": "After training, your muscles are warm and pliable — the best window for flexibility work. Hold each stretch for 30–45 seconds. Prioritise hip flexors, hamstrings, and shoulder external rotators.",
  "Post-training protein": "Consume 20–40g protein within 30 minutes of finishing training to maximise muscle protein synthesis. A protein shake, Greek yogurt, or eggs all work. Pair with fast carbs (banana, rice cake) to replenish glycogen.",
};

const DAY_TYPE_META = {
  match:    { label: "Game Day",      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
  recovery: { label: "Recovery Day",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10"/><path d="M12 6v6l4 2"/></svg> },
  training: { label: "Training Day",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5v14M18 5v14M2 9h4M18 9h4M2 15h4M18 15h4"/></svg> },
  rest:     { label: "Rest Day",      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
};

export default function TodayPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [dayTypeOverride, setDayTypeOverride] = useState<"recovery" | "training" | "rest" | null>(null);
  const [scheduleModal, setScheduleModal] = useState<{ title: string; subtitle?: string; detail: string; color: string } | null>(null);
  const [matchData, setMatchData] = useState<Record<string, string>>({});
  const currentRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);

    function loadMatch() {
      try {
        const raw = localStorage.getItem("padelop:next-match");
        if (raw) setMatchData(JSON.parse(raw));
      } catch {}
    }
    loadMatch();
    window.addEventListener("storage", loadMatch);
    return () => { clearInterval(tick); window.removeEventListener("storage", loadMatch); };
  }, []);

  const todayYMD = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    : "";
  const isMatchDay = !!todayYMD && matchData.date === todayYMD && !!matchData.time;

  let dayTypeAuto: "match" | "recovery" | "training" | "rest" = "rest";
  if (isMatchDay) {
    dayTypeAuto = "match";
  } else if (now) {
    try {
      const rev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0];
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayYMD = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      if (rev?.ts && rev.ts.slice(0, 10) === yesterdayYMD) dayTypeAuto = "recovery";
    } catch {}
  }
  const dayType = isMatchDay ? "match" : (dayTypeOverride ?? dayTypeAuto);

  const pad = (n: number) => String(n).padStart(2, "0");
  const matchTime = matchData.time || "18:30";
  const [mH, mM] = matchTime.split(":").map(Number);
  const addMins = (h: number, m: number, delta: number) => {
    const total = h * 60 + m + delta;
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  };
  const matchVenue = [matchData.club, matchData.court ? `Court ${matchData.court}` : ""].filter(Boolean).join(" — ") || "Court";

  const schedules = {
    match: [
      { time: "07:00", title: "Wake up & hydrate",    subtitle: "500ml water before anything else",   color: "#f59e0b" },
      { time: "07:30", title: "Breakfast",             subtitle: "Oats, eggs, fruit",                  color: "#16a34a" },
      { time: "09:00", title: "Morning mobility",      subtitle: "Foam roll & light stretching",        color: "#0891b2" },
      { time: addMins(mH, mM, -360), title: "Pre-game meal", subtitle: "Chicken, rice, light salad",   color: "#16a34a" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation", subtitle: "Dynamic drills, 30 min", color: "#2653d4" },
      { time: matchTime,             title: "Match",   subtitle: matchVenue,                           color: "#1e3a1e" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min", color: "#7c3aed" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal", subtitle: "Protein + carbs within 30 min", color: "#16a34a" },
      { time: "22:30", title: "Wind down",             subtitle: "No screens, light reading",           color: "#94a3b8" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",      subtitle: "500ml water — rehydrate after yesterday", color: "#f59e0b" },
      { time: "08:00", title: "Light breakfast",         subtitle: "Eggs, fruit, Greek yogurt",               color: "#16a34a" },
      { time: "09:30", title: "Recovery walk",           subtitle: "20 min easy — flush out lactic acid",     color: "#0891b2" },
      { time: "10:30", title: "Foam roll & stretch",     subtitle: "Quads, hip flexors, calves, shoulders",   color: "#7c3aed" },
      { time: "13:00", title: "Protein-rich lunch",      subtitle: "Chicken, salmon or legumes + veg",        color: "#16a34a" },
      { time: "15:30", title: "Cold shower",             subtitle: "2 min cold — reduces inflammation",       color: "#2653d4" },
      { time: "18:30", title: "Dinner",                  subtitle: "Anti-inflammatory focus — fish, greens",  color: "#16a34a" },
      { time: "21:30", title: "Early wind down",         subtitle: "Sleep is your best recovery tool tonight", color: "#94a3b8" },
    ],
    rest: [
      { time: "07:00", title: "Wake up & hydrate",      subtitle: "500ml water before coffee",               color: "#f59e0b" },
      { time: "07:30", title: "Breakfast",               subtitle: "High protein — eggs, yogurt, fruit",      color: "#16a34a" },
      { time: "09:30", title: "Light mobility",          subtitle: "Hip flexors, thoracic spine, ankles",      color: "#0891b2" },
      { time: "12:30", title: "Balanced lunch",          subtitle: "Carbs + protein + greens",                color: "#16a34a" },
      { time: "15:00", title: "Active recovery",         subtitle: "Walk, swim or light cycling",             color: "#2653d4" },
      { time: "18:30", title: "Dinner",                  subtitle: "Focus on variety and micronutrients",     color: "#16a34a" },
      { time: "21:00", title: "Visualisation",           subtitle: "5 min mental rehearsal of key patterns",  color: "#7c3aed" },
      { time: "22:30", title: "Wind down",               subtitle: "No screens, consistent bedtime",          color: "#94a3b8" },
    ],
    training: [
      { time: "07:00", title: "Wake up & hydrate",       subtitle: "500ml water before anything else",        color: "#f59e0b" },
      { time: "07:30", title: "Breakfast",                subtitle: "Oats, eggs, fruit",                       color: "#16a34a" },
      { time: "09:00", title: "Morning mobility",         subtitle: "Foam roll & light stretching",             color: "#0891b2" },
      { time: "15:00", title: "Pre-training meal",        subtitle: "Carbs + protein, 1.5–2h before session",  color: "#16a34a" },
      { time: "17:00", title: "Pre-training activation",  subtitle: "10 min dynamic warm-up",                   color: "#2653d4" },
      { time: "17:30", title: "Training session",         subtitle: "Focus on one or two deliberate patterns",  color: "#1e3a1e" },
      { time: "19:00", title: "Post-training stretch",    subtitle: "30–45 sec holds — hip flexors, shoulders", color: "#7c3aed" },
      { time: "19:30", title: "Post-training protein",    subtitle: "20–40g protein within 30 min",             color: "#16a34a" },
      { time: "21:00", title: "Dinner",                   subtitle: "Anti-inflammatory focus — fish, greens",   color: "#16a34a" },
      { time: "22:30", title: "Wind down",                subtitle: "No screens, consistent bedtime",           color: "#94a3b8" },
    ],
  };

  const schedule = schedules[dayType];
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const curMins = now ? now.getHours() * 60 + now.getMinutes() : -1;

  useEffect(() => {
    if (now && currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [now]);

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      <div className="px-4 pt-6 pb-8">
        <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="h1-headline-md text-black">Today&apos;s Schedule</h3>
            <button
              onClick={() => { if (dayType !== "match") setDayTypeOverride(v => v === "recovery" ? "training" : v === "training" ? "rest" : "recovery"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e2e2e2] active:opacity-60 transition-opacity"
              style={{ cursor: dayType === "match" ? "default" : "pointer" }}
            >
              <span className="text-[#747878]">{DAY_TYPE_META[dayType].icon}</span>
              <span className="text-[11px] font-semibold text-[#747878]">{DAY_TYPE_META[dayType].label}</span>
              {dayType !== "match" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>}
            </button>
          </div>
          <div>
            {schedule.map(({ time, title, subtitle, color }, idx, arr) => {
              const isLast = idx === arr.length - 1;
              const bMins = toMins(time);
              const nMins = !isLast ? toMins(arr[idx + 1].time) : 24 * 60;
              const isCurrent = !isLast && curMins >= bMins && curMins < nMins;
              const segPct = isCurrent ? ((curMins - bMins) / (nMins - bMins)) * 100 : 0;
              const isPast = curMins >= nMins;
              const detail = SCHEDULE_DETAILS[title];
              return (
                <div key={idx} ref={isCurrent ? currentRowRef : undefined} className="flex gap-3">
                  <div className="w-11 flex-shrink-0 pt-0.5">
                    <p className="text-[13px] font-semibold text-[#444748] text-right leading-none">{time}</p>
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0 transition-opacity"
                      style={{ background: color, opacity: isPast ? 0.35 : 1 }}
                    />
                    {!isLast && (
                      <div className="relative mt-1" style={{ width: 1, flex: 1, minHeight: 32, background: "#e2e2e2", overflow: "visible" }}>
                        {isCurrent && (
                          <div className="absolute flex items-center" style={{ top: `${segPct}%`, right: 0, transform: "translateY(-50%)" }}>
                            <span className="text-[13px] font-bold text-white px-2 py-0.5 rounded whitespace-nowrap mr-0.5" style={{ background: "#496640" }}>
                              {now ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "--:--"}
                            </span>
                            <svg width="6" height="8" viewBox="0 0 6 8"><polygon points="0,0 6,4 0,8" fill="#1a1c1c" /></svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="pb-4 flex-1 min-w-0 flex items-start justify-between gap-2 text-left active:opacity-60 transition-opacity"
                    onClick={() => detail && setScheduleModal({ title, subtitle, detail, color })}
                  >
                    <div className="min-w-0">
                      <p className="text-[18px] font-semibold text-[#1a1c1c] leading-tight" style={{ opacity: isPast ? 0.4 : 1 }}>{title}</p>
                      {subtitle && <p className="text-[14px] text-[#444748] leading-snug mt-0.5" style={{ opacity: isPast ? 0.4 : 1 }}>{subtitle}</p>}
                    </div>
                    {detail && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#d4d7d9" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0 mt-1.5">
                        <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setScheduleModal(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-[640px] bg-white rounded-t-[28px] pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4" style={{ background: scheduleModal.color + "18" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: scheduleModal.color }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: scheduleModal.color }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="h1-headline-md text-[#1a1c1c]">{scheduleModal.title}</h3>
              {scheduleModal.subtitle && <p className="text-[13px] text-[#444748] mt-0.5">{scheduleModal.subtitle}</p>}
            </div>
            <div className="px-6 pt-5">
              <p className="h1-body-lg text-[#444748] leading-relaxed">{scheduleModal.detail}</p>
            </div>
            <button onClick={() => setScheduleModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/8 flex items-center justify-center active:opacity-60">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#444748" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
