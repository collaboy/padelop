"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LogSheet from "@/components/log-sheet";
import PushPrompt from "@/components/push-prompt";
import { computeScores, loadScoringData } from "@/lib/scoring";

const pad = (n: number) => String(n).padStart(2, "0");
const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

type DrillDef = { subtitle: string; court: string; solo: string };
const DRILL_LIBRARY: Record<string, DrillDef> = {
  "Serve":          { subtitle: "Serve consistency & placement",   court: "Hit 30 serves alternating cross-court and down-the-T. Focus on placement over power — 70% cross-court. Add spin variation in the final set.", solo: "Shadow your serve motion 20× each side. Practice the toss alone until it's consistent — contact point variability is the #1 cause of serve errors." },
  "Bandeja":        { subtitle: "Bandeja contact point & control", court: "Feed 20 bandejas from mid-court lobs. Focus on getting under the ball, closed racket face, and directing to back corners. Film your shoulder rotation.", solo: "Shadow the bandeja in slow motion — trophy position, shoulder turn, controlled wrist snap. 3 sets of 15 reps each side. Takes 10 minutes anywhere." },
  "Smash":          { subtitle: "Overhead timing & footwork",      court: "Alternate left/right overhead feeds, 30 reps. Prioritise feet set before contact. Work on vibora and k-smash variations once timing feels clean.", solo: "Jump and reach drill — 3 sets of 10. Time your jump so contact happens at maximum reach. Wall tosses help if you have space." },
  "Volleys":        { subtitle: "Compact volley technique",        court: "Stand 3m from the wall, volley continuously — 3 sets of 100. No backswing. Wrist locked, punch motion. Progress to alternating forehand/backhand.", solo: "Shadow volley drill — 3 sets of 20 each hand. Elbow up, racket face open, contact point in front. Can be done in any room." },
  "Defense":        { subtitle: "Defensive positioning & lobs",    court: "Partner smashes from net, you return high defensive lobs to back corners. Focus on reading the ball early and getting low before contact.", solo: "Lateral shuffle + split step — 5 sets of 30 seconds. Defensive positioning is 80% footwork. Quick direction change every 3 shuffles." },
  "Attack":         { subtitle: "Attacking patterns at net",       court: "Approach-and-finish patterns — feed to mid-court, move to net, volley to finish. Focus on angle and depth, not power.", solo: "Reaction time: drop a ball from shoulder height, catch before the second bounce. 3 sets of 15. Simulates quick hands at net." },
  "Positioning":    { subtitle: "Court coverage & positioning",    court: "Shadow movement without a ball — coach calls positions (net, mid, back) and you move to the T and recover. 5 sets of 90 seconds.", solo: "Eyes-closed visualisation — 5 min picturing court positions from your last match. Find 3 moments where better positioning changes the point." },
  "Communication":  { subtitle: "On-court communication habits",   court: "Call every ball in practice — 'mine', 'yours', 'leave'. Make it automatic under low pressure so it's instinct under high pressure.", solo: "Replay your last match mentally. Find 3 moments where a call or no-call cost a point. Rehearse what you would have said." },
  "Movement":       { subtitle: "Footwork & court coverage",       court: "Cone agility — 5 cones T-shape, 5 sets of lateral shuffle + sprint to net. Split step timing before every direction change.", solo: "Side-to-side shuffle + split step — 5 sets of 20 seconds. Any hallway works. Add a forward lunge at each end." },
  "Mental strength":{ subtitle: "Focus & pressure management",     court: "Pressure tiebreaks only — start every game at 6-6. Focus on your between-point routine: bounce, breathe, pick a target.", solo: "Box breathing + visualisation — 5 min. In 4, hold 4, out 4, hold 4. Then 3 min visualising winning points under pressure." },
};
const DEFAULT_DRILL: DrillDef = {
  subtitle: "General technical session",
  court: "General rally practice — focus on consistency over winners. Work on the shot you feel least confident about. 30 minutes of deliberate repetition beats 90 minutes of casual play.",
  solo: "20 min shadow footwork and stroke mechanics. Then 5 min visualising your strongest patterns and your next match.",
};

function getTopNeedsWorkTag(): string | null {
  try {
    const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
    const counts: Record<string, number> = {};
    for (const r of reviews) for (const tag of (r.improved ?? [])) counts[tag] = (counts[tag] ?? 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  } catch { return null; }
}

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

type ScheduleItem = { time: string; title: string; subtitle?: string; color: string; isDrill?: boolean };

function getScheduleData(dayType: "match" | "recovery" | "training", matchTime: string | null, drillTag: string | null): { schedule: ScheduleItem[]; currentIdx: number } {
  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 18;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "18:30";
  const drill = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
  const drillTitle = drillTag ? `${drillTag} Drill` : "Training Session";
  const rawSchedules: Record<string, Array<{ time: string; title: string; subtitle?: string; isDrill?: boolean }>> = {
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
    training: [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",          subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",     subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "11:00", title: drillTitle,           subtitle: drill.subtitle, isDrill: true },
      { time: "12:30", title: "Balanced lunch",     subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",    subtitle: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",             subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",      subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",          subtitle: "No screens, consistent bedtime" },
    ],
  };
  const schedule: ScheduleItem[] = rawSchedules[dayType].map(item => ({
    ...item,
    color: item.isDrill ? "#2653d4" : (ITEM_COLORS[item.title] ?? "#8a9096"),
  }));
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
  const [logTab, setLogTab] = useState<"checkin" | "matchreview" | null>(null);
  const [logWizard, setLogWizard] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchModalTab, setMatchModalTab] = useState<'pick' | 'manual'>('pick');
  const [matchForm, setMatchForm] = useState({ date: '', time: '', club: '', p1: '', p2: '', p3: '', p4: '' });
  const [matchActionOpen, setMatchActionOpen] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string; club?: string; players?: string[] } | null>(null);
  const [now, setNow] = useState(new Date());
  const [doIdx, setDoIdx] = useState(0); // -1 = top holder, 0 = do-this-now, 1 = see schedule
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [readiness, setReadiness] = useState(65);
  const [schedDetailOpen, setSchedDetailOpen] = useState<{ title: string; subtitle?: string; color: string; detail: string; isDrill?: boolean } | null>(null);
  const [postMatchOpen, setPostMatchOpen] = useState(false);
  const [postMatchDate, setPostMatchDate] = useState<string | null>(null);
  const [yesterdayWasMatch, setYesterdayWasMatch] = useState(false);
  const [drillTag, setDrillTag] = useState<string | null>(null);
  const [drillContext, setDrillContext] = useState<"court" | "solo">("court");

  const matchUploadRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeDirRef = useRef<'h' | 'v' | null>(null);
  const [cardSnap, setCardSnap] = useState<'none' | 'left' | 'right'>('none');
  const [liveX, setLiveX] = useState(0);
  const [liveY, setLiveY] = useState(0);

  useEffect(() => {
    function loadReadiness() {
      const d = loadScoringData();
      setReadiness(computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training).overall);
    }
    loadReadiness();
    window.addEventListener("storage", loadReadiness);
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) {
          const matchTs = new Date(`${m.date}T${m.time}`).getTime();
          if (matchTs > Date.now()) {
            setMatch({ date: m.date, time: m.time, club: m.club || undefined, players: [m.player_1, m.player_2, m.player_3, m.player_4].filter(Boolean) });
          } else {
            // Match has passed — check if it's been reviewed
            const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
            const alreadyReviewed = reviews.some((r: { ts?: string }) => r.ts?.slice(0, 10) === m.date);
            const dismissed = localStorage.getItem("padelop:post-match-dismissed") === m.date;
            if (!alreadyReviewed && !dismissed) {
              try { localStorage.setItem("padelop:post-match-dismissed", m.date); } catch {}
              setPostMatchDate(m.date);
              setPostMatchOpen(true);
            }
          }
        }
        const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        if (m.date === yesterday) setYesterdayWasMatch(true);
      }
    } catch {}
    // Also check match reviews for yesterday
    try {
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const rawReviews = localStorage.getItem("padelop:match-reviews");
      if (rawReviews) {
        const reviews = JSON.parse(rawReviews);
        if (reviews.some((r: { ts?: string }) => r.ts && r.ts.slice(0, 10) === yesterday)) {
          setYesterdayWasMatch(true);
        }
      }
    } catch {}
    setDrillTag(getTopNeedsWorkTag());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => { clearInterval(id); window.removeEventListener("storage", loadReadiness); };
  }, []);

  useEffect(() => { setCardSnap('none'); setLiveX(0); }, [doIdx]);

  // Detect when a loaded future match transitions to past while the app is open
  useEffect(() => {
    if (!match || postMatchOpen) return;
    const matchTs = new Date(`${match.date}T${match.time}`).getTime();
    if (matchTs >= now.getTime()) return;
    // Match just passed
    setMatch(null);
    try {
      const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
      const alreadyReviewed = reviews.some((r: { ts?: string }) => r.ts?.slice(0, 10) === match.date);
      const dismissed = localStorage.getItem("padelop:post-match-dismissed") === match.date;
      if (!alreadyReviewed && !dismissed) {
        try { localStorage.setItem("padelop:post-match-dismissed", match.date); } catch {}
        setPostMatchDate(match.date);
        setPostMatchOpen(true);
      }
    } catch {}
  }, [now]);

  const today = new Date().toISOString().slice(0, 10);
  const dayType: "match" | "recovery" | "training" = match?.date === today ? "match" : yesterdayWasMatch ? "recovery" : "training";
  const { schedule, currentIdx } = getScheduleData(dayType, match?.time ?? null, drillTag);
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
            height: "calc(100dvh - 4rem)", touchAction: doIdx >= 1 ? "pan-y" : "none",
            transform: cardSnap === 'right' ? `translateX(calc(33.333% - 50px + ${liveX}px))` : cardSnap === 'left' ? `translateX(calc(-33.333% + 50px + ${liveX}px))` : `translateX(${liveX}px)`,
            transition: liveX !== 0 ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
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
            if (swipeDirRef.current === 'h' && doIdx === 0) setLiveX(dx);
            if (swipeDirRef.current === 'v' && cardSnap === 'none' && doIdx < 1) setLiveY(dy);
          }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartXRef.current;
            const dy = e.changedTouches[0].clientY - touchStartYRef.current;
            if (swipeDirRef.current === 'h' && doIdx === 0) {
              setLiveX(0);
              if (cardSnap === 'none') {
                if (dx < -60) setCardSnap('left');
                else if (dx > 60) setCardSnap('right');
              } else if (cardSnap === 'left' && dx > 60) setCardSnap('none');
              else if (cardSnap === 'right' && dx < -60) setCardSnap('none');
            } else if (swipeDirRef.current === 'v' && cardSnap === 'none') {
              setLiveY(0);
              if (dy < -40 && doIdx < 1) goNext();
              else if (dy > 40) goPrev();
            }
            swipeDirRef.current = null;
          }}
        >
          {/* Log panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingRight: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, transform: `translateX(${cardSnap === 'right' ? 50 : 0}px) translateY(calc(45dvh - 4rem - 3 * (100vw - 40px) / 2 - 10px))`, transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
              {/* Placeholder above */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "white", opacity: 0 }} />
              {/* Main card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", background: "white", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px", marginRight: cardSnap === 'right' ? 0 : -40, opacity: cardSnap === 'right' ? 1 : 0, transition: "margin 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
                <p className="font-bold tracking-widest uppercase" style={{ color: "#9aa5b0", fontSize: "clamp(11px, 3vw, 14px)" }}>Log Data</p>
                <button onClick={() => { setLogWizard(false); setLogTab("checkin"); setLogSheetOpen(true); }} className="w-full py-3 rounded-2xl font-semibold" style={{ background: "#2653d418", color: "#2653d4", fontSize: "clamp(14px, 4vw, 18px)" }}>Daily check-in</button>
                <button onClick={() => { setLogWizard(true); setLogTab(null); setLogSheetOpen(true); }} className="w-full py-3 rounded-2xl font-semibold" style={{ background: "#f4f4f6", color: "#6b7480", fontSize: "clamp(13px, 3.5vw, 16px)" }}>More options</button>
              </div>
              {/* Placeholder below */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: 24, background: "white", opacity: 0 }} />
            </div>
          </div>

          {/* Carousel center — all schedule cards, doIdx in transform */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", paddingLeft: 10, paddingRight: 10, position: "relative", zIndex: 2 }}>
            <div style={{
              display: "flex", flexDirection: "column", gap: 10,
              transform: doIdx >= 1
                ? `translateY(calc(84px + 4rem - 2 * (100vw - 30px) - 95dvh))`
                : doIdx === -1
                  ? `translateY(calc(10px - (100vw - 30px) + ${liveY}px))`
                  : `translateY(calc(-50dvh - 150vw + 100px + ${liveY}px))`,
              transition: liveY !== 0 ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}>
              {/* Logo above top card */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.12 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 72, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1c1c", display: "flex", alignItems: "flex-end", gap: 1 }}>
                  {["p","a","d","l","a"].map((ch, i) => (
                    <span key={i} style={{ display: "inline-block", transform: `translateY(${(5 - i) * 1.5}px)` }}>{ch}</span>
                  ))}
                  <span style={{ display: "inline-block", width: "0.45em", height: "0.45em", borderRadius: "50%", background: "#22c55e", marginLeft: 4, marginBottom: 10 }} />
                </span>
              </div>

              {/* Card 0: next match */}
              <div style={{ width: "100%", flexShrink: 0, height: "calc(95dvh - 4rem - 60px)", borderRadius: 24, overflow: "hidden", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px", gap: 10, opacity: cardSnap === 'none' && doIdx === -1 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)", zIndex: doIdx === -1 ? 2 : 1, pointerEvents: doIdx === -1 ? "auto" : "none" }}>
                <p className="text-[13px] font-bold tracking-widest uppercase text-center" style={{ color: "#9aa5b0" }}>Next Match</p>
                {match ? (() => {
                  const [y, mo, d] = match.date.split('-').map(Number);
                  const dt = new Date(y, mo - 1, d);
                  const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <>
                      <button onClick={() => setMatchActionOpen(true)} className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity" style={{ background: "none", border: "none" }}>
                        <p className="font-bold text-[#1a1c1c] leading-tight text-center" style={{ fontSize: "clamp(28px, 8vw, 40px)" }}>{dateStr}</p>
                        <p className="font-semibold text-[#4a5050] leading-none text-center" style={{ fontSize: "clamp(20px, 5.5vw, 28px)" }}>{match.time}</p>
                        {match.club && <p className="text-[#6b7480] leading-none text-center" style={{ fontSize: "clamp(16px, 4.5vw, 22px)" }}>{match.club}</p>}
                        {match.players && match.players.length > 0 && <p className="text-[#9aa5b0] leading-snug text-center" style={{ fontSize: "clamp(14px, 4vw, 18px)" }}>{match.players.join(' · ')}</p>}
                      </button>
                      <div style={{ width: "100%", height: 1, background: "#f0f0f0", margin: "8px 0" }} />
                      <p className="font-bold tracking-widest uppercase text-center" style={{ color: "#9aa5b0", fontSize: "clamp(11px, 3vw, 14px)" }}>Match Readiness</p>
                      <p className="font-bold leading-none text-center" style={{ fontSize: "clamp(40px, 12vw, 56px)", color: "#2653d4" }}>{readiness}</p>
                      <button onClick={() => router.push("/insights4")} className="font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2653d418", color: "#2653d4", fontSize: "clamp(14px, 4vw, 18px)" }}>See Breakdown</button>
                    </>
                  );
                })() : (
                  <>
                    <p className="font-semibold text-[#9aa5b0] text-center" style={{ fontSize: "clamp(18px, 5vw, 24px)" }}>No match set</p>
                    <button onClick={() => { setMatchModalTab('pick'); setMatchModalOpen(true); }} className="mt-1 font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2653d418", color: "#2653d4", fontSize: "clamp(14px, 4vw, 18px)" }}>Add Match</button>
                  </>
                )}
              </div>

              {/* Card 1: do-this-now */}
              {(() => {
                const s = doItem;
                const isDone = completed.has(currentIdx);
                const isReady = curMins >= toMins(s.time);
                const nextSlide = schedule[currentIdx + 1];
                const secsUntilNext = nextSlide ? toMins(nextSlide.time) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) : 0;
                const fmtTime = (s: number) => { if (s <= 0) return "a moment"; const h = Math.floor(s / 3600), rem = s % 3600, m = Math.floor(rem / 60), sec = rem % 60; if (h > 0) return `${h}h ${m}m ${sec}s`; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };
                const cardStyle: React.CSSProperties = { width: "100%", flexShrink: 0, height: "calc(100vw - 40px)", borderRadius: "50%", overflow: "hidden", background: "#00D455", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", opacity: 1, zIndex: 3, boxShadow: "none" };
                const contentOpacity = doIdx === 0 ? 1 : 0.2;
                if (isDone) return (
                  <div key="active" className="animate-bounce-in" style={cardStyle} onClick={() => setDoModalOpen(true)}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: contentOpacity, transition: "opacity 0.25s" }}>
                      <p className="font-bold leading-none text-center" style={{ color: "#fff", fontSize: "clamp(26px, 8vw, 36px)" }}>Good Job!</p>
                      <p className="font-semibold mt-1 leading-none text-center" style={{ color: "#fff", fontSize: "clamp(15px, 4.8vw, 22px)" }}>{s.title} complete</p>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mt-3" style={{ background: "rgba(255,255,255,0.25)" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      {nextSlide && <div className="mt-4 text-center">
                        <p className="leading-none" style={{ color: "rgba(255,255,255,0.75)", fontSize: "clamp(12px, 3.7vw, 16px)" }}>see you in</p>
                        <p className="font-bold leading-none mt-1" style={{ color: "#fff", fontSize: "clamp(22px, 7vw, 32px)" }}>{fmtTime(secsUntilNext)}</p>
                        <p className="leading-none mt-1" style={{ color: "rgba(255,255,255,0.75)", fontSize: "clamp(12px, 3.7vw, 16px)" }}>for: <span className="font-semibold" style={{ color: "#fff" }}>{nextSlide.title}</span></p>
                      </div>}
                    </div>
                  </div>
                );
                return (
                  <div key="active" className="animate-bounce-in" style={cardStyle} onClick={() => setDoModalOpen(true)}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: contentOpacity, transition: "opacity 0.25s" }}>
                      <p className="animate-text-glow text-[14px] font-bold tracking-widest uppercase leading-none" style={{ color: "#fff" }}>NOW</p>
                      <p className="leading-none mb-2" style={{ color: "rgba(255,255,255,0.65)", fontSize: "clamp(13px, 3.8vw, 17px)" }}>{s.time} – {nextSlide ? nextSlide.time : "end"}</p>
                      <p className="font-bold leading-tight text-center" style={{ color: "#fff", fontSize: "clamp(24px, 7.5vw, 34px)" }}>{s.title}</p>
                      {s.subtitle && <p className="leading-none text-center mt-0.5" style={{ color: "rgba(255,255,255,0.8)", fontSize: "clamp(15px, 4.8vw, 22px)" }}>{s.subtitle.split(", ").join(" · ")}</p>}
                      <button onClick={e => { e.stopPropagation(); setDoModalOpen(true); }} className="mt-3 font-semibold px-5 py-2 rounded-full" style={{ background: "#fff", color: isReady ? s.color : "#b0b5ba", fontSize: "clamp(13px, 4vw, 18px)" }}>Guide me</button>
                    </div>
                  </div>
                );
              })()}

              {/* Card 2: today's schedule */}
              {(() => {
                const curMinsSched = now.getHours() * 60 + now.getMinutes();
                return (
                  <div key="sched" style={{ width: "100%", flexShrink: 0, borderRadius: 24, background: "white", display: "flex", flexDirection: "column", opacity: cardSnap === 'none' && doIdx === 1 ? 1 : 0, transition: "opacity 0s cubic-bezier(0.4,0,0.2,1)", zIndex: doIdx === 1 ? 2 : 1, height: "calc(100dvh - 4rem - 44px)", overflow: "hidden", pointerEvents: doIdx === 1 ? "auto" : "none" }}>
                    <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9aa5b0", margin: 0 }}>Today</p>
                    </div>
                    <div style={{ height: 1, background: "#dfe3e7", margin: "12px 0 0", flexShrink: 0 }} />
                    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                      <div style={{ padding: "16px 20px 28px" }}>
                        {schedule.map((item, idx, arr) => {
                          const isLast = idx === arr.length - 1;
                          const blockMins = toMins(item.time);
                          const nextMins = !isLast ? toMins(arr[idx + 1].time) : 24 * 60;
                          const isCurrentSegment = !isLast && curMinsSched >= blockMins && curMinsSched < nextMins;
                          const segmentPct = isCurrentSegment ? ((curMinsSched - blockMins) / (nextMins - blockMins)) * 100 : 0;
                          const isCur = idx === currentIdx;
                          const isPast = !isCur && curMinsSched > toMins(item.time);
                          const detail = SCHEDULE_DETAILS[item.title];
                          const clickable = !!(detail || item.isDrill);
                          return (
                            <div key={idx} style={{ display: "flex", gap: 14 }}>
                              <div style={{ width: 56, flexShrink: 0, paddingTop: 3 }}>
                                <p style={{ fontSize: 15, fontWeight: 700, color: "#6b7480", textAlign: "right", lineHeight: 1, margin: 0 }}>{item.time}</p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 4, flexShrink: 0, background: isPast ? "#d0d3d6" : item.color }} />
                                {!isLast && (
                                  <div style={{ position: "relative", width: 2, flex: 1, background: "#dfe3e7", minHeight: 36, overflow: "visible" }}>
                                    {isCurrentSegment && (
                                      <div style={{ position: "absolute", display: "flex", alignItems: "center", top: `${segmentPct}%`, right: 0, transform: "translateY(-50%)" }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", padding: "3px 9px", borderRadius: 4, marginRight: 2, whiteSpace: "nowrap", background: "#2653d4" }}>
                                          {pad(now.getHours())}:{pad(now.getMinutes())}
                                        </span>
                                        <svg width="6" height="8" viewBox="0 0 6 8"><polygon points="0,0 6,4 0,8" fill="#171c1f" /></svg>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, textAlign: "left", background: "none", border: "none", cursor: clickable ? "pointer" : "default", padding: "0 0 24px" }}
                                onClick={() => {
                                  if (item.isDrill) {
                                    setSchedDetailOpen({ title: item.title, subtitle: item.subtitle, color: item.color, detail: "", isDrill: true });
                                  } else if (detail) {
                                    setSchedDetailOpen({ title: item.title, subtitle: item.subtitle, color: item.color, detail });
                                  }
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 21, fontWeight: isCur ? 700 : 500, color: isPast ? "#a0a5aa" : "#1a1c1c", margin: 0, lineHeight: 1.25 }}>{item.title}</p>
                                  {item.subtitle && <p style={{ fontSize: 16, color: "#6b7480", margin: "4px 0 0", lineHeight: 1.4 }}>{item.subtitle}</p>}
                                </div>
                                {clickable && (
                                  <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="#dfe3e7" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 5 }}>
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
                );
              })()}
            </div>
          </div>

          {/* Readiness panel */}
          <div style={{ width: "33.333%", flexShrink: 0, height: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingLeft: 20, paddingTop: "calc(45dvh - 4rem - (100vw - 40px) / 2)" }}>
            <div style={{ width: "100%", height: "calc(100vw - 40px)", background: "white", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 24px", marginLeft: cardSnap === 'left' ? 0 : -40, opacity: cardSnap === 'left' ? 1 : 0, transform: `translateX(${cardSnap === 'left' ? -50 : 0}px)`, transition: "margin 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
              <p className="font-bold tracking-widest uppercase" style={{ color: "#9aa5b0", fontSize: "clamp(11px, 3vw, 14px)" }}>Match Readiness</p>
              <svg width="140" height="140" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#2653d4" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - readiness / 100)}`}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="700" fill="#1a1c1c" fontFamily="Inter, sans-serif">{readiness}</text>
              </svg>
              <button onClick={() => router.push("/insights4")} className="font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2653d418", color: "#2653d4", fontSize: "clamp(13px, 3.5vw, 17px)" }}>See Breakdown</button>
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
              {doItem.isDrill ? (
                <div className="px-6 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a9096] mb-3">Where are you today?</p>
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => setDrillContext("court")} className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors" style={{ background: drillContext === "court" ? "#2653d4" : "#f4f4f6", color: drillContext === "court" ? "#fff" : "#4a5050" }}>Court</button>
                    <button onClick={() => setDrillContext("solo")} className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-colors" style={{ background: drillContext === "solo" ? "#2653d4" : "#f4f4f6", color: drillContext === "solo" ? "#fff" : "#4a5050" }}>Anywhere</button>
                  </div>
                  <p className="text-[15px] text-[#2c3235] leading-relaxed">
                    {drillContext === "court" ? (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).court : (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).solo}
                  </p>
                </div>
              ) : SCHEDULE_DETAILS[doItem.title] && (
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

        <LogSheet open={logSheetOpen} onClose={() => { setLogSheetOpen(false); setLogTab(null); setLogWizard(false); }} defaultSub={logTab} startWizard={logWizard} />
        <PushPrompt />

        {/* Post-match prompt */}
        {postMatchOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setPostMatchOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ background: "#f0fdf4" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8M12 17v4"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.3-2.7 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
                  </svg>
                </div>
                <p className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Great game!</p>
                {postMatchDate && (
                  <p className="text-[14px] text-[#6b7480]">
                    {new Date(postMatchDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                  </p>
                )}
                <p className="text-[15px] text-[#4a5050] mt-1 leading-snug">Rate your match while it&apos;s fresh — it only takes a minute.</p>
              </div>
              <div className="px-6 pb-8 flex flex-col gap-3">
                <button
                  onClick={() => { setPostMatchOpen(false); setLogTab("matchreview"); setLogSheetOpen(true); }}
                  className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                  style={{ background: "#2653d4" }}
                >
                  Rate my match
                </button>
                <button onClick={() => { try { localStorage.setItem("padelop:post-match-dismissed", postMatchDate ?? ""); } catch {} setPostMatchOpen(false); }} className="w-full py-3 text-[14px] font-semibold text-[#6b7480]">
                  I&apos;ll do it later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Match action sheet */}
        {matchActionOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" onClick={() => setMatchActionOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[24px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setMatchActionOpen(false); setMatchModalTab('pick'); setMatchModalOpen(true); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f4f6ff] transition-colors" style={{ borderBottom: "1px solid #f0f0f0" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d418" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c]">Edit match</span>
              </button>
              <button onClick={() => { setMatchActionOpen(false); router.push("/matches4"); }} className="w-full flex items-center gap-4 px-5 py-4 active:bg-[#f9f9f9] transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f4f4f6" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </div>
                <span className="text-[15px] font-semibold text-[#1a1c1c]">See all matches</span>
              </button>
            </div>
          </div>
        )}

        {/* Add / Edit Match modal */}
        {matchModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-[#f0f0f0]">
                <div>
                  <p className="text-[18px] font-bold text-[#1a1c1c]">{match ? "Edit Match" : "Add Match"}</p>
                  <p className="text-[13px] text-[#6b7480] mt-0.5">Upload a screenshot or enter manually</p>
                </div>
                <button onClick={() => { setMatchModalOpen(false); setMatchModalTab('pick'); }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#f4f4f6" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {matchModalTab === 'pick' && (
                <div className="px-6 py-6 flex flex-col gap-3">
                  <button
                    onClick={() => matchUploadRef.current?.click()}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:opacity-70 transition-opacity"
                    style={{ background: "#f4f6ff", border: "1.5px solid #2653d418" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d4" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">Upload screenshot</p>
                      <p className="text-[12px] text-[#6b7480] mt-0.5">From your camera roll or files</p>
                    </div>
                  </button>
                  <input ref={matchUploadRef} type="file" accept="image/*" className="hidden" onChange={() => { setMatchModalTab('manual'); }} />

                  <button
                    onClick={() => { setMatchForm({ date: match?.date ?? '', time: match?.time ?? '', club: match?.club ?? '', p1: match?.players?.[0] ?? '', p2: match?.players?.[1] ?? '', p3: match?.players?.[2] ?? '', p4: match?.players?.[3] ?? '' }); setMatchModalTab('manual'); }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:opacity-70 transition-opacity"
                    style={{ background: "#f9f9f9", border: "1.5px solid #f0f0f0" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1a1c1c" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="13" y2="18"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">Enter manually</p>
                      <p className="text-[12px] text-[#6b7480] mt-0.5">Date, time, club and players</p>
                    </div>
                  </button>
                </div>
              )}

              {matchModalTab === 'manual' && (
                <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Date</label>
                      <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[14px] font-medium text-[#1a1c1c] outline-none"
                        style={{ borderColor: matchForm.date ? "#2653d4" : "#e2e2e2", background: matchForm.date ? "#f4f6ff" : "#f9f9f9" }} />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Time</label>
                      <input type="time" value={matchForm.time} onChange={e => setMatchForm(f => ({ ...f, time: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[14px] font-medium text-[#1a1c1c] outline-none"
                        style={{ borderColor: matchForm.time ? "#2653d4" : "#e2e2e2", background: matchForm.time ? "#f4f6ff" : "#f9f9f9" }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Club</label>
                    <input type="text" placeholder="e.g. Club Padel BCN" value={matchForm.club} onChange={e => setMatchForm(f => ({ ...f, club: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-[14px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]"
                      style={{ borderColor: matchForm.club ? "#2653d4" : "#e2e2e2", background: matchForm.club ? "#f4f6ff" : "#f9f9f9" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[#6b7480]">Players</label>
                    {(['p1','p2','p3','p4'] as const).map((key, i) => (
                      <input key={key} type="text" placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} value={matchForm[key]} onChange={e => setMatchForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border text-[14px] text-[#1a1c1c] outline-none placeholder:text-[#b0b5ba]"
                        style={{ borderColor: matchForm[key] ? "#2653d4" : "#e2e2e2", background: matchForm[key] ? "#f4f6ff" : "#f9f9f9" }} />
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (!matchForm.date || !matchForm.time) return;
                      const data = { date: matchForm.date, time: matchForm.time, club: matchForm.club, player_1: matchForm.p1, player_2: matchForm.p2, player_3: matchForm.p3, player_4: matchForm.p4 };
                      try { localStorage.setItem("padelop:next-match", JSON.stringify(data)); window.dispatchEvent(new Event("storage")); } catch {}
                      setMatch({ date: matchForm.date, time: matchForm.time, club: matchForm.club || undefined, players: [matchForm.p1, matchForm.p2, matchForm.p3, matchForm.p4].filter(Boolean) });
                      setMatchModalOpen(false);
                      setMatchModalTab('pick');
                    }}
                    className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
                    style={{ background: matchForm.date && matchForm.time ? "#2653d4" : "#d0d3d6" }}
                  >Save Match</button>
                  <button onClick={() => setMatchModalTab('pick')} className="w-full py-2 text-[13px] font-semibold text-[#6b7480]">← Back</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule detail modal */}
        {schedDetailOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.5)" }} onClick={() => setSchedDetailOpen(null)}>
            <div style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 24, padding: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${schedDetailOpen.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: schedDetailOpen.color }} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#1a1c1c", margin: "0 0 4px" }}>{schedDetailOpen.title}</p>
              {schedDetailOpen.subtitle && <p style={{ fontSize: 13, color: "#6b7480", margin: "0 0 12px" }}>{schedDetailOpen.subtitle}</p>}
              <div style={{ height: 1, background: "#dfe3e7", margin: "12px 0" }} />
              {schedDetailOpen.isDrill ? (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8a9096", margin: "0 0 10px" }}>Where are you today?</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => setDrillContext("court")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", background: drillContext === "court" ? "#2653d4" : "#f4f4f6", color: drillContext === "court" ? "#fff" : "#4a5050" }}>Court</button>
                    <button onClick={() => setDrillContext("solo")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", background: drillContext === "solo" ? "#2653d4" : "#f4f4f6", color: drillContext === "solo" ? "#fff" : "#4a5050" }}>Anywhere</button>
                  </div>
                  <p style={{ fontSize: 14, color: "#3a4550", lineHeight: 1.6, margin: 0 }}>
                    {drillContext === "court" ? (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).court : (DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL).solo}
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "#3a4550", lineHeight: 1.6, margin: 0 }}>{schedDetailOpen.detail}</p>
              )}
              <button onClick={() => setSchedDetailOpen(null)} style={{ marginTop: 20, width: "100%", padding: "12px 0", borderRadius: 50, background: "#f4f4f6", border: "none", fontSize: 15, fontWeight: 600, color: "#1a1c1c", cursor: "pointer" }}>Done</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
