"use client";

import { useState, useEffect, useRef } from "react";
import { computeScores, loadScoringData, computeAllTimeScores, type Scores } from "@/lib/scoring";
import { computeNotifications, type Notif } from "@/lib/notifications";
import ScoreRing from "@/components/score-ring";

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
  const [mustDoExpanded, setMustDoExpanded] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [hydroOpen, setHydroOpen] = useState(false);
  const [hydrationLog, setHydrationLog] = useState({ litres: "", timing: [] as string[], quality: "", urine: "" });
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [nutritionLog, setNutritionLog] = useState({ proteinRating: "", foods: [] as string[], postMatch: "", quality: "" });
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [allTimeScores, setAllTimeScores] = useState<Scores>({ overall: 65, recovery: 60, hydration: 52, energy: 58, mobility: 58 });
  const [dayTypeOverride, setDayTypeOverride] = useState<"recovery" | "training" | "rest" | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [matchReviewOpen, setMatchReviewOpen] = useState(false);
  const [matchReview, setMatchReview] = useState({ feeling: "", result: "", opponent: "", energy: "", injury: "", wellDone: [] as string[], improved: [] as string[], mentalBefore: "", mentalDuring: "", mentalAfter: "" });
  const [postGamePrompt, setPostGamePrompt] = useState(false);
  const [matchListOpen, setMatchListOpen] = useState(false);

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

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Post-game review prompt: show once per match after match ends (30 min grace)
  useEffect(() => {
    if (!editedData.date || !editedData.time) return;
    const matchMs = new Date(`${editedData.date}T${editedData.time}:00`).getTime();
    if (isNaN(matchMs)) return;
    const now = Date.now();
    if (now < matchMs + 30 * 60 * 1000) return; // match hasn't ended yet
    // Check if already dismissed or reviewed today
    const dismissedKey = `padelop:post-game-dismissed:${editedData.date}`;
    if (localStorage.getItem(dismissedKey)) return;
    try {
      const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
      if (reviews[0]?.ts?.slice(0, 10) === editedData.date) return; // already reviewed
    } catch {}
    setPostGamePrompt(true);
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

  // Shared day type — derived from `now` state so it's always local time, never UTC
  const todayYMD = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    : "";
  const isMatchDay = !!todayYMD && editedData.date === todayYMD && !!editedData.time;
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

          {/* Greeting */}
          {(() => {
            const h = now ? now.getHours() : 12;
            const tod = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
            let msg = "";
            if (dayType === "match") {
              const matchTimeStr = editedData.time || "18:30";
              const [mH, mM] = matchTimeStr.split(":").map(Number);
              const matchMins = mH * 60 + mM;
              const nowMins = h * 60 + (now ? now.getMinutes() : 0);
              const diffMins = matchMins - nowMins;
              if (diffMins > 180) {
                const hrs = Math.floor(diffMins / 60);
                msg = `Match in ${hrs}h. Stay light, hydrate steadily, and eat your pre-game meal ${hrs > 4 ? "a few hours before" : "soon"}.`;
              } else if (diffMins > 60) {
                msg = "Time to warm up. Dynamic activation, no heavy food — just sip water and focus.";
              } else if (diffMins > 0) {
                msg = "Almost game time. Breathe, visualise, and trust your prep.";
              } else {
                msg = "Great match today. Prioritise recovery — stretch, eat protein, and rest up.";
              }
            } else if (dayType === "recovery") {
              msg = "Recovery day. Keep moving gently, drink plenty of water, and get your protein in.";
            } else if (dayType === "training") {
              msg = "Training day. Make sure you're fuelled, warmed up, and ready to work on your patterns.";
            } else {
              msg = "Rest day. Let your body absorb the work. Hydrate, eat well, and take it easy.";
            }
            return (
              <div className="mb-5 mt-2 px-1 text-center">
                <p className="text-[22px] font-bold text-[#1a1c1c] leading-snug" style={{ fontFamily: "var(--font-hanken)" }}>Good {tod}.</p>
                <p className="text-[16px] text-[#5a6370] mt-1 leading-snug">{msg}</p>
              </div>
            );
          })()}

          {/* Score ring */}
          <div className="flex justify-center mb-6">
            <ScoreRing />
          </div>

          <div className="space-y-4">

            {/* Match Card */}
            <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 overflow-hidden">
              {!editedData.time || countdown.past ? (
                /* Empty state */
                <button
                  onClick={() => { setExtractedData(null); setUploadError(null); setMatchInfoOpen(true); }}
                  className="w-full px-6 py-5 flex items-center gap-4 active:opacity-60 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#c4c7c7] flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9aab96" strokeWidth="2" strokeLinecap="round">
                      <line x1="7" y1="1" x2="7" y2="13" /><line x1="1" y1="7" x2="13" y2="7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-semibold text-[#1a1c1c]">Add a match</p>
                    <p className="text-[13px] text-[#9aab96] mt-0.5">Upload booking or enter details</p>
                  </div>
                </button>
              ) : (
                /* Match info */
                <div className="px-5 pt-3 pb-3 relative">
                  {(() => {
                    const club = editedData.club || "Location TBD";
                    const court = editedData.court ? `Court ${editedData.court}` : "";
                    return (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold tracking-widest uppercase text-[#9aab96]">Next Match</p>
                          {editedData.date && now && (() => {
                            const tomorrowDate = new Date(now); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                            const tomorrowYMD = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
                            const label = editedData.date === todayYMD ? "Today" : editedData.date === tomorrowYMD ? "Tomorrow" : new Date(editedData.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
                            return <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#f0f4ff] text-[#2653d4]">{label}</span>;
                          })()}
                        </div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="h1-headline-md text-[#1a1c1c]">Padel Match</p>
                          <span className="text-[15px] font-semibold text-[#747878] mr-8">{editedData.time}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#747878]">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                            <span className="text-[12px] font-medium leading-tight">{club}</span>
                          </div>
                          {court && (
                            <span className="text-[12px] font-medium text-[#9aab96] mr-8">{court}</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                  <button
                    onClick={() => setMatchInfoOpen(true)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center active:bg-[#f0f0f0] transition-colors"
                    aria-label="Edit match"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>


            {/* Horizontal Day Timeline */}
            {(() => {
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
              const curMins = now ? now.getHours() * 60 + now.getMinutes() : -1;

              // Auto-detect current item
              let autoIdx = 0;
              if (curMins >= toMins(schedule[schedule.length - 1].time)) {
                autoIdx = schedule.length - 1;
              } else {
                for (let i = 0; i < schedule.length - 1; i++) {
                  if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { autoIdx = i; break; }
                }
              }

              const item = schedule[autoIdx];
              const detail = SCHEDULE_DETAILS[item.title];

              // Notch x-position: accounts for px-3 (12px) padding on each side
              const notchPct = Math.min(Math.max(((autoIdx + 0.5) / n) * 100, 4), 96);

              const fmtTime = (t: string) => {
                const [h, m] = t.split(":").map(Number);
                const ampm = h >= 12 ? "pm" : "am";
                const h12 = h % 12 || 12;
                return m === 0 ? `${h12}${ampm}` : `${h12}:${pad(m)}${ampm}`;
              };

              return (
                <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 px-4 pt-5 pb-4">

                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <p style={{ fontWeight: 600, fontSize: 20, color: "#1a1c1c", lineHeight: 1.2 }}>Today&apos;s Plan</p>
                    <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-[#f0f4ff] text-[#2653d4]">
                      {DAY_TYPE_META[dayType].label}
                    </span>
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
                        const isPast    = idx < autoIdx;
                        const isCurrent = idx === autoIdx;
                        const tapDetail = SCHEDULE_DETAILS[s.title];
                        return (
                          <button
                            key={idx}
                            onClick={() => tapDetail && setScheduleModal({ title: s.title, subtitle: s.subtitle, detail: tapDetail, color: s.color })}
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
                    <button
                      className="w-full rounded-[18px] px-5 py-4 text-left active:opacity-70 transition-opacity"
                      style={{ background: "#f4f5f5" }}
                      onClick={() => detail && setScheduleModal({ title: item.title, subtitle: item.subtitle, detail, color: item.color })}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="h1-headline-md text-[#1a1c1c] leading-snug">{item.title}</p>
                          {item.subtitle && <p className="text-[13px] text-[#747878] mt-0.5 leading-snug">{item.subtitle}</p>}
                        </div>
                        {detail && (
                          <div
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: item.color + "18" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>

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

              const curMins = now ? now.getHours() * 60 + now.getMinutes() : -1;
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
                                      {now ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "--:--"}
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
            action: () => { setFabOpen(false); setMatchListOpen(true); },
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
                        type="date"
                        className="h1-field-input text-[13px] text-center"
                        value={editedData.date ?? ""}
                        onChange={e => setEditedData(d => ({ ...d, date: e.target.value }))}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-1.5">Time</p>
                      <input
                        type="time"
                        className="h1-field-input text-[13px] text-center"
                        value={editedData.time ?? ""}
                        onChange={e => setEditedData(d => ({ ...d, time: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Teams */}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#747878] mb-2">Players</p>
                    <div className="flex items-center gap-2">
                      {/* Team A */}
                      <div className="flex-1 flex flex-col gap-2">
                        {[0, 1].map(idx => (
                          <input
                            key={idx}
                            className="h1-field-input text-[13px] text-center"
                            value={playerSlots[idx]}
                            placeholder={idx === 0 ? "You" : "Partner"}
                            onChange={e => setPlayerSlots(s => { const n = [...s]; n[idx] = e.target.value; return n; })}
                          />
                        ))}
                      </div>

                      {/* VS */}
                      <div className="flex flex-col items-center gap-1 px-1">
                        <span className="text-[11px] font-black text-[#747878] tracking-widest">VS</span>
                        <button
                          onClick={() => setPlayerSlots(s => [s[2], s[3], s[0], s[1]])}
                          className="w-7 h-7 rounded-full bg-[#f4f4f4] flex items-center justify-center active:scale-90 transition-transform"
                          title="Swap teams"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
                          </svg>
                        </button>
                      </div>

                      {/* Team B */}
                      <div className="flex-1 flex flex-col gap-2">
                        {[2, 3].map(idx => (
                          <input
                            key={idx}
                            className="h1-field-input text-[13px] text-center"
                            value={playerSlots[idx]}
                            placeholder="Opponent"
                            onChange={e => setPlayerSlots(s => { const n = [...s]; n[idx] = e.target.value; return n; })}
                          />
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

      {/* Match list modal */}
      {matchListOpen && (() => {
        let reviews: { ts: string; result?: string; feeling?: string }[] = [];
        try { reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); } catch {}

        const hasMatch = !!(editedData.date && editedData.time);
        const matchPast = hasMatch && new Date(`${editedData.date}T${editedData.time}:00`).getTime() < Date.now();
        const alreadyReviewed = reviews[0]?.ts?.slice(0, 10) === editedData.date;
        const hasUnrated = hasMatch && matchPast && !alreadyReviewed;
        const allDone = !hasUnrated && reviews.length > 0;
        const nothing = !hasUnrated && reviews.length === 0;

        const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        const fmtReviewDate = (ts: string) => new Date(ts).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => setMatchListOpen(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="h1-font relative w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden shadow-2xl"
              style={{ maxHeight: "80vh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1" />
              <div className="px-6 pt-3 pb-4 flex items-center justify-between">
                <div>
                  <p className="h1-headline-md text-[#1a1c1c]">Match Reviews</p>
                  <p className="text-[13px] text-[#747878] mt-0.5">Rate your games to track performance</p>
                </div>
                <button onClick={() => setMatchListOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 96px)" }}>
                {nothing && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-[32px] mb-3">🎾</p>
                    <p className="text-[16px] font-semibold text-[#1a1c1c]">No matches yet</p>
                    <p className="text-[13px] text-[#747878] mt-1">Add a match to start tracking your game.</p>
                  </div>
                )}

                {allDone && !hasUnrated && reviews.length === 1 && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-[32px] mb-3">✅</p>
                    <p className="text-[16px] font-semibold text-[#1a1c1c]">You're all done updating matches!</p>
                    <p className="text-[13px] text-[#747878] mt-1">Your latest game is reviewed. Keep it up.</p>
                  </div>
                )}

                {/* Unrated match */}
                {hasUnrated && (
                  <>
                    <div className="px-6 py-2 bg-[#f9f9f9]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9aab96]">Needs a rating</p>
                    </div>
                    <button
                      onClick={() => { setMatchListOpen(false); setMatchReviewOpen(true); }}
                      className="w-full flex items-center gap-4 px-6 py-4 active:bg-[#f9f9f9] transition-colors"
                      style={{ borderBottom: "1px solid #f4f4f4" }}
                    >
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#f0f4ff]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 21h8M12 17v4"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.3-2.7 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[15px] font-semibold text-[#1a1c1c]">{editedData.date ? fmtDate(editedData.date) : "Recent match"}</p>
                        <p className="text-[12px] text-[#747878] mt-0.5">{editedData.time}{editedData.club ? ` · ${editedData.club}` : ""}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#fff3cd] text-[#a16207] whitespace-nowrap flex-shrink-0">Rate now</span>
                    </button>
                  </>
                )}

                {/* Previous reviews */}
                {reviews.length > 0 && (
                  <>
                    <div className="px-6 py-2 bg-[#f9f9f9]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9aab96]">Previous games</p>
                    </div>
                    {reviews.map((rev, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-6 py-4"
                        style={{ borderBottom: i < reviews.length - 1 ? "1px solid #f4f4f4" : "none" }}
                      >
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#f4f4f4]">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill="#747878" stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill="#747878" stroke="none"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[15px] font-semibold text-[#1a1c1c]">{fmtReviewDate(rev.ts)}</p>
                          <p className="text-[12px] text-[#747878] mt-0.5">
                            {[rev.result, rev.feeling ? `Felt ${rev.feeling}` : ""].filter(Boolean).join(" · ") || "Reviewed"}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#caecbc] text-[#496640] whitespace-nowrap flex-shrink-0">Rated</span>
                      </div>
                    ))}
                  </>
                )}

                {/* All done banner when there's unrated + history */}
                {allDone && reviews.length > 1 && (
                  <div className="px-6 py-4 text-center border-t border-[#f4f4f4]">
                    <p className="text-[13px] text-[#747878]">You're all done — all matches reviewed 🎾</p>
                  </div>
                )}

                <div className="h-6" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Post-game prompt */}
      {postGamePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" onClick={() => {
          localStorage.setItem(`padelop:post-game-dismissed:${editedData.date}`, "1");
          setPostGamePrompt(false);
        }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white rounded-[28px] px-6 py-7 shadow-2xl text-center"
            style={{ fontFamily: "var(--font-hanken)", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Trophy icon */}
            <div className="w-14 h-14 rounded-full bg-[#f0f4ff] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 21h8M12 17v4"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.3-2.7 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
              </svg>
            </div>
            <p className="text-[20px] font-bold text-[#1a1c1c] mb-1">Great game!</p>
            <p className="text-[14px] text-[#747878] mb-6 leading-snug">Take a second to rate your match — it helps track your progress and readiness.</p>
            <button
              onClick={() => {
                setPostGamePrompt(false);
                setMatchReviewOpen(true);
              }}
              className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white mb-3 active:opacity-80 transition-opacity"
              style={{ background: "#2653d4" }}
            >
              Rate my match
            </button>
            <button
              onClick={() => {
                localStorage.setItem(`padelop:post-game-dismissed:${editedData.date}`, "1");
                setPostGamePrompt(false);
              }}
              className="w-full py-2.5 text-[14px] font-semibold text-[#747878] active:opacity-60 transition-opacity"
            >
              Maybe later
            </button>
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
                    if (editedData.date) localStorage.setItem(`padelop:post-game-dismissed:${editedData.date}`, "1");
                  } catch {}
                  setMatchReviewOpen(false);
                  setPostGamePrompt(false);
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
