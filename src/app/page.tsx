"use client";

import { useState, useEffect, useRef } from "react";
import { computeScores, loadScoringData, saveCheckIn, computeAllTimeScores, type Scores } from "@/lib/scoring";
import { computeNotifications, type Notif } from "@/lib/notifications";

const FIELD_LABELS: Record<string, string> = {
  date: "Date",
  time: "Time",
  player_1: "Player 1",
  player_2: "Player 2",
  player_3: "Player 3",
  player_4: "Player 4",
  club: "Club / Venue",
  court: "Court",
};

export default function HomePage() {
  const [hydration, setHydration] = useState(false);
  const [mobility, setMobility] = useState(false);
  const [visualise, setVisualise] = useState(true);
  const [preMatchMeal, setPreMatchMeal] = useState(false);
  const [sleep, setSleep] = useState(false);
  const [boxBreathing, setBoxBreathing] = useState(false);
  const [foamRoll, setFoamRoll] = useState(false);
  const [coldShower, setColdShower] = useState(false);
  const [proteinMeal, setProteinMeal] = useState(false);
  const [lightWalk, setLightWalk] = useState(false);
  const [balancedNutrition, setBalancedNutrition] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<{ title: string; subtitle?: string; detail: string; color: string } | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkIn, setCheckIn] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });
  const [countdown, setCountdown] = useState({ h: 0, m: 0, past: false });
  const [fabOpen, setFabOpen] = useState(false);
  const [routineModal, setRoutineModal] = useState<{ label: string; detail: string } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{ label: string; pct: number; color: string; subtitle: string; detail: string } | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [mustDoExpanded, setMustDoExpanded] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [hydroOpen, setHydroOpen] = useState(false);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [hydrationLog, setHydrationLog] = useState({ litres: "", timing: [] as string[], quality: "", urine: "" });
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [nutritionLog, setNutritionLog] = useState({ proteinRating: "", foods: [] as string[], postMatch: "", quality: "" });
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [allTimeScores, setAllTimeScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [scoreView, setScoreView] = useState<"today" | "alltime">("today");
  const [dayTypeOverride, setDayTypeOverride] = useState<"recovery" | "training" | "rest" | null>(null);
  const [improveOpen, setImproveOpen] = useState(false);
  const [timelineIdx, setTimelineIdx] = useState<number | null>(null);
  const [matchReviewOpen, setMatchReviewOpen] = useState(false);
  const [matchReview, setMatchReview] = useState({ feeling: "", result: "", opponent: "", energy: "", injury: "", wellDone: [] as string[], improved: [] as string[], mentalBefore: "", mentalDuring: "", mentalAfter: "" });

  function loadAndScore() {
    const data = loadScoringData();
    setScores(computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek));
    setAllTimeScores(computeAllTimeScores());
    // Pre-populate check-in if we have today's saved entry
    if (data.checkIn) {
      setCheckIn({ sleep: data.checkIn.sleep, energy: data.checkIn.energy, soreness: data.checkIn.soreness, hydration: data.checkIn.hydration });
      setCheckInDone(true);
    }
  }

  // Match info state
  const [matchInfoOpen, setMatchInfoOpen] = useState(false);
  const [matchInfoDone, setMatchInfoDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Record<string, string | null> | null>(null);
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const [playerSlots, setPlayerSlots] = useState<string[]>(["", "", "", ""]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const dragSlot = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSlotTap = (idx: number) => {
    if (selectedSlot === null) { setSelectedSlot(idx); return; }
    if (selectedSlot === idx) { setSelectedSlot(null); return; }
    setPlayerSlots(s => { const n = [...s]; [n[selectedSlot], n[idx]] = [n[idx], n[selectedSlot]]; return n; });
    setSelectedSlot(null);
  };

  // Load scoring data and compute scores on mount
  useEffect(() => { loadAndScore(); }, []);

  // Load saved match info from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("padelop:next-match");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setExtractedData(parsed);
        setEditedData(Object.fromEntries(
          Object.keys(FIELD_LABELS).map(k => [k, parsed[k] ?? ""])
        ));
        setPlayerSlots([parsed.player_1 ?? "", parsed.player_2 ?? "", parsed.player_3 ?? "", parsed.player_4 ?? ""]);
        setMatchInfoDone(true);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let match: Date;
      if (editedData.date && editedData.time) {
        match = new Date(`${editedData.date}T${editedData.time}:00`);
      } else {
        match = new Date();
        match.setHours(18, 30, 0, 0);
      }
      if (isNaN(match.getTime())) { setCountdown({ h: 0, m: 0, past: false }); return; }
      const diff = match.getTime() - now.getTime();
      if (diff <= 0) { setCountdown({ h: 0, m: 0, past: true }); return; }
      const total = Math.floor(diff / 60000);
      setCountdown({ h: Math.floor(total / 60), m: total % 60, past: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [editedData.date, editedData.time]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Image is too large. Please use a screenshot under 4 MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      try {
        const res = await fetch("/api/extract-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType: file.type }),
        });
        const data = await res.json();
        if (data.error) {
          setUploadError(data.message || "Couldn't read that screenshot. Please try another.");
          setUploading(false);
          return;
        }
        setExtractedData(data);
        setEditedData(Object.fromEntries(
          Object.keys(FIELD_LABELS).map(k => [k, data[k] ?? ""])
        ));
        setPlayerSlots([data.player_1 ?? "", data.player_2 ?? "", data.player_3 ?? "", data.player_4 ?? ""]);
        setUploading(false);
      } catch {
        setUploadError("Network error. Please try again.");
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmMatchInfo = () => {
    const data = { ...editedData, player_1: playerSlots[0], player_2: playerSlots[1], player_3: playerSlots[2], player_4: playerSlots[3] };
    localStorage.setItem("padelop:next-match", JSON.stringify(data));
    setExtractedData(data);
    setMatchInfoDone(true);
    setMatchInfoOpen(false);
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
    "Pre-training meal": "Fuel up 1.5–2 hours before training: moderate carbs (oats, rice, banana) and some protein. Don't train fasted for high-intensity sessions — you'll fatigue faster and retain less of the session.",
    "Pre-training activation": "10 minutes of dynamic movement before training improves power output and reduces injury risk. Lateral shuffles, hip circles, leg swings, and arm rotations prime the patterns you'll use on court.",
    "Training session": "A padel training session is an opportunity to drill patterns deliberately — something match play doesn't always allow. Focus on one or two specific skills per session. Quality of repetitions matters more than volume.",
    "Post-training stretch": "After training, your muscles are warm and pliable — the best window for flexibility work. Hold each stretch for 30–45 seconds. Prioritise hip flexors, hamstrings, and shoulder external rotators.",
    "Post-training protein": "Consume 20–40g protein within 30 minutes of finishing training to maximise muscle protein synthesis. A protein shake, Greek yogurt, or eggs all work. Pair with fast carbs (banana, rice cake) to replenish glycogen.",
  };

  // Shared day type — used by schedule, must-dos, and the badge
  const todayYMD = new Date().toISOString().slice(0, 10);
  const isMatchDay = editedData.date === todayYMD && !!editedData.time;
  let dayTypeAuto: "match" | "recovery" | "training" | "rest" = "rest";
  if (isMatchDay) {
    dayTypeAuto = "match";
  } else {
    try {
      const rev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0];
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      if (rev?.ts && new Date(rev.ts).toISOString().slice(0, 10) === yesterday.toISOString().slice(0, 10)) dayTypeAuto = "recovery";
    } catch {}
  }
  const dayType = isMatchDay ? "match" : (dayTypeOverride ?? dayTypeAuto);

  const DAY_TYPE_META = {
    match:    { label: "Game Day",      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
    recovery: { label: "Recovery Day",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10"/><path d="M12 6v6l4 2"/></svg> },
    training: { label: "Training Day",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5v14M18 5v14M2 9h4M18 9h4M2 15h4M18 15h4"/></svg> },
    rest:     { label: "Rest Day",      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
  };

  return (
    <>
      {/* Fonts hoisted to <head> by React 19 */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      />
      <style>{`
        .h1-font { font-family: 'Inter', sans-serif; }
        .h1-display { font-size: 40px; line-height: 48px; font-weight: 700; letter-spacing: -0.02em; }
        .h1-headline-md { font-size: 20px; line-height: 28px; font-weight: 600; }
        .h1-label-sm { font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.05em; }
        .h1-body-md { font-size: 15px; line-height: 22px; font-weight: 400; }
        .h1-body-lg { font-size: 17px; line-height: 26px; font-weight: 400; }
        .h1-ambient { box-shadow: 0px 4px 20px rgba(0,0,0,0.04); }
        @keyframes colonBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        .colon-blink { animation: colonBlink 1s step-start infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .h1-spin { animation: spin 0.9s linear infinite; }
        @keyframes speedDialUp { from { opacity:0; transform:translateY(10px) scale(0.88); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes confettiFall { 0% { transform:translateY(-10px) rotate(0deg); opacity:0; } 12% { opacity:1; } 88% { opacity:1; } 100% { transform:translateY(58px) rotate(220deg); opacity:0; } }
        .h1-slider { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:9999px; background:#e2e2e2; outline:none; }
        .h1-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:22px; height:22px; border-radius:50%; background:#496640; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.15); }
        .h1-slider::-moz-range-thumb { width:22px; height:22px; border-radius:50%; background:#496640; cursor:pointer; border:none; }
        .h1-ring {
          transition: stroke-dashoffset 0.8s ease-in-out;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          display: inline-block;
          text-transform: none;
          letter-spacing: normal;
          white-space: nowrap;
          -webkit-font-smoothing: antialiased;
        }
        .h1-field-input {
          width: 100%;
          padding: 8px 12px;
          border: 1.5px solid #e2e2e2;
          border-radius: 12px;
          font-size: 14px;
          color: #1a1c1c;
          background: #f9f9f9;
          outline: none;
          font-family: 'Inter', sans-serif;
        }
        .h1-field-input:focus { border-color: #496640; background: #fff; }
      `}</style>

      <div className="h1-font bg-[#f9f9f9] text-[#1a1c1c] min-h-screen">
        <main className="pt-4 pb-8 px-5 max-w-lg mx-auto">

          {/* Daily Readiness */}
          {(() => {
            const active = scoreView === "today" ? scores : allTimeScores;
            return (
              <section className="flex flex-col items-center text-center mb-8 mt-4">
                <div className="relative mb-3" style={{ width: 210, height: 210 }}>
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="transparent" strokeWidth="6" className="stroke-current text-[#e2e2e2]" />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="transparent" strokeWidth="6" strokeLinecap="round"
                      className="h1-ring stroke-current text-[#2653d4]"
                      style={{ strokeDasharray: 264, strokeDashoffset: 264 * (1 - active.overall / 100) }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-black" style={{ fontSize: 68, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.02em" }}>{active.overall}</span>
                    <span className="h1-label-sm text-[#444748] uppercase tracking-wider">Readiness</span>
                  </div>
                </div>
                {/* Toggle */}
                <div className="flex items-center bg-[#f0f0f0] rounded-full p-1 mb-3">
                  {(["today", "alltime"] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setScoreView(v)}
                      className="px-4 py-1 rounded-full text-[12px] font-semibold transition-all"
                      style={{
                        background: scoreView === v ? "#fff" : "transparent",
                        color: scoreView === v ? "#1a1c1c" : "#747878",
                        boxShadow: scoreView === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      {v === "today" ? "Today" : "All-time"}
                    </button>
                  ))}
                </div>
                <p className="text-[17px] leading-[26px] text-[#444748] px-4 mb-4">
                  {active.overall >= 85
                    ? "Optimal recovery achieved. You're primed for high-intensity movement today."
                    : active.overall >= 70
                    ? "Good base. Address your lowest category to push readiness higher."
                    : active.overall >= 55
                    ? "Some gaps in recovery or fuel. Log your check-in to get a clearer picture."
                    : "Your readiness is low — prioritise sleep, hydration, and recovery today."}
                </p>
                <button onClick={() => setImproveOpen(true)} className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-white border border-[#e2e2e2] active:opacity-70 transition-opacity">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                  <span className="text-[13px] font-semibold text-[#1a1c1c]">Improve</span>
                </button>
              </section>
            );
          })()}

          <div className="space-y-4">

            {/* Match Countdown + Next Match (merged) */}
            <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 overflow-hidden">
              {/* Countdown */}
              <div className="flex items-center">
                <div className="w-1/2 px-6 py-4">
                  <p className="h1-label-sm text-[#747878] uppercase tracking-widest">Next Match Starts in</p>
                </div>
                <div className="w-1/2 px-6 py-4 border-l border-[#e2e2e2] flex items-center justify-center">
                  <div className="h1-font text-[32px] font-bold text-[#1a1c1c] leading-none tracking-tight">
                    {countdown.past
                      ? <span className="text-[#496640]">Now</span>
                      : <>{String(countdown.h).padStart(2, "0")}<span className="colon-blink">:</span>{String(countdown.m).padStart(2, "0")}</>
                    }
                  </div>
                </div>
              </div>
              <div className="border-t border-[#e2e2e2]" />
              {/* Match info */}
              <div className="px-6 pt-4 pb-4 relative">
                {(() => {
                  const teamA = [playerSlots[0], playerSlots[1]].filter(Boolean);
                  const teamB = [playerSlots[2], playerSlots[3]].filter(Boolean);
                  const title = teamA.length || teamB.length
                    ? `${teamA.join(" & ")} vs ${teamB.join(" & ")}`
                    : "Next Match";
                  const club = editedData.club || "Location TBD";
                  const court = editedData.court ? `Court ${editedData.court}` : "";
                  const sideA = [playerSlots[0], playerSlots[1]].filter(Boolean).join(" & ") || "Team A";
                  const sideB = [playerSlots[2], playerSlots[3]].filter(Boolean).join(" & ") || "Team B";
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="h1-headline-md text-[#1a1c1c]">Padel Match</p>
                        <span className="text-[15px] font-semibold text-[#747878]">{editedData.time || "—"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-[#747878] mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                          <span className="text-[13px] font-medium leading-tight">{club}</span>
                        </div>
                        {court && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sports_tennis</span>
                            <span className="text-[13px] font-medium leading-tight">{court}</span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-5 top-1/2 -translate-y-1/2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              <div className="border-t border-[#e2e2e2]" />
              <div className="flex divide-x divide-[#e2e2e2]">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-week-plan"))}
                  className="flex-1 px-4 py-3 flex items-center justify-center gap-2 active:opacity-60 transition-opacity"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aab96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span className="text-[12px] font-medium text-[#9aab96]">See week</span>
                </button>
                <button
                  onClick={() => { setExtractedData(null); setUploadError(null); setMatchInfoOpen(true); }}
                  className="flex-1 px-4 py-3 flex items-center justify-center gap-2 active:opacity-60 transition-opacity"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#9aab96" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="5.5" y1="1" x2="5.5" y2="10" /><line x1="1" y1="5.5" x2="10" y2="5.5" />
                  </svg>
                  <span className="text-[12px] font-medium text-[#9aab96]">Add a match</span>
                </button>
              </div>
            </div>

            {/* Horizontal Day Timeline */}
            {(() => {
              const now = new Date();
              const pad = (n: number) => String(n).padStart(2, "0");
              const matchTimeStr = editedData.time || "18:30";
              const [mH, mM] = matchTimeStr.split(":").map(Number);
              const addMins = (h: number, m: number, delta: number) => {
                const total = h * 60 + m + delta;
                return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
              };
              const matchVenue = [editedData.club, editedData.court ? `Court ${editedData.court}` : ""].filter(Boolean).join(" — ") || "Court";

              const scheduleData: Record<string, { time: string; title: string; subtitle: string; color: string }[]> = {
                match: [
                  { time: "07:00", title: "Wake up & hydrate",    subtitle: "500ml water",                              color: "#f59e0b" },
                  { time: "07:30", title: "Breakfast",             subtitle: "Oats, eggs, fruit",                        color: "#16a34a" },
                  { time: "09:00", title: "Morning mobility",      subtitle: "Foam roll & light stretching",             color: "#0891b2" },
                  { time: addMins(mH, mM, -360), title: "Pre-game meal",        subtitle: "Chicken, rice, light salad",             color: "#16a34a" },
                  { time: addMins(mH, mM, -60),  title: "Warmup & activation", subtitle: "Dynamic drills, 30 min",                 color: "#2653d4" },
                  { time: matchTimeStr,           title: "Match",               subtitle: matchVenue,                              color: "#1e3a1e" },
                  { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min",            color: "#7c3aed" },
                  { time: addMins(mH, mM, 120),  title: "Recovery meal",       subtitle: "Protein + carbs within 30 min",          color: "#16a34a" },
                  { time: "22:30", title: "Wind down",             subtitle: "No screens, light reading",                color: "#94a3b8" },
                ],
                recovery: [
                  { time: "07:30", title: "Wake up & hydrate",    subtitle: "500ml water",                              color: "#f59e0b" },
                  { time: "08:00", title: "Light breakfast",       subtitle: "Eggs, fruit, Greek yogurt",                color: "#16a34a" },
                  { time: "09:30", title: "Recovery walk",         subtitle: "20 min easy",                              color: "#0891b2" },
                  { time: "10:30", title: "Foam roll & stretch",   subtitle: "Quads, hip flexors, calves",               color: "#7c3aed" },
                  { time: "13:00", title: "Protein-rich lunch",    subtitle: "Chicken, salmon or legumes",               color: "#16a34a" },
                  { time: "15:30", title: "Cold shower",           subtitle: "2 min cold",                               color: "#2653d4" },
                  { time: "18:30", title: "Dinner",                subtitle: "Anti-inflammatory focus",                  color: "#16a34a" },
                  { time: "21:30", title: "Early wind down",       subtitle: "Sleep is your best recovery tool",         color: "#94a3b8" },
                ],
                training: [
                  { time: "07:00", title: "Wake up & hydrate",       subtitle: "500ml water",                           color: "#f59e0b" },
                  { time: "07:30", title: "Breakfast",                subtitle: "Oats, eggs, fruit",                     color: "#16a34a" },
                  { time: "09:00", title: "Morning mobility",         subtitle: "Foam roll & light stretching",           color: "#0891b2" },
                  { time: "15:00", title: "Pre-training meal",        subtitle: "Carbs + protein, 1.5–2h before",        color: "#16a34a" },
                  { time: "17:00", title: "Pre-training activation",  subtitle: "10 min dynamic warm-up",                color: "#2653d4" },
                  { time: "17:30", title: "Training session",         subtitle: "Focus on deliberate patterns",           color: "#1e3a1e" },
                  { time: "19:00", title: "Post-training stretch",    subtitle: "30–45 sec holds",                       color: "#7c3aed" },
                  { time: "19:30", title: "Post-training protein",    subtitle: "20–40g protein within 30 min",          color: "#16a34a" },
                  { time: "22:30", title: "Wind down",                subtitle: "No screens, consistent bedtime",        color: "#94a3b8" },
                ],
                rest: [
                  { time: "07:00", title: "Wake up & hydrate",    subtitle: "500ml water",                              color: "#f59e0b" },
                  { time: "07:30", title: "Breakfast",             subtitle: "Eggs, yogurt, fruit",                      color: "#16a34a" },
                  { time: "09:30", title: "Light mobility",        subtitle: "Hip flexors, thoracic spine, ankles",      color: "#0891b2" },
                  { time: "12:30", title: "Balanced lunch",        subtitle: "Carbs + protein + greens",                 color: "#16a34a" },
                  { time: "15:00", title: "Active recovery",       subtitle: "Walk, swim or light cycling",              color: "#2653d4" },
                  { time: "18:30", title: "Dinner",                subtitle: "Variety and micronutrients",               color: "#16a34a" },
                  { time: "21:00", title: "Visualisation",         subtitle: "5 min mental rehearsal",                   color: "#7c3aed" },
                  { time: "22:30", title: "Wind down",             subtitle: "No screens, consistent bedtime",           color: "#94a3b8" },
                ],
              };

              const schedule = scheduleData[dayType];
              const n = schedule.length;
              const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
              const curMins = now.getHours() * 60 + now.getMinutes();

              // Auto-detect current item
              let autoIdx = 0;
              if (curMins >= toMins(schedule[schedule.length - 1].time)) {
                autoIdx = schedule.length - 1;
              } else {
                for (let i = 0; i < schedule.length - 1; i++) {
                  if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { autoIdx = i; break; }
                }
              }

              const displayIdx = timelineIdx ?? autoIdx;
              const item = schedule[displayIdx];
              const detail = SCHEDULE_DETAILS[item.title];

              // Notch x-position: accounts for px-3 (12px) padding on each side
              const notchPct = Math.min(Math.max(((displayIdx + 0.5) / n) * 100, 4), 96);

              const fmtTime = (t: string) => {
                const [h, m] = t.split(":").map(Number);
                const ampm = h >= 12 ? "pm" : "am";
                const h12 = h % 12 || 12;
                return m === 0 ? `${h12}${ampm}` : `${h12}:${pad(m)}${ampm}`;
              };

              return (
                <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 px-4 pt-5 pb-4">

                  {/* Header */}
                  <div className="mb-4">
                    <p className="text-[11px] font-semibold text-[#747878] uppercase tracking-widest mb-1">Today&apos;s Plan</p>
                    {dayType === "match" ? (
                      <>
                        <div className="relative flex justify-center overflow-hidden" style={{ height: 36 }}>
                          {[
                            { left:"6%",  delay:"0s",    dur:"2.2s", color:"#f59e0b", w:5, h:8  },
                            { left:"16%", delay:"0.4s",  dur:"1.8s", color:"#2653d4", w:6, h:5  },
                            { left:"26%", delay:"0.1s",  dur:"2.5s", color:"#ef4444", w:4, h:7  },
                            { left:"36%", delay:"0.7s",  dur:"1.9s", color:"#16a34a", w:7, h:5  },
                            { left:"46%", delay:"0.3s",  dur:"2.1s", color:"#f59e0b", w:5, h:8  },
                            { left:"56%", delay:"1.0s",  dur:"1.7s", color:"#7c3aed", w:6, h:5  },
                            { left:"66%", delay:"0.2s",  dur:"2.3s", color:"#ef4444", w:4, h:9  },
                            { left:"76%", delay:"0.6s",  dur:"1.8s", color:"#2653d4", w:7, h:5  },
                            { left:"86%", delay:"0.9s",  dur:"2.0s", color:"#16a34a", w:5, h:7  },
                            { left:"12%", delay:"1.2s",  dur:"1.9s", color:"#f97316", w:6, h:5  },
                            { left:"52%", delay:"0.8s",  dur:"2.2s", color:"#0891b2", w:4, h:8  },
                            { left:"78%", delay:"1.4s",  dur:"1.6s", color:"#f59e0b", w:7, h:5  },
                          ].map((p, i) => (
                            <div key={i} className="absolute pointer-events-none" style={{
                              left: p.left, top: 0, width: p.w, height: p.h,
                              background: p.color, borderRadius: 1.5, opacity: 0,
                              animation: `confettiFall ${p.dur} ${p.delay} ease-in infinite`,
                            }} />
                          ))}
                          <p className="h1-headline-md text-[#1a1c1c] relative z-10 self-center">Game Day</p>
                        </div>
                        {editedData.time && (
                          <p className="text-[13px] font-medium text-[#747878] text-center mt-1">Gametime: <span className="font-semibold text-[#1a1c1c]">{editedData.time}</span></p>
                        )}
                      </>
                    ) : (
                      <p className="h1-headline-md text-[#1a1c1c]">
                        {dayType === "recovery" ? "Recovery Day" : dayType === "training" ? "Training Day" : "Rest Day"}
                      </p>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="relative">
                    {/* Track line */}
                    <div className="absolute inset-x-0 pointer-events-none" style={{ top: 18, height: 1.5, background: "#ebebeb" }} />
                    {/* Elapsed line */}
                    <div
                      className="absolute pointer-events-none transition-all duration-500"
                      style={{ top: 18, left: 0, height: 1.5, width: `${notchPct}%`, background: item.color, opacity: 0.45 }}
                    />
                    {/* Dot + label columns */}
                    <div className="flex">
                      {schedule.map((s, idx) => {
                        const isPast    = idx < displayIdx;
                        const isCurrent = idx === displayIdx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setTimelineIdx(timelineIdx === idx && idx === autoIdx ? null : idx)}
                            className="flex-1 flex flex-col items-center gap-2 active:opacity-60 transition-opacity"
                          >
                            {/* Dot */}
                            <div style={{
                              marginTop: isCurrent ? 11 : 14,
                              width:  isCurrent ? 15 : 8,
                              height: isCurrent ? 15 : 8,
                              borderRadius: "50%",
                              background: isCurrent ? s.color : isPast ? "#cdd0d1" : "white",
                              border: `2px solid ${isCurrent ? s.color : isPast ? "#cdd0d1" : "#dde0e1"}`,
                              boxShadow: isCurrent ? `0 0 0 4px ${s.color}1e` : "none",
                              flexShrink: 0,
                              transition: "all 0.25s",
                            }} />
                            {/* Time label */}
                            <span
                              className="leading-none transition-all"
                              style={{
                                fontSize: isCurrent ? 10 : 8.5,
                                fontWeight: isCurrent ? 700 : 500,
                                color: isCurrent ? s.color : isPast ? "#bbbec0" : "#d0d3d4",
                              }}
                            >{fmtTime(s.time)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notch + nested info card */}
                  <div className="relative mt-4">
                    {/* Notch shadow triangle */}
                    <div className="absolute pointer-events-none" style={{
                      top: -9, left: `calc(${notchPct}% - 9px)`, zIndex: 1,
                      width: 0, height: 0,
                      borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
                      borderBottom: "9px solid rgba(180,184,184,0.25)",
                    }} />
                    {/* Notch white fill */}
                    <div className="absolute pointer-events-none" style={{
                      top: -7, left: `calc(${notchPct}% - 7px)`, zIndex: 2,
                      width: 0, height: 0,
                      borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
                      borderBottom: "7px solid #f4f5f5",
                    }} />
                    {/* Inner card */}
                    <div className="rounded-[18px] px-5 py-4" style={{ background: "#f4f5f5" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="text-[11px] font-bold text-[#747878] uppercase tracking-wide">{item.time}</span>
                        {timelineIdx !== null && (
                          <button onClick={() => setTimelineIdx(null)} className="ml-auto text-[11px] font-semibold text-[#4169e1] active:opacity-60">
                            Now
                          </button>
                        )}
                      </div>
                      <p className="h1-headline-md text-[#1a1c1c] mb-0.5">{item.title}</p>
                      <p className="text-[13px] text-[#747878] mb-3 leading-snug">{item.subtitle}</p>
                      {detail && <p className="text-[13px] text-[#444748] leading-relaxed line-clamp-4">{detail}</p>}
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Daily Check-In + Metrics (connected) */}
            <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 overflow-hidden">
              {checkInDone ? (
                <button
                  onClick={() => setCheckInOpen(true)}
                  className="w-full px-6 py-3 flex items-center justify-between active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="8,12 11,15 16,9" />
                    </svg>
                    <p className="text-[14px] font-semibold text-[#1a1c1c]">Update your stats...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h1-label-sm text-[#496640] bg-[#caecbc] px-2.5 py-1 rounded-full">Done</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setCheckInOpen(true)}
                  className="w-full px-6 py-4 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div className="text-left">
                    <p className="h1-headline-md text-[#1a1c1c]">Update your stats...</p>
                    <p className="h1-body-md text-[#444748] mt-0.5">Click to use quick wizard</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#444748" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
                    <line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" />
                  </svg>
                </button>
              )}
              <div className="border-t border-[#e2e2e2]" />
              {/* Metrics */}
              {(() => {
                const active = scoreView === "today" ? scores : allTimeScores;
                const cols = [
                  {
                    label: "Recovery", pct: active.recovery, color: "#7c3aed",
                    subtitle: "Post-session repair & rest",
                    detail: "Recovery reflects how well your body is bouncing back between sessions. It's shaped by your rest days, recent match load, and how you rated your physical feeling after games.\n\nAim for at least one full rest day between intense sessions and prioritise 7–9 hours of sleep. Logging your match reviews regularly helps keep this score accurate.",
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
                  },
                  {
                    label: "Hydration", pct: active.hydration, color: "#2653d4",
                    subtitle: "Daily water intake",
                    detail: "Hydration is based on your most recent intake log. The target is 3.5L on training and match days — more if conditions are hot or sessions are long.\n\nEven mild dehydration (1–2%) measurably reduces reaction time and coordination. Log your intake daily so this score stays current.",
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" /></svg>,
                  },
                  {
                    label: "Energy", pct: active.energy, color: "#ea580c",
                    subtitle: "Training & match readiness",
                    detail: "Energy is derived from how you've rated your energy levels in recent match reviews and your nutrition quality. High energy scores reflect consistent fuelling, good sleep, and manageable training loads.\n\nIf your score is low, check your pre-match meal timing, carbohydrate intake, and whether you're accumulating fatigue across the week.",
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2" /></svg>,
                  },
                  {
                    label: "Mobility", pct: active.mobility, color: "#16a34a",
                    subtitle: "Flexibility & movement quality",
                    detail: "Mobility covers how freely and efficiently you move on court — hip rotation, shoulder range, and ankle stability all feed into padel performance.\n\nSpend 10 minutes after each session on dynamic stretching: hip flexors, thoracic rotation, and calf raises. Regular mobility work reduces injury risk and improves your ability to reach wide balls and change direction quickly.",
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2" /><path d="M12 7v6" /><path d="M9 10l-3 5h12l-3-5" /><path d="M9 22v-4" /><path d="M15 22v-4" /></svg>,
                  },
                ];
                const r = 24, sz = 56, cx = 28;
                return (
                  <div className="flex">
                    {cols.map(({ label, pct, color, icon, subtitle, detail }, i) => {
                      const fillH = 2 * r * pct / 100;
                      const fillY = cx + r - fillH;
                      const rating = pct >= 85 ? "Optimal" : pct >= 65 ? "Good" : pct >= 45 ? "Fair" : "Low";
                      const ratingColor = pct >= 85 ? "#16a34a" : pct >= 65 ? "#16a34a" : pct >= 45 ? "#ea580c" : "#dc2626";
                      return (
                        <button
                          key={label}
                          onClick={() => setCategoryModal({ label, pct, color, subtitle, detail })}
                          className="flex-1 min-w-0 px-2 py-3 flex flex-col items-center gap-1 active:opacity-70 transition-opacity"
                          style={{ borderLeft: i > 0 ? "1px solid #e2e2e2" : "none" }}
                        >
                          <span style={{ color }}>{icon}</span>
                          <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
                            <defs>
                              <clipPath id={`h1-${label}`}>
                                <circle cx={cx} cy={cx} r={r} />
                              </clipPath>
                            </defs>
                            <circle cx={cx} cy={cx} r={r} fill="#e8ebee" />
                            <rect x="0" y={fillY} width={sz} height={fillH} fill={color} clipPath={`url(#h1-${label})`} />
                          </svg>
                          <p className="text-[10px] font-semibold text-[#1a1c1c] leading-tight text-center truncate w-full">{label}</p>
                          <p className="text-[13px] font-bold leading-none text-[#1a1c1c]">{pct}%</p>
                          <p className="text-[9px] font-semibold tracking-wide uppercase leading-none" style={{ color: ratingColor }}>{rating}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Divider */}
              <div className="border-t border-[#e2e2e2]" />

              {/* Improve */}
              <button className="w-full px-5 py-4 relative flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <span className="text-[14px] font-semibold text-[#1a1c1c]">Improve</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            {/* Notifications card */}
            {(() => {
              const notifs: Notif[] = computeNotifications();
              const featured = notifs.find(n => n.featured);
              const rest = notifs.filter(n => !n.featured);

              if (notifs.length === 0) {
                return (
                  <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 px-6 py-5">
                    <p className="h1-headline-md text-[#1a1c1c] mb-1">Notifications</p>
                    <p className="text-[14px] text-[#747878]">You&apos;re all caught up.</p>
                  </div>
                );
              }

              return (
                <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 overflow-hidden">
                  <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                    <p className="h1-headline-md text-[#1a1c1c]">Notifications</p>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#4169e110] text-[#4169e1]">{notifs.length} new</span>
                  </div>
                  {featured && (
                    <div className="mx-4 mb-3 px-4 py-3.5 rounded-2xl" style={{ background: "#4169e110" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4169e1] flex-shrink-0" />
                        <span className="text-[11px] font-bold tracking-wide text-[#4169e1]">{featured.time}</span>
                      </div>
                      <p className="text-[14px] font-semibold text-[#1a1c1c] leading-snug">{featured.message}</p>
                      {featured.link && <p className="text-[12px] font-semibold mt-1.5 text-[#4169e1]">{featured.link} →</p>}
                    </div>
                  )}
                  {rest.length > 0 && (
                    <div className="relative">
                      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: notifExpanded ? 600 : 82 }}>
                        {rest.map((n, i) => (
                          <div key={i} className="flex items-start gap-4 px-6 py-3.5 border-t border-[#f4f4f4]">
                            <span className="text-[11px] font-semibold text-[#747878] flex-shrink-0 w-12 pt-0.5">{n.time}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] text-[#1a1c1c] leading-snug">{n.message}</p>
                              {n.link && <p className="text-[12px] font-semibold mt-1 text-[#4169e1]">{n.link} →</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!notifExpanded && rest.length > 1 && (
                        <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, white)" }} />
                      )}
                      {rest.length > 1 && (
                        <div className="border-t border-[#f4f4f4] px-6 py-3">
                          <button onClick={() => setNotifExpanded(o => !o)} className="text-[13px] font-semibold text-[#4169e1]">
                            {notifExpanded ? "See less" : "See all →"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Do This Right Now */}
            <div className="bg-white rounded-[24px] p-6 h1-ambient border border-[#c4c7c7]/10">
              {(() => {
                const allItems = {
                  match: [
                    { label: "Hydration 3.5L",           checked: hydration,        set: setHydration,        detail: "Drink 500ml of water with electrolytes before you do anything else. After hours of sleep your body is dehydrated — even mild dehydration (1–2%) measurably reduces reaction time, concentration, and physical output." },
                    { label: "Pre-match meal (2–3h out)", checked: preMatchMeal,     set: setPreMatchMeal,     detail: "Eat a moderate meal 2–3 hours before the match: carbohydrates for fuel (rice, pasta, oats), lean protein to protect muscle, and nothing heavy or unfamiliar. Avoid high-fat and high-fibre foods — they slow digestion and can cause discomfort mid-game." },
                    { label: "10min Dynamic Mobility",    checked: mobility,         set: setMobility,         detail: "Spend 10 minutes on dynamic mobility — leg swings, hip circles, thoracic rotations, and lateral lunges. This increases blood flow to the joints and primes the neuromuscular system for explosive movement." },
                    { label: "Visualise Key Tactics",     checked: visualise,        set: setVisualise,        detail: "Close your eyes for 3–5 minutes and mentally rehearse your key patterns: your serve placement, your net approach after a quality drive, and your reset lob when under pressure. Visualisation activates the same neural pathways as physical practice." },
                    { label: "Box Breathing (4x4)",       checked: boxBreathing,     set: setBoxBreathing,     detail: "Box breathing regulates your autonomic nervous system before competition. Inhale for 4 counts, hold for 4, exhale for 4, hold for 4 — repeat 4–6 cycles. Do it 15–30 minutes before warm-up." },
                    { label: "Sleep 7–9h tonight",        checked: sleep,            set: setSleep,            detail: "Sleep is the single highest-leverage recovery tool available. During deep sleep your body releases growth hormone, repairs muscle tissue, and consolidates motor patterns learned during training." },
                  ],
                  recovery: [
                    { label: "Hydration 2.5L+",          checked: hydration,        set: setHydration,        detail: "You lost significant fluid during yesterday's match. Rehydrating takes longer than most people expect — sip steadily throughout the day rather than drinking large amounts at once. Aim for pale yellow urine by mid-morning." },
                    { label: "Foam roll 15 min",          checked: foamRoll,         set: setFoamRoll,         detail: "Today is your best window for foam rolling — muscles are recovered enough to tolerate pressure but still have residual tension. Focus on quads, IT band, hip flexors, glutes, and calves. 60–90 seconds per area." },
                    { label: "Protein-rich meal",         checked: proteinMeal,      set: setProteinMeal,      detail: "Muscle protein synthesis is elevated for 24–48 hours after exercise. Hit 30–40g of protein at both lunch and dinner today: chicken, fish, eggs, Greek yogurt, or legumes all work well." },
                    { label: "Recovery walk 20 min",      checked: lightWalk,        set: setLightWalk,        detail: "Low-intensity walking increases blood flow to fatigued muscles without adding stress. It flushes metabolic waste, reduces soreness, and keeps your aerobic system ticking without loading your joints." },
                    { label: "Cold shower 2 min",         checked: coldShower,       set: setColdShower,       detail: "Two minutes of cold water constricts blood vessels, reduces inflammation, and blunts delayed onset muscle soreness. It also activates the nervous system — useful if you feel flat on a recovery day." },
                    { label: "Sleep 8–9h tonight",        checked: sleep,            set: setSleep,            detail: "Recovery happens during sleep, not during rest. Growth hormone release peaks in deep sleep — getting an extra hour tonight compounds the repair work your body is already doing from yesterday's session." },
                  ],
                  rest: [
                    { label: "Hydration 2–3L",            checked: hydration,        set: setHydration,        detail: "Hydration isn't just for match days. Staying consistently hydrated on rest days maintains blood volume, joint lubrication, and cognitive function. Aim for 2–3L spread through the day." },
                    { label: "10min Light Mobility",       checked: mobility,         set: setMobility,         detail: "On rest days, gentle mobility keeps joints lubricated and prevents stiffness from accumulating. Focus on hip flexors, thoracic rotation, and ankle circles. 10–15 minutes is enough — this is maintenance, not training." },
                    { label: "Visualise Key Tactics",      checked: visualise,        set: setVisualise,        detail: "Rest days are ideal for mental training. Spend 5 minutes visualising your key patterns: positioning after a lob, your net approach, your response under pressure. Athletes who visualise consistently outperform those who don't." },
                    { label: "Balanced nutrition",         checked: balancedNutrition, set: setBalancedNutrition, detail: "Rest days are an opportunity to refuel properly. Focus on variety — plenty of vegetables, complex carbs, and protein. Don't under-eat on rest days; your body is still rebuilding from recent sessions." },
                    { label: "Sleep 7–9h tonight",         checked: sleep,            set: setSleep,            detail: "Consistent sleep is the foundation of performance. Aim for the same bedtime every night — even on rest days. Variability in sleep timing disrupts your circadian rhythm and reduces sleep quality." },
                  ],
                  training: [
                    { label: "Pre-training meal",          checked: preMatchMeal,     set: setPreMatchMeal,     detail: "Fuel up 1.5–2 hours before your session: moderate carbs (oats, rice, banana) and some protein. Don't train fasted for high-intensity sessions — your output drops and you retain less of the session." },
                    { label: "Pre-training activation",    checked: mobility,         set: setMobility,         detail: "10 minutes of dynamic movement before training improves power output and reduces injury risk. Lateral shuffles, hip circles, leg swings, and arm rotations prime the patterns you'll use on court." },
                    { label: "Hydration 2.5–3L",           checked: hydration,        set: setHydration,        detail: "On a training day your sweat loss may not match a full match, but you still need to stay ahead of thirst. Aim for 2.5–3L total. Sip regularly through the session to maintain output quality." },
                    { label: "Post-training protein",       checked: proteinMeal,      set: setProteinMeal,      detail: "Consume 20–40g protein within 30 minutes of finishing training to maximise muscle protein synthesis. A protein shake, Greek yogurt, or eggs paired with fast carbs (banana, rice cake) all work." },
                    { label: "Post-training stretch",       checked: foamRoll,         set: setFoamRoll,         detail: "After training, your muscles are warm and pliable — the best window for flexibility work. Hold each stretch for 30–45 seconds. Prioritise hip flexors, hamstrings, and shoulder external rotators." },
                    { label: "Sleep 7–9h tonight",          checked: sleep,            set: setSleep,            detail: "Training creates micro-damage that your body repairs during sleep. Consistent 7–9 hour nights let you absorb the session's adaptations and show up ready for the next one." },
                  ],
                };

                const items = allItems[dayType];
                const sorted = [...items.filter(i => !i.checked), ...items.filter(i => i.checked)];
                const doneCount = items.filter(i => i.checked).length;
                const total = items.length;
                const visible = mustDoExpanded ? sorted : sorted.slice(0, 2);
                return (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="h1-headline-md text-black">{dayType === "match" ? "Match Day Essentials" : dayType === "recovery" ? "Recovery Essentials" : dayType === "training" ? "Training Essentials" : "Must Do’s Today"}</h3>
                      {doneCount > 0 && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: doneCount === total ? "#caecbc" : "#f4f4f4", color: doneCount === total ? "#496640" : "#747878" }}>
                          {doneCount === total ? "⚡ All done" : `${doneCount}/${total}`}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { if (dayType !== "match") setDayTypeOverride(v => v === "recovery" ? "training" : v === "training" ? "rest" : "recovery"); }}
                      className="flex items-center gap-1.5 mb-4 active:opacity-60 transition-opacity"
                      style={{ cursor: dayType === "match" ? "default" : "pointer" }}
                    >
                      <span className="text-[#747878]">{DAY_TYPE_META[dayType].icon}</span>
                      <span className="text-[11px] font-semibold text-[#747878]">{DAY_TYPE_META[dayType].label}</span>
                      {dayType !== "match" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>}
                    </button>
                    <div className="space-y-4">
                      {visible.map(({ label, checked, set, detail }) => (
                        <div key={label} className="flex items-center gap-4">
                          <label className="flex items-center gap-4 flex-1 cursor-pointer group">
                            <div className="relative flex items-center justify-center w-6 h-6 rounded-lg border-2 border-[#747878] group-active:scale-90 transition-transform flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => set(e.target.checked)}
                                className="peer absolute opacity-0 w-full h-full cursor-pointer"
                              />
                              <span
                                className="material-symbols-outlined text-[#496640] opacity-0 peer-checked:opacity-100 transition-opacity"
                                style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 600" }}
                              >
                                check
                              </span>
                            </div>
                            <span className={`h1-body-md text-[#444748] ${checked ? "line-through opacity-50" : ""}`}>
                              {label}
                            </span>
                          </label>
                          <button
                            onClick={() => setRoutineModal({ label, detail })}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center active:scale-90 transition-transform"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#c4c7c7" strokeWidth="1.8" strokeLinecap="round">
                              <line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setMustDoExpanded(o => !o)}
                      className="flex items-center gap-1 pt-3 active:opacity-60 transition-opacity"
                    >
                      <span className="text-[13px] font-semibold text-[#747878]">{mustDoExpanded ? "Less" : "More"}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: mustDoExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Today's Schedule */}
            {(() => {
              const now = new Date();
              const pad = (n: number) => String(n).padStart(2, "0");

              // Match time helpers
              const matchTime = editedData.time || "18:30";
              const [mH, mM] = matchTime.split(":").map(Number);
              const addMins = (h: number, m: number, delta: number) => {
                const total = h * 60 + m + delta;
                return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
              };
              const matchVenue = [editedData.club, editedData.court ? `Court ${editedData.court}` : ""].filter(Boolean).join(" — ") || "Court";

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

              const curMins = now.getHours() * 60 + now.getMinutes();
              const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
              return (
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
                        <div key={idx} className="flex gap-3">
                          {/* Time */}
                          <div className="w-11 flex-shrink-0 pt-0.5">
                            <p className="text-[13px] font-semibold text-[#444748] text-right leading-none">{time}</p>
                          </div>
                          {/* Dot + line */}
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
                                      {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
                                    </span>
                                    <svg width="6" height="8" viewBox="0 0 6 8"><polygon points="0,0 6,4 0,8" fill="#1a1c1c" /></svg>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Content */}
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
              );
            })()}

            {/* More / Less toggle */}
            <button
              onClick={() => setMoreOpen(o => !o)}
              className="w-full bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 px-5 py-2.5 flex flex-col items-center gap-0.5 active:scale-[0.98] transition-transform"
            >
              <span className="text-[14px] font-semibold text-[#1a1c1c]">{moreOpen ? "Less" : "More"}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Expanded content */}
            {moreOpen && (
              <>
                {/* Drill of the Day */}
                <div className="bg-white rounded-[24px] overflow-hidden h1-ambient border border-[#c4c7c7]/10">
                  <div className="relative h-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="A focused padel player executing a precise overhead smash"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwmJ-BrAQ_7S7rouu9kF2tN6wJ7EpzZwpeOuLcxyPGhLVOxP5kEWvoyhxW9GW6-gZ4HuT6sipLgujMAPGlF9yGslIOFzLD6cXR4fx4BP-h3t3B9tpwTVeS7vi5OGKQm289x4UK1h_E8XQXIvPakDsn865BvMnH5zEQ1-3adsxQMLGj-xSuMQi2qAsdz_eIWSG0ofeZwcQQc1o0NnoWv_fg7Et6vK7f3ghGB2mXXJOC22lXoNG68ltMnFNvrl6YQzunHuqHABHJuiU"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                      <span className="h1-label-sm text-white bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                        Skill: Tactics
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="h1-headline-md text-black mb-1">Defensive Lob Mastery</h3>
                    <p className="h1-body-md text-[#444748] mb-4">Master the depth and height to reset the point under pressure.</p>
                    <button className="w-full h-12 bg-black text-white h1-label-sm rounded-xl active:scale-[0.98] transition-transform">
                      Start Guided Session
                    </button>
                  </div>
                </div>

              </>
            )}

          </div>
        </main>

        {/* Daily Log bottom sheet */}
        {fabOpen && (() => {
          const todayYMD = new Date().toISOString().slice(0, 10);
          const now = Date.now();
          const timeAgo = (ts: string) => {
            const mins = Math.floor((now - new Date(ts).getTime()) / 60000);
            return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
          };
          let ciDone = false;
          try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); ciDone = ci?.date === todayYMD; } catch {}
          let hydroDone = false, hydroAgo = "";
          try { const r = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0]; if (r?.ts.slice(0, 10) === todayYMD) { hydroDone = true; hydroAgo = timeAgo(r.ts); } } catch {}
          let nutriDone = false, nutriAgo = "";
          try { const r = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0]; if (r?.ts.slice(0, 10) === todayYMD) { nutriDone = true; nutriAgo = timeAgo(r.ts); } } catch {}
          let reviewDone = false, reviewAgo = "";
          try { const r = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0]; if (r?.ts.slice(0, 10) === todayYMD) { reviewDone = true; reviewAgo = timeAgo(r.ts); } } catch {}

          const rows = [
            {
              label: "Daily Check-in", sub: "Sleep · energy · soreness · hydration",
              color: "#4169e1", done: ciDone, badge: ciDone ? "Done today" : "Not yet",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4169e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
              action: () => { setFabOpen(false); setCheckInOpen(true); },
            },
            {
              label: "Hydration", sub: "Log today's water intake",
              color: "#0891b2", done: hydroDone, badge: hydroDone ? hydroAgo : "Not yet",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>,
              action: () => { setFabOpen(false); setHydroOpen(true); },
            },
            {
              label: "Nutrition", sub: "Protein & recovery fuel",
              color: "#ea580c", done: nutriDone, badge: nutriDone ? nutriAgo : "Not yet",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
              action: () => { setFabOpen(false); setNutritionOpen(true); },
            },
          ];

          const reviewRow = {
            label: "Review a match", sub: "Log your last match performance",
            color: "#7c3aed", done: reviewDone, badge: reviewDone ? reviewAgo : "Not yet",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill="#7c3aed" stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill="#7c3aed" stroke="none"/></svg>,
            action: () => { setFabOpen(false); setMatchReviewOpen(true); },
          };
          const addMatchRow = {
            label: "Add a match", sub: "Upload booking or enter manually",
            color: "#2653d4", done: false, badge: "",
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>,
            action: () => { setFabOpen(false); setExtractedData(null); setUploadError(null); setMatchInfoOpen(true); },
          };

          rows.push(...(reviewDone ? [addMatchRow, reviewRow] : [reviewRow, addMatchRow]));

          return (
            <div className="fixed inset-0 z-[60]" onClick={() => setFabOpen(false)}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
              <div
                className="h1-font absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] mx-3 rounded-b-none"
                style={{ animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1" />
                <div className="px-6 pt-3 pb-4">
                  <p className="h1-headline-md text-[#1a1c1c]">Daily Log</p>
                  <p className="text-[13px] text-[#747878] mt-0.5">Tap to update — scores recalculate instantly</p>
                </div>
                {rows.map((row) => (
                  <button
                    key={row.label}
                    onClick={row.action}
                    className="w-full flex items-center gap-4 px-6 py-4 active:bg-[#f9f9f9] transition-colors"
                    style={{ borderTop: "1px solid #f4f4f4" }}
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: row.color + "18" }}>
                      {row.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">{row.label}</p>
                      <p className="text-[12px] text-[#747878] mt-0.5">{row.sub}</p>
                    </div>
                    {row.label === "Add a match" ? (
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="#c4c7c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,1 6,6 1,11"/></svg>
                    ) : row.done ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#caecbc] text-[#496640] whitespace-nowrap flex-shrink-0">{row.badge}</span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f4f4f4] text-[#747878] flex-shrink-0">Not yet</span>
                    )}
                  </button>
                ))}
                <div style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }} />
              </div>
            </div>
          );
        })()}

        {/* Improve bottom sheet */}
        {improveOpen && (() => {
          const todayYMD = new Date().toISOString().slice(0, 10);
          let ciDone = false;
          try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); ciDone = ci?.date === todayYMD; } catch {}
          let hydroDone = false;
          try { const h = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0]; hydroDone = h?.ts?.slice(0, 10) === todayYMD; } catch {}
          let nutriDone = false;
          try { const n = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0]; nutriDone = n?.ts?.slice(0, 10) === todayYMD; } catch {}
          let revDone = false;
          try { const r = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0]; revDone = r?.ts?.slice(0, 10) === todayYMD; } catch {}

          // Find lowest category to rank by relevance
          const cats = ["recovery", "hydration", "energy", "mobility"] as const;
          const lowest = cats.slice().sort((a, b) => scores[a] - scores[b])[0];

          const tasks = [
            {
              label: "Log daily check-in", sub: "Sleep, energy, soreness & hydration",
              pts: 12, color: "#4169e1", done: ciDone,
              affects: ["recovery", "energy", "mobility"] as typeof cats[number][],
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4169e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
              action: () => { setImproveOpen(false); setCheckInOpen(true); },
            },
            {
              label: "Log hydration", sub: "Water intake & urine colour",
              pts: 8, color: "#0891b2", done: hydroDone,
              affects: ["hydration", "recovery"] as typeof cats[number][],
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>,
              action: () => { setImproveOpen(false); setHydroOpen(true); },
            },
            {
              label: "Log match review", sub: "Injury status, energy & performance",
              pts: 7, color: "#7c3aed", done: revDone,
              affects: ["recovery", "mobility"] as typeof cats[number][],
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill="#7c3aed" stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill="#7c3aed" stroke="none"/></svg>,
              action: () => { setImproveOpen(false); setMatchReviewOpen(true); },
            },
            {
              label: "Log nutrition", sub: "Protein & meal quality",
              pts: 5, color: "#ea580c", done: nutriDone,
              affects: ["energy"] as typeof cats[number][],
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
              action: () => { setImproveOpen(false); setNutritionOpen(true); },
            },
          ].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            const aRel = a.affects.includes(lowest) ? 1 : 0;
            const bRel = b.affects.includes(lowest) ? 1 : 0;
            if (aRel !== bRel) return bRel - aRel;
            return b.pts - a.pts;
          });

          return (
            <div className="fixed inset-0 z-[60]" onClick={() => setImproveOpen(false)}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
              <div
                className="h1-font absolute bottom-0 left-0 right-0 mx-3 bg-white rounded-t-[28px] overflow-y-auto"
                style={{ animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)", maxHeight: "85vh" }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1" />
                <div className="px-6 pt-3 pb-4">
                  <p className="h1-headline-md text-[#1a1c1c]">How to Improve</p>
                  <p className="text-[13px] text-[#747878] mt-0.5">
                    Your weakest area is <span className="font-semibold" style={{ color: lowest === "recovery" ? "#7c3aed" : lowest === "hydration" ? "#0891b2" : lowest === "energy" ? "#ea580c" : "#16a34a" }}>{lowest}</span> — ranked by impact
                  </p>
                </div>
                {tasks.map((task) => (
                  <button
                    key={task.label}
                    onClick={task.action}
                    className="w-full flex items-center gap-4 px-6 py-4 active:bg-[#f9f9f9] transition-colors"
                    style={{ borderTop: "1px solid #f4f4f4", opacity: task.done ? 0.5 : 1 }}
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: task.color + "18" }}>
                      {task.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">{task.label}</p>
                      <p className="text-[12px] text-[#747878] mt-0.5">{task.sub}</p>
                    </div>
                    {task.done ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#caecbc] text-[#496640] flex-shrink-0">Done</span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: task.color + "15", color: task.color }}>+{task.pts} pts</span>
                    )}
                  </button>
                ))}
                <div style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }} />
              </div>
            </div>
          );
        })()}

        {/* FAB */}
        <div className="fixed right-6 bottom-24 z-[70]">
          <button
            onClick={() => setFabOpen(o => !o)}
            className="w-14 h-14 bg-[#ffe600] rounded-full flex items-center justify-center shadow-lg active:scale-90"
            style={{ transition: "transform 0.22s ease", transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)" }}
          >
            <span className="material-symbols-outlined text-[#1a1c1c]">add</span>
          </button>
        </div>
      </div>

      {/* Daily Check-In modal */}
      {checkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setCheckInOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="h1-headline-md text-[#1a1c1c]">Update your stats</p>
                <p className="h1-label-sm text-[#747878] mt-0.5">Rate each on a scale of 1–5</p>
              </div>
              <button onClick={() => setCheckInOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Metrics */}
            <div className="px-6 pb-6 space-y-4 overflow-y-auto">
              {([
                { key: "sleep",     label: "Sleep",     sub: "Hours & quality"   },
                { key: "energy",    label: "Energy",    sub: "How alert you feel" },
                { key: "soreness",  label: "Soreness",  sub: "Muscle fatigue"    },
                { key: "hydration", label: "Hydration", sub: "Fluid intake"      },
              ] as { key: keyof typeof checkIn; label: string; sub: string }[]).map(({ key, label, sub }) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[14px] font-semibold text-[#1a1c1c]">{label}</p>
                    <p className="h1-label-sm text-[#747878]">{sub}</p>
                  </div>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => {
                      const selected = checkIn[key] === n;
                      return (
                        <button
                          key={n}
                          onClick={() => setCheckIn(c => ({ ...c, [key]: n }))}
                          className="w-11 h-11 rounded-full text-[13px] font-semibold transition-all active:scale-90 border flex-1"
                          style={{
                            background: selected ? "#4169e1" : "#f9f9f9",
                            color: selected ? "#fff" : "#747878",
                            borderColor: selected ? "#4169e1" : "#e2e2e2",
                            maxWidth: 52,
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Advanced toggle */}
              <div className="border-t border-[#e2e2e2] pt-3">
                <button
                  onClick={() => setAdvOpen(o => !o)}
                  className="flex items-center justify-between w-full active:opacity-70 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#747878]">Adv. Reporting</p>
                    <span className="h1-label-sm text-[#9aabb6] bg-[#f4f4f4] px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: advOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {advOpen && (
                  <div className="mt-3 space-y-3">
                    {(["HRV", "Resting HR", "Body Weight", "Mood"] as const).map(label => (
                      <div key={label} className="flex items-center gap-3">
                        <p className="text-[13px] font-semibold text-[#1a1c1c] w-24 flex-shrink-0">{label}</p>
                        <input
                          type="text"
                          placeholder="—"
                          className="flex-1 h1-field-input text-[13px]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  saveCheckIn(checkIn);
                  setCheckInDone(true);
                  setCheckInOpen(false);
                  loadAndScore();
                }}
                className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ background: "#4169e1" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Info modal */}
      {matchInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => { if (!uploading) setMatchInfoOpen(false); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4" style={{ background: "#49664018" }}>
              <div className="flex items-center justify-between">
                <p className="h1-headline-md text-[#1a1c1c]">
                  {extractedData ? "Confirm Match Info" : "Add Match Info"}
                </p>
                {!uploading && (
                  <button onClick={() => setMatchInfoOpen(false)} className="text-[#747878] active:opacity-50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="h1-body-md text-[#444748] mt-0.5">
                {extractedData ? "Check the details and edit if needed." : "Upload a screenshot of your booking or group chat."}
              </p>
            </div>

            <div className="px-6 py-5">
              {/* Loading state */}
              {uploading && (
                <div className="flex flex-col items-center gap-4 py-10">
                  <svg className="h1-spin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <p className="text-[14px] font-semibold text-[#444748]">Analysing screenshot…</p>
                </div>
              )}

              {/* Upload state */}
              {!uploading && !extractedData && (
                <div className="space-y-4">
                  <label
                    htmlFor="match-screenshot-input"
                    className="w-full border-2 border-dashed border-[#e2e2e2] rounded-2xl py-10 flex flex-col items-center gap-3 active:bg-[#f0f0f0] transition-colors cursor-pointer"
                  >
                    <input
                      id="match-screenshot-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21,15 16,10 5,21" />
                    </svg>
                    <div className="text-center">
                      <p className="text-[14px] font-semibold text-[#1a1c1c]">Choose screenshot</p>
                      <p className="text-[12px] text-[#747878] mt-0.5">Booking confirmation or WhatsApp message</p>
                    </div>
                  </label>
                  {uploadError && (
                    <p className="text-[13px] text-[#dc2626] text-center font-medium">{uploadError}</p>
                  )}
                  <button
                    onClick={() => { const blank = Object.fromEntries(Object.keys(FIELD_LABELS).map(k => [k, ""])); setExtractedData(blank); setEditedData(blank); setPlayerSlots(["","","",""]); }}
                    className="w-full text-center text-[13px] font-semibold text-[#747878] active:opacity-50 transition-opacity"
                  >
                    or insert manually
                  </button>
                </div>
              )}

              {/* Confirmation / edit state */}
              {!uploading && extractedData && (
                <div className="flex flex-col gap-5">

                  {/* Date + Time row */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-1.5">Date</p>
                      <input
                        className="h1-field-input text-[13px] text-center"
                        value={editedData.date ?? ""}
                        placeholder="YYYY-MM-DD"
                        onChange={e => setEditedData(d => ({ ...d, date: e.target.value }))}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-1.5">Time</p>
                      <input
                        className="h1-field-input text-[13px] text-center"
                        value={editedData.time ?? ""}
                        placeholder="18:30"
                        onChange={e => setEditedData(d => ({ ...d, time: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Teams */}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-2">
                      Players — tap two to swap
                    </p>
                    <div className="flex items-center gap-2">
                      {/* Team A */}
                      <div className="flex-1 flex flex-col gap-2">
                        {[0, 1].map(idx => (
                          <button
                            key={idx}
                            draggable
                            onDragStart={() => { dragSlot.current = idx; setSelectedSlot(null); }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => {
                              if (dragSlot.current === null || dragSlot.current === idx) return;
                              setPlayerSlots(s => { const n = [...s]; [n[dragSlot.current!], n[idx]] = [n[idx], n[dragSlot.current!]]; return n; });
                              dragSlot.current = null;
                            }}
                            onClick={() => handleSlotTap(idx)}
                            className="w-full px-3 py-2.5 rounded-2xl text-[13px] font-semibold text-center transition-all active:scale-95 border-2"
                            style={{
                              borderColor: selectedSlot === idx ? "#2653d4" : "#e2e2e2",
                              background: selectedSlot === idx ? "#eef2ff" : "#f9f9f9",
                              color: playerSlots[idx] ? "#1a1c1c" : "#c4c7c7",
                            }}
                          >
                            {playerSlots[idx] || "Player"}
                          </button>
                        ))}
                      </div>

                      {/* VS */}
                      <div className="flex flex-col items-center gap-1 px-1">
                        <span className="text-[11px] font-black text-[#747878] tracking-widest">VS</span>
                        <button
                          onClick={() => setPlayerSlots(s => [s[0], s[2], s[1], s[3]])}
                          className="w-7 h-7 rounded-full bg-[#f4f4f4] flex items-center justify-center active:scale-90 transition-transform"
                          title="Swap partners"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
                          </svg>
                        </button>
                      </div>

                      {/* Team B */}
                      <div className="flex-1 flex flex-col gap-2">
                        {[2, 3].map(idx => (
                          <button
                            key={idx}
                            draggable
                            onDragStart={() => { dragSlot.current = idx; setSelectedSlot(null); }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => {
                              if (dragSlot.current === null || dragSlot.current === idx) return;
                              setPlayerSlots(s => { const n = [...s]; [n[dragSlot.current!], n[idx]] = [n[idx], n[dragSlot.current!]]; return n; });
                              dragSlot.current = null;
                            }}
                            onClick={() => handleSlotTap(idx)}
                            className="w-full px-3 py-2.5 rounded-2xl text-[13px] font-semibold text-center transition-all active:scale-95 border-2"
                            style={{
                              borderColor: selectedSlot === idx ? "#2653d4" : "#e2e2e2",
                              background: selectedSlot === idx ? "#eef2ff" : "#f9f9f9",
                              color: playerSlots[idx] ? "#1a1c1c" : "#c4c7c7",
                            }}
                          >
                            {playerSlots[idx] || "Player"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Club + Court */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-1.5">Club</p>
                      <input
                        className="h1-field-input text-[13px]"
                        value={editedData.club ?? ""}
                        placeholder="—"
                        onChange={e => setEditedData(d => ({ ...d, club: e.target.value }))}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-1.5">Court</p>
                      <input
                        className="h1-field-input text-[13px] text-center"
                        value={editedData.court ?? ""}
                        placeholder="—"
                        onChange={e => setEditedData(d => ({ ...d, court: e.target.value }))}
                      />
                    </div>
                  </div>

                  <button
                    onClick={confirmMatchInfo}
                    className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
                    style={{ background: "#2653d4" }}
                  >
                    Confirm
                  </button>

                  <button
                    onClick={() => { setExtractedData(null); setUploadError(null); setPlayerSlots(["","","",""]); setSelectedSlot(null); }}
                    className="w-full py-2 text-[13px] text-[#747878] active:opacity-50"
                  >
                    Upload a different screenshot
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule detail modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setScheduleModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Coloured header */}
            <div className="px-6 pt-5 pb-4" style={{ background: scheduleModal.color + "18" }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: scheduleModal.color }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: scheduleModal.color }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="h1-headline-md text-[#1a1c1c]">{scheduleModal.title}</h3>
              {scheduleModal.subtitle && <p className="text-[13px] text-[#444748] mt-0.5">{scheduleModal.subtitle}</p>}
            </div>
            {/* Body */}
            <div className="px-6 py-5 pb-10">
              <p className="h1-body-lg text-[#444748] leading-relaxed">{scheduleModal.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Match modal */}
      {addMatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setAddMatchOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-2">
              <p className="h1-headline-md text-[#1a1c1c]">Add Match</p>
              <p className="text-[13px] text-[#747878] mt-0.5">How would you like to add it?</p>
            </div>
            <div className="px-6 pb-6 mt-3 flex flex-col gap-3">
              <button
                onClick={() => { setAddMatchOpen(false); setExtractedData(null); setUploadError(null); setMatchInfoOpen(true); }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#f4f4f4] active:scale-[0.98] transition-transform text-left"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>
                </svg>
                <div>
                  <p className="text-[14px] font-semibold text-[#1a1c1c]">Upload Screenshot</p>
                  <p className="text-[12px] text-[#747878]">Booking confirmation or WhatsApp</p>
                </div>
              </button>
              <button
                onClick={() => { setAddMatchOpen(false); setExtractedData({}); setMatchInfoOpen(true); }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#f4f4f4] active:scale-[0.98] transition-transform text-left"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <div>
                  <p className="text-[14px] font-semibold text-[#1a1c1c]">Insert Manually</p>
                  <p className="text-[12px] text-[#747878]">Enter date, time, location, players</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hydration Check modal */}
      {hydroOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setHydroOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-y-auto max-h-[88vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <p className="h1-headline-md text-[#1a1c1c]">Hydration Check</p>
                <p className="text-[13px] text-[#747878] mt-0.5">Log your water intake today</p>
              </div>
              <button onClick={() => setHydroOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 pb-8 flex flex-col gap-6">
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">How much have you drunk today?</p>
                <div className="flex gap-2 flex-wrap">
                  {["<1L","1–1.5L","1.5–2L","2–2.5L","2.5–3L","3L+"].map(n => {
                    const sel = hydrationLog.litres === n;
                    return (
                      <button key={n} onClick={() => setHydrationLog(l => ({ ...l, litres: n }))}
                        className="flex-1 py-2.5 rounded-2xl border-2 text-[12px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">What did you drink?</p>
                <div className="flex flex-wrap gap-2">
                  {["Water","Sparkling water","Sports drink","Coconut water","Tea / Coffee","Juice","Milk","Protein shake"].map(drink => {
                    const sel = hydrationLog.timing.includes(drink);
                    return (
                      <button key={drink}
                        onClick={() => setHydrationLog(l => ({ ...l, timing: sel ? l.timing.filter(d => d !== drink) : [...l.timing, drink] }))}
                        className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                        {drink}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-1">Urine colour check</p>
                <p className="text-[11px] text-[#747878] mb-3">Best proxy for hydration status</p>
                <div className="flex gap-2">
                  {[
                    { v: "clear",  label: "Clear",       bg: "#f0f9ff", border: "#bae6fd" },
                    { v: "pale",   label: "Pale yellow",  bg: "#fefce8", border: "#fde047" },
                    { v: "yellow", label: "Yellow",       bg: "#fef9c3", border: "#facc15" },
                    { v: "dark",   label: "Dark",         bg: "#fef3c7", border: "#f59e0b" },
                    { v: "brown",  label: "Brown",        bg: "#fdf4dc", border: "#b45309" },
                  ].map(({ v, label, bg, border }) => {
                    const sel = hydrationLog.urine === v;
                    return (
                      <button key={v} onClick={() => setHydrationLog(l => ({ ...l, urine: v }))}
                        className="flex-1 py-2.5 rounded-2xl border-2 text-[10px] font-bold transition-all active:scale-95 text-center"
                        style={{ borderColor: sel ? border : "#e2e2e2", background: sel ? bg : "#f9f9f9", color: "#747878" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">How do you feel?</p>
                <div className="flex gap-3">
                  {([["bad","Thirsty"],["ok","OK"],["great","Hydrated"]] as const).map(([v, label]) => {
                    const sel = hydrationLog.quality === v;
                    return (
                      <button key={v} onClick={() => setHydrationLog(l => ({ ...l, quality: v }))}
                        className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                        style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sel ? "#2653d4" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          {v === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
                          {v === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
                          {v === "great" && <path d="M8 14c1 2 6 2 8 0" />}
                          <circle cx="9" cy="9.5" r="0.8" fill={sel ? "#2653d4" : "#747878"} stroke="none" />
                          <circle cx="15" cy="9.5" r="0.8" fill={sel ? "#2653d4" : "#747878"} stroke="none" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? "#2653d4" : "#747878" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => {
                  try {
                    const entry = { ...hydrationLog, ts: new Date().toISOString() };
                    const prev = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
                    localStorage.setItem("padelop:hydration-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                  } catch {}
                  setHydroOpen(false);
                  loadAndScore();
                }}
                className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ background: "#2653d4" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nutrition Log modal */}
      {nutritionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setNutritionOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-y-auto max-h-[88vh] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <p className="h1-headline-md text-[#1a1c1c]">Log Nutrition</p>
                <p className="text-[13px] text-[#747878] mt-0.5">Track your recovery fuelling today</p>
              </div>
              <button onClick={() => setNutritionOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 pb-8 flex flex-col gap-6">

              {/* Protein rating */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">How was your protein intake today?</p>
                <div className="flex gap-3">
                  {([["low", "Not enough"], ["mid", "Getting there"], ["high", "Nailed it"]] as const).map(([v, label]) => {
                    const sel = nutritionLog.proteinRating === v;
                    return (
                      <button key={v} onClick={() => setNutritionLog(l => ({ ...l, proteinRating: v }))}
                        className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                        style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={sel ? "#2653d4" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          {v === "low"  && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
                          {v === "mid"  && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
                          {v === "high" && <path d="M8 14c1 2 6 2 8 0" />}
                          <circle cx="9" cy="9.5" r="0.8" fill={sel ? "#2653d4" : "#747878"} stroke="none" />
                          <circle cx="15" cy="9.5" r="0.8" fill={sel ? "#2653d4" : "#747878"} stroke="none" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? "#2653d4" : "#747878" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Protein sources */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">What protein sources did you have?</p>
                <div className="flex flex-wrap gap-2">
                  {["Eggs","Chicken","Fish","Red meat","Greek yogurt","Protein shake","Legumes","Tofu / Tempeh","Cottage cheese","Nuts & seeds"].map(food => {
                    const sel = nutritionLog.foods.includes(food);
                    return (
                      <button key={food}
                        onClick={() => setNutritionLog(l => ({ ...l, foods: sel ? l.foods.filter(f => f !== food) : [...l.foods, food] }))}
                        className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                        {food}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Post-match meal */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Did you eat within 30 min post-match?</p>
                <div className="flex gap-3">
                  {[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }].map(({ v, label }) => {
                    const sel = nutritionLog.postMatch === v;
                    return (
                      <button key={v} onClick={() => setNutritionLog(l => ({ ...l, postMatch: v }))}
                        className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? (v === "yes" ? "#16a34a" : "#dc2626") : "#e2e2e2", background: sel ? (v === "yes" ? "#f0fdf4" : "#fef2f2") : "#f9f9f9", color: sel ? (v === "yes" ? "#16a34a" : "#dc2626") : "#747878" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Overall quality */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Overall nutrition quality today?</p>
                <div className="flex gap-3">
                  {([["bad", "Poor"], ["ok", "Decent"], ["great", "Great"]] as const).map(([v, label]) => {
                    const sel = nutritionLog.quality === v;
                    return (
                      <button key={v} onClick={() => setNutritionLog(l => ({ ...l, quality: v }))}
                        className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                        style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={sel ? "#2653d4" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          {v === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
                          {v === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
                          {v === "great" && <path d="M8 14c1 2 6 2 8 0" />}
                          <circle cx="9" cy="9.5" r="0.8" fill={sel ? "#2653d4" : "#747878"} stroke="none" />
                          <circle cx="15" cy="9.5" r="0.8" fill={sel ? "#2653d4" : "#747878"} stroke="none" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? "#2653d4" : "#747878" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  try {
                    const entry = { ...nutritionLog, ts: new Date().toISOString() };
                    const prev = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]");
                    localStorage.setItem("padelop:nutrition-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                  } catch {}
                  setNutritionOpen(false);
                  loadAndScore();
                }}
                className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ background: "#2653d4" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category detail modal */}
      {categoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setCategoryModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="h1-font relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4" style={{ background: categoryModal.color + "18" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: categoryModal.color }} />
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: categoryModal.color }}>{categoryModal.label}</p>
                </div>
                <button onClick={() => setCategoryModal(null)} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "rgba(0,0,0,0.08)" }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
              </div>
              <p className="h1-headline-md text-[#1a1c1c]">{categoryModal.label}</p>
              <p className="h1-label-sm text-[#747878] mt-1 leading-snug">{categoryModal.subtitle}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[28px] font-bold leading-none" style={{ color: categoryModal.color }}>{categoryModal.pct}%</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#e2e2e2" }}>
                  <div className="h-full rounded-full" style={{ width: `${categoryModal.pct}%`, background: categoryModal.color, transition: "width 0.4s ease" }} />
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              {categoryModal.detail.split("\n\n").map((para, i) => (
                <p key={i} className={`h1-body-lg text-[#444748] leading-relaxed${i > 0 ? " mt-3" : ""}`}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Match Review modal */}
      {matchReviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setMatchReviewOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="h1-font relative w-full max-w-lg bg-white rounded-t-[28px] overflow-y-auto shadow-2xl"
            style={{ maxHeight: "92vh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1" />
            <div className="px-6 pt-3 pb-2 flex items-center justify-between">
              <div>
                <p className="h1-headline-md text-[#1a1c1c]">Match Review</p>
                <p className="text-[13px] text-[#747878] mt-0.5">Quick check-in while it&apos;s fresh</p>
              </div>
              <button onClick={() => setMatchReviewOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-6 pb-8 flex flex-col gap-6 mt-2">

              {/* Feeling */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">How did the match feel?</p>
                <div className="flex gap-3">
                  {([["bad","Rough"],["ok","Decent"],["great","Great"]] as const).map(([v, label]) => {
                    const sel = matchReview.feeling === v;
                    return (
                      <button key={v} onClick={() => setMatchReview(r => ({ ...r, feeling: v }))}
                        className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                        style={{ borderColor: sel ? "#7c3aed" : "#e2e2e2", background: sel ? "#f5f3ff" : "#f9f9f9" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sel ? "#7c3aed" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          {v === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
                          {v === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
                          {v === "great" && <path d="M8 14c1 2 6 2 8 0" />}
                          <circle cx="9" cy="9.5" r="0.8" fill={sel ? "#7c3aed" : "#747878"} stroke="none" />
                          <circle cx="15" cy="9.5" r="0.8" fill={sel ? "#7c3aed" : "#747878"} stroke="none" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? "#7c3aed" : "#747878" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Result */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Result?</p>
                <div className="flex gap-3">
                  {[{ v: "win", label: "Win", color: "#16a34a", bg: "#f0fdf4" }, { v: "loss", label: "Loss", color: "#dc2626", bg: "#fef2f2" }].map(({ v, label, color, bg }) => {
                    const sel = matchReview.result === v;
                    return (
                      <button key={v} onClick={() => setMatchReview(r => ({ ...r, result: v }))}
                        className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? color : "#e2e2e2", background: sel ? bg : "#f9f9f9", color: sel ? color : "#747878" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opponent level */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Opponent level?</p>
                <div className="flex gap-3">
                  {[{ v: "easy", label: "Easier" }, { v: "equal", label: "Equal" }, { v: "tough", label: "Tougher" }].map(({ v, label }) => {
                    const sel = matchReview.opponent === v;
                    return (
                      <button key={v} onClick={() => setMatchReview(r => ({ ...r, opponent: v }))}
                        className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? "#7c3aed" : "#e2e2e2", background: sel ? "#f5f3ff" : "#f9f9f9", color: sel ? "#7c3aed" : "#747878" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Energy on court */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Your energy on court?</p>
                <div className="flex gap-3">
                  {([["low","Low"],["mid","Mid"],["high","High"]] as const).map(([v, label]) => {
                    const sel = matchReview.energy === v;
                    const icon = v === "low"
                      ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={sel ? "#7c3aed" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="16" height="10" rx="1.5"/><path d="M20 11v2"/></svg>
                      : v === "mid"
                      ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={sel ? "#7c3aed" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,2 13,10 19,10 11,22 11,14 5,14 13,2"/></svg>
                      : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={sel ? "#7c3aed" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C10 6 7 9 7 13a5 5 0 0 0 10 0c0-2-1-3.5-2-5 0 2-1 3-2 3-1.5 0-2.5-1.5-1-3z"/></svg>;
                    return (
                      <button key={v} onClick={() => setMatchReview(r => ({ ...r, energy: v }))}
                        className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                        style={{ borderColor: sel ? "#7c3aed" : "#e2e2e2", background: sel ? "#f5f3ff" : "#f9f9f9" }}>
                        {icon}
                        <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? "#7c3aed" : "#747878" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Injury */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Any injuries or niggles?</p>
                <div className="flex gap-3">
                  {[{ v: "yes", label: "Yes", color: "#dc2626", bg: "#fef2f2" }, { v: "no", label: "All good", color: "#16a34a", bg: "#f0fdf4" }].map(({ v, label, color, bg }) => {
                    const sel = matchReview.injury === v;
                    return (
                      <button key={v} onClick={() => setMatchReview(r => ({ ...r, injury: v }))}
                        className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? color : "#e2e2e2", background: sel ? bg : "#f9f9f9", color: sel ? color : "#747878" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* What did you do well */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">What did you do well?</p>
                <div className="flex flex-wrap gap-2">
                  {["Serve","Bandeja","Smash","Volleys","Defense","Attack","Positioning","Communication","Movement","Mental strength"].map(tag => {
                    const sel = matchReview.wellDone.includes(tag);
                    return (
                      <button key={tag}
                        onClick={() => setMatchReview(r => ({ ...r, wellDone: sel ? r.wellDone.filter(t => t !== tag) : [...r.wellDone, tag] }))}
                        className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? "#16a34a" : "#e2e2e2", background: sel ? "#f0fdf4" : "#f9f9f9", color: sel ? "#16a34a" : "#747878" }}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* What needs work */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">What needs work?</p>
                <div className="flex flex-wrap gap-2">
                  {["Serve","Bandeja","Smash","Volleys","Defense","Attack","Positioning","Communication","Movement","Mental strength"].map(tag => {
                    const sel = matchReview.improved.includes(tag);
                    return (
                      <button key={tag}
                        onClick={() => setMatchReview(r => ({ ...r, improved: sel ? r.improved.filter(t => t !== tag) : [...r.improved, tag] }))}
                        className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? "#dc2626" : "#e2e2e2", background: sel ? "#fef2f2" : "#f9f9f9", color: sel ? "#dc2626" : "#747878" }}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mental state */}
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#747878] mb-3">Mental state</p>
                <div className="flex flex-col gap-3">
                  {([["Before","mentalBefore"],["During","mentalDuring"],["After","mentalAfter"]] as [string, "mentalBefore"|"mentalDuring"|"mentalAfter"][]).map(([phase, key]) => (
                    <div key={phase} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-[#747878] w-12 flex-shrink-0">{phase}</span>
                      <div className="flex gap-2 flex-1">
                        {(["bad","ok","great"] as const).map(v => {
                          const sel = matchReview[key] === v;
                          return (
                            <button key={v}
                              onClick={() => setMatchReview(r => ({ ...r, [key]: v }))}
                              className="flex-1 py-2 rounded-xl border-2 flex items-center justify-center transition-all active:scale-95"
                              style={{ borderColor: sel ? "#7c3aed" : "#e2e2e2", background: sel ? "#f5f3ff" : "#f9f9f9" }}>
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={sel ? "#7c3aed" : "#747878"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="9" />
                                {v === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" />}
                                {v === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5" />}
                                {v === "great" && <path d="M8 14c1 2 6 2 8 0" />}
                                <circle cx="9" cy="9.5" r="0.8" fill={sel ? "#7c3aed" : "#747878"} stroke="none" />
                                <circle cx="15" cy="9.5" r="0.8" fill={sel ? "#7c3aed" : "#747878"} stroke="none" />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  try {
                    const entry = { ...matchReview, ts: new Date().toISOString() };
                    const prev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
                    localStorage.setItem("padelop:match-reviews", JSON.stringify([entry, ...prev].slice(0, 50)));
                  } catch {}
                  setMatchReviewOpen(false);
                  loadAndScore();
                }}
                className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ background: "#7c3aed" }}
              >
                Save Review
              </button>
              <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Routine info modal */}
      {routineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setRoutineModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4" style={{ background: "#49664018" }}>
              <div className="flex items-center gap-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="#496640" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="9" y1="1" x2="9" y2="13" />
                  <polyline points="5,9 9,13 13,9" />
                  <line x1="3" y1="17" x2="15" y2="17" />
                </svg>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#496640]">Do This Right Now</p>
              </div>
              <h3 className="h1-headline-md text-[#1a1c1c]">{routineModal.label}</h3>
            </div>
            <div className="px-6 py-5 pb-10">
              <p className="h1-body-lg text-[#444748] leading-relaxed">{routineModal.detail}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
