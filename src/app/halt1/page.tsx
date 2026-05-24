"use client";

import { useState, useEffect, useRef } from "react";

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

export default function Halt1Page() {
  const [hydration, setHydration] = useState(false);
  const [mobility, setMobility] = useState(false);
  const [visualise, setVisualise] = useState(true);
  const [preMatchMeal, setPreMatchMeal] = useState(false);
  const [sleep, setSleep] = useState(false);
  const [boxBreathing, setBoxBreathing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<{ title: string; subtitle?: string; detail: string; color: string } | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkIn, setCheckIn] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });
  const [countdown, setCountdown] = useState({ h: 0, m: 0, past: false });
  const [fabOpen, setFabOpen] = useState(false);
  const [routineModal, setRoutineModal] = useState<{ label: string; detail: string } | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [mustDoExpanded, setMustDoExpanded] = useState(false);

  // Match info state
  const [matchInfoOpen, setMatchInfoOpen] = useState(false);
  const [matchInfoDone, setMatchInfoDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Record<string, string | null> | null>(null);
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setMatchInfoDone(true);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const match = new Date();
      match.setHours(18, 30, 0, 0);
      const diff = match.getTime() - now.getTime();
      if (diff <= 0) { setCountdown({ h: 0, m: 0, past: true }); return; }
      const total = Math.floor(diff / 60000);
      setCountdown({ h: Math.floor(total / 60), m: total % 60, past: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
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
        setUploading(false);
      } catch {
        setUploadError("Network error. Please try again.");
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmMatchInfo = () => {
    localStorage.setItem("padelop:next-match", JSON.stringify(editedData));
    setExtractedData(editedData);
    setMatchInfoDone(true);
    setMatchInfoOpen(false);
  };

  const SCHEDULE_DETAILS: Record<string, string> = {
    "Wake up & hydrate": "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.",
    "Breakfast": "Oats are a slow-releasing carbohydrate that keeps blood sugar stable for hours. Eggs deliver complete protein to protect muscle. Fruit provides natural sugars and hydrating water content.",
    "Morning mobility": "Light mobility work increases range of motion and blood flow without fatiguing your muscles before a match. Foam rolling uses your body weight to apply pressure and release adhesions. Key areas for padel: hip flexors, IT band, calves, thoracic spine.",
    "Pre-game meal": "A small solid meal 60–90 min before the match tops off energy stores without sitting heavy in your stomach. Eggs provide fast-absorbing protein; toast adds digestible carbs. Keep portions modest.",
    "Warmup & activation": "Dynamic warmup primes the neuromuscular system — it signals your fast-twitch fibres that explosive movement is coming. Lateral drills mimic court-side movement patterns. Build from 60% to 80–90% intensity.",
    "Match": "Match time. Focus on early rhythm — the first few games set the tempo. Communicate constantly with your partner. If losing points from the back, use the lob as a reset rather than going for winners. Stay hydrated between sets.",
    "Post-match cool down": "Cooling down gradually lowers your heart rate. Static stretching (30-sec holds) is most effective now — muscles are warm and pliable. Focus on quads, hip flexors, calves, and shoulder external rotators.",
    "Recovery meal": "The 30-minute post-exercise window has the highest rate of muscle protein synthesis. Aim for 20–40 g protein + 60–80 g carbs. A protein shake + banana works; so does chicken + rice.",
    "Wind down": "Blue light from screens suppresses melatonin production by up to 50%. In the 60 minutes before bed: dim lights, avoid screens, try light reading or slow breathing. A consistent bedtime stabilises your circadian rhythm.",
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
          <section className="flex flex-col items-center text-center mb-8 mt-4">
            <div className="relative mb-4" style={{ width: 210, height: 210 }}>
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="transparent" strokeWidth="6" className="stroke-current text-[#e2e2e2]" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="transparent" strokeWidth="6" strokeLinecap="round"
                  className="h1-ring stroke-current text-[#2653d4]"
                  style={{ strokeDasharray: 264, strokeDashoffset: 40 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-black" style={{ fontSize: 68, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.02em" }}>85</span>
                <span className="h1-label-sm text-[#444748] uppercase tracking-wider">Readiness</span>
              </div>
            </div>
            <p className="text-[17px] leading-[26px] text-[#444748] px-4">
              Optimal recovery achieved. You&apos;re primed for high-intensity movement today.
            </p>
          </section>

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
                <h3 className="h1-headline-md text-black mb-1.5">Mixed Doubles Elite</h3>
                <div className="flex items-center gap-3 text-[#444748]">
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>location_on</span>
                  <span className="h1-body-md">Padel Club Pro, Court 4</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444748" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-5 top-1/2 -translate-y-1/2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              <div className="border-t border-[#e2e2e2]" />
              <button
                onClick={() => { setExtractedData(null); setUploadError(null); setMatchInfoOpen(true); }}
                className="w-full px-6 py-3 flex items-center gap-2 active:opacity-60 transition-opacity"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#9aab96" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="5.5" y1="1" x2="5.5" y2="10" /><line x1="1" y1="5.5" x2="10" y2="5.5" />
                </svg>
                <span className="text-[12px] font-medium text-[#9aab96]">Add a match</span>
              </button>
            </div>

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
                const cols = [
                  { label: "Hydration", pct: 72, color: "#4285f4" },
                  { label: "Recovery",  pct: 88, color: "#496640" },
                  { label: "Energy",    pct: 65, color: "#f59e0b" },
                  { label: "Mobility",  pct: 54, color: "#0891b2" },
                ];
                const r = 24, sz = 56, cx = 28;
                return (
                  <div className="flex">
                    {cols.map(({ label, pct, color }, i) => {
                      const fillH = 2 * r * pct / 100;
                      const fillY = cx + r - fillH;
                      const rating = pct >= 85 ? "Optimal" : pct >= 65 ? "Good" : pct >= 45 ? "Fair" : "Low";
                      const ratingColor = pct >= 85 ? "#496640" : pct >= 65 ? "#496640" : pct >= 45 ? "#f59e0b" : "#dc2626";
                      return (
                        <div
                          key={label}
                          className="flex-1 min-w-0 px-2 py-4 flex flex-col items-center gap-1"
                          style={{ borderLeft: i > 0 ? "1px solid #e2e2e2" : "none" }}
                        >
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
                        </div>
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
            <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 overflow-hidden">
              <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                <p className="h1-headline-md text-[#1a1c1c]">Notifications</p>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#4169e110] text-[#4169e1]">6 new</span>
              </div>
              {/* Featured */}
              <div className="mx-4 mb-3 px-4 py-3.5 rounded-2xl" style={{ background: "#4169e110" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4169e1] flex-shrink-0" />
                  <span className="text-[11px] font-bold tracking-wide text-[#4169e1]">Just now</span>
                </div>
                <p className="text-[14px] font-semibold text-[#1a1c1c] leading-snug">Match in 90 min — start your box breathing and dynamic warm-up now.</p>
                <p className="text-[12px] font-semibold mt-1.5 text-[#4169e1]">Box Breathing (4x4) →</p>
              </div>
              {[
                { time: "16:45", message: "Match in 90 min. Start your box breathing (4x4) routine now.", link: "Box Breathing (4x4)" },
                { time: "15:15", message: "HRV trending up this week — a sign your training load is well-managed.", link: null },
                { time: "12:00", message: "Pre-match meal window opens in 30 min. Aim for carbs + protein.", link: null },
              ].map((n, i) => (
                <div key={i} className="flex items-start gap-4 px-6 py-3.5 border-t border-[#f4f4f4]">
                  <span className="text-[11px] font-semibold text-[#747878] flex-shrink-0 w-12 pt-0.5">{n.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[#1a1c1c] leading-snug">{n.message}</p>
                    {n.link && <p className="text-[12px] font-semibold mt-1 text-[#4169e1]">{n.link} →</p>}
                  </div>
                </div>
              ))}
              <div className="border-t border-[#f4f4f4] px-6 py-3">
                <button className="text-[13px] font-semibold text-[#4169e1]">See all →</button>
              </div>
            </div>

            {/* Do This Right Now */}
            <div className="bg-white rounded-[24px] p-6 h1-ambient border border-[#c4c7c7]/10">
              {(() => {
                const items = [
                  { label: "Hydration 3.5L",      checked: hydration,    set: setHydration,    detail: "Drink 500ml of water with electrolytes before you do anything else. After hours of sleep your body is dehydrated — even mild dehydration (1–2%) measurably reduces reaction time, concentration, and physical output. Electrolytes (sodium, potassium, magnesium) help your cells absorb the water faster than plain water alone." },
                  { label: "Pre-match meal (2–3h out)",  checked: preMatchMeal, set: setPreMatchMeal, detail: "Eat a moderate meal 2–3 hours before the match: carbohydrates for fuel (rice, pasta, oats), lean protein to protect muscle, and nothing heavy or unfamiliar. This window gives your body time to digest without leaving you under-fuelled. Avoid high-fat and high-fibre foods close to match time — they slow digestion and can cause discomfort mid-game." },
                  { label: "10min Dynamic Mobility",     checked: mobility,     set: setMobility,     detail: "Spend 10 minutes on dynamic mobility — leg swings, hip circles, thoracic rotations, and lateral lunges. This increases blood flow to the joints and primes the neuromuscular system for explosive movement. Static stretching before a match reduces power output; dynamic movement builds it." },
                  { label: "Visualise Key Tactics",      checked: visualise,    set: setVisualise,    detail: "Close your eyes for 3–5 minutes and mentally rehearse your key patterns: your serve placement, your net approach after a quality drive, and your reset lob when under pressure. Visualisation activates the same neural pathways as physical practice. Athletes who visualise consistently perform better under match pressure." },
                  { label: "Box Breathing (4x4)",        checked: boxBreathing, set: setBoxBreathing, detail: "Box breathing regulates your autonomic nervous system before competition. Inhale for 4 counts, hold for 4, exhale for 4, hold for 4 — repeat 4–6 cycles. This technique is used by elite athletes and military operators to lower heart rate and cortisol, sharpen focus, and shift from anxious anticipation to controlled readiness. Do it 15–30 minutes before warm-up." },
                  { label: "Sleep 7–9h tonight",         checked: sleep,        set: setSleep,        detail: "Sleep is the single highest-leverage recovery tool available. During deep sleep your body releases growth hormone, repairs muscle tissue, and consolidates motor patterns learned during training. Even one night under 6 hours measurably reduces reaction time, decision-making speed, and injury resilience. Prioritise a consistent bedtime — it matters more than any supplement." },
                ];
                const sorted = [...items.filter(i => !i.checked), ...items.filter(i => i.checked)];
                const doneCount = items.filter(i => i.checked).length;
                const total = items.length;
                const visible = mustDoExpanded ? sorted : sorted.slice(0, 2);
                return (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="h1-headline-md text-black">Must Do&apos;s Today</h3>
                      {doneCount > 0 && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: doneCount === total ? "#caecbc" : "#f4f4f4", color: doneCount === total ? "#496640" : "#747878" }}>
                          {doneCount === total ? "⚡ All done" : `${doneCount}/${total}`}
                        </span>
                      )}
                    </div>
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
              const schedule = [
                { time: "07:00", title: "Wake up & hydrate",    subtitle: "500ml water before anything else", color: "#f59e0b" },
                { time: "07:30", title: "Breakfast",             subtitle: "Oats, eggs, fruit",                color: "#16a34a" },
                { time: "09:00", title: "Morning mobility",      subtitle: "Foam roll & light stretching",     color: "#0891b2" },
                { time: "12:30", title: "Pre-game meal",         subtitle: "Chicken, rice, light salad",       color: "#16a34a" },
                { time: "17:30", title: "Warmup & activation",   subtitle: "Dynamic drills, 30 min",           color: "#2653d4" },
                { time: "18:30", title: "Match",                 subtitle: "Mixed Doubles Elite — Court 4",    color: "#1e3a1e" },
                { time: "20:00", title: "Post-match cool down",  subtitle: "Stretch & mobility, 15 min",       color: "#7c3aed" },
                { time: "20:30", title: "Recovery meal",         subtitle: "Protein + carbs within 30 min",    color: "#16a34a" },
                { time: "22:30", title: "Wind down",             subtitle: "No screens, light reading",        color: "#94a3b8" },
              ];
              const now = new Date();
              const curMins = now.getHours() * 60 + now.getMinutes();
              const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
              return (
                <div className="bg-white rounded-[24px] h1-ambient border border-[#c4c7c7]/10 p-6">
                  <div className="mb-5">
                    <h3 className="h1-headline-md text-black">Today&apos;s Schedule</h3>
                    <p className="text-[13px] font-semibold mt-0.5" style={{ color: "#1e3a1e" }}>🎾 Game Day</p>
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

        {/* FAB speed dial */}
        {fabOpen && (
          <div className="fixed inset-0 z-30" onClick={() => setFabOpen(false)} />
        )}
        <div className="fixed right-6 bottom-24 z-40 flex flex-col items-end gap-3">
          {fabOpen && [
            {
              label: "Upload match screenshot",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>
                </svg>
              ),
              action: () => { setFabOpen(false); setExtractedData(null); setUploadError(null); setMatchInfoOpen(true); },
            },
          ].map((item, i) => (
            <div
              key={item.label}
              className="flex items-center gap-3"
              style={{ animation: `speedDialUp 0.18s ease ${i * 0.06}s both` }}
            >
              <span
                className="bg-white text-[13px] font-semibold text-[#1a1c1c] px-4 py-2 rounded-full whitespace-nowrap"
                style={{ boxShadow: "0 2px 14px rgba(0,0,0,0.13)" }}
              >
                {item.label}
              </span>
              <button
                onClick={item.action}
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                style={{ boxShadow: "0 2px 14px rgba(0,0,0,0.13)" }}
              >
                {item.icon}
              </button>
            </div>
          ))}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3" onClick={() => setCheckInOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#e2e2e2]" />
            </div>
            {/* Header */}
            <div className="px-6 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
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
                onClick={() => { setCheckInDone(true); setCheckInOpen(false); }}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#e2e2e2] rounded-2xl py-10 flex flex-col items-center gap-3 active:bg-[#f0f0f0] transition-colors"
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#496640" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21,15 16,10 5,21" />
                    </svg>
                    <div className="text-center">
                      <p className="text-[14px] font-semibold text-[#1a1c1c]">Choose screenshot</p>
                      <p className="text-[12px] text-[#747878] mt-0.5">Booking confirmation or WhatsApp message</p>
                    </div>
                  </button>
                  {uploadError && (
                    <p className="text-[13px] text-[#dc2626] text-center font-medium">{uploadError}</p>
                  )}
                </div>
              )}

              {/* Confirmation / edit state */}
              {!uploading && extractedData && (
                <div className="space-y-4">
                  {Object.keys(FIELD_LABELS).map((key) => (
                    <div key={key}>
                      <p className="text-[12px] font-semibold text-[#747878] uppercase tracking-wide mb-1">{FIELD_LABELS[key]}</p>
                      <input
                        className="h1-field-input"
                        value={editedData[key] ?? ""}
                        placeholder="—"
                        onChange={(e) => setEditedData(d => ({ ...d, [key]: e.target.value }))}
                      />
                    </div>
                  ))}

                  <button
                    onClick={confirmMatchInfo}
                    className="w-full py-3.5 rounded-2xl bg-[#496640] text-white text-[14px] font-semibold active:scale-[0.98] transition-transform mt-2"
                  >
                    Confirm
                  </button>

                  <button
                    onClick={() => { setExtractedData(null); setUploadError(null); }}
                    className="w-full py-2.5 text-[13px] text-[#747878] active:opacity-50"
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
