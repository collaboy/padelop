"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { saveCheckIn, computeScores, loadScoringData } from "@/lib/scoring";
import { downloadSnapshot, importData } from "@/lib/storage";
import { saveMatchReview, saveCheckInToDb, saveHydrationToDb, seedHydrationToDb, saveNutritionToDb, saveTrainingToDb, saveScheduleDoneToDb } from "@/lib/db";
import { startNavLoad } from "@/lib/nav-events";

function rangeToMl(range: string): number {
  if (range === "<1L")    return 750;
  if (range === "1–1.5L") return 1250;
  if (range === "1.5–2L") return 1750;
  if (range === "2–2.5L") return 2250;
  if (range === "2.5–3L") return 2750;
  return 3000;
}

const NAV_ITEMS = [
  { href: "/home4",     label: "Home",      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { href: "/today4",    label: "Today",     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg> },
  { href: "/home-v1",   label: "Readiness", icon: null },
  { href: "/track4",    label: "Track",     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { href: "/matches4",  label: "Matches",   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { href: "/insights4", label: "Insights",  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
];

type Sub = "recovery" | "wellbeing" | "checkin" | "hydration" | "nutrition" | "training" | "matchlist" | "matchreview" | null;

interface Props {
  open: boolean;
  onClose: () => void;
  defaultSub?: Sub;
  startWizard?: boolean;
  previewMode?: boolean;
}

const PURPLE = "var(--c-purple)";
const AMBER  = "var(--c-amber)";
const BLUE   = "var(--c-blue)";

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-sub)" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function Face({ v, sel, color }: { v: string; sel: boolean; color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sel ? color : "var(--c-text-sub)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      {v === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5"/>}
      {v === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5"/>}
      {v === "great" && <path d="M8 14c1 2 6 2 8 0"/>}
      <circle cx="9" cy="9.5" r="0.8" fill={sel ? color : "var(--c-text-sub)"} stroke="none"/>
      <circle cx="15" cy="9.5" r="0.8" fill={sel ? color : "var(--c-text-sub)"} stroke="none"/>
    </svg>
  );
}

export default function LogSheet({ open, onClose, defaultSub, startWizard, previewMode }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [importDone, setImportDone] = useState(false);
  const [sub, setSub] = useState<Sub>(null);

  React.useEffect(() => {
    if (open) {
      setSub(defaultSub ?? null);
      setLogMethod(startWizard ? "wizard" : null);
      setMorningStep(0);
      setMorningData({});
      setNightStep(0);
      setNightData({});
      setNightHabits([]);
      try {
        const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
        const today = new Date().toISOString().slice(0, 10);
        setNightQuickMl(hq?.date === today ? (hq.ml ?? 0) : 0);
      } catch { setNightQuickMl(0); }
    } else {
      setSub(null);
      setLogMethod(null);
    }
  }, [open]);
  const [logMethod, setLogMethod] = useState<"wizard" | null>(null);

  const [checkIn, setCheckIn] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3, stress: 3, motivation: 3 });
  const [recoveryCI, setRecoveryCI] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });
  const [wellbeingCI, setWellbeingCI] = useState({ stress: 3, motivation: 3 });
  const [trainingLog, setTrainingLog] = useState({ sessionType: [] as string[], drillFocus: [] as string[], duration: "", intensity: "" });
  const [hydrationLog, setHydrationLog] = useState({ litres: "", timing: [] as string[], quality: "", urine: "" });
  const [nutritionLog, setNutritionLog] = useState({ proteinRating: "", foods: [] as string[], postMatch: "", quality: "" });
  const [matchReview, setMatchReview] = useState({ feeling: "", result: "", opponent: "", opponentNames: "", energy: "", injury: "", wellDone: [] as string[], improved: [] as string[], mentalBefore: "", mentalDuring: "", mentalAfter: "", warmup: "", notes: "" });
  const [matchResultImage, setMatchResultImage] = useState<string | null>(null);

  const [morningStep, setMorningStep] = useState(0);
  const [morningData, setMorningData] = useState<Record<string, string | number>>({});
  const [nightStep, setNightStep] = useState(0);
  const [nightData, setNightData] = useState<Record<string, string | number>>({});
  const [nightHabits, setNightHabits] = useState<string[]>([]);
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [nightQuickMl, setNightQuickMl] = useState(0);

  const todayYMD = new Date().toISOString().slice(0, 10);

  function afterSave() {
    window.dispatchEvent(new Event("storage"));
    onClose();
    setSub(null);
    setLogMethod(null);
  }

  function handleClose() {
    onClose();
    setSub(null);
    setLogMethod(null);
  }

  function handleCamera() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.click();
    handleClose();
  }

  if (!open) return null;

  // ── Sub-modals ──────────────────────────────────────────────────────────

  function savePartialCheckIn(partial: Partial<Omit<import("@/lib/scoring").DailyCheckIn, "date">>) {
    let base = { sleep: 3, energy: 3, soreness: 3, hydration: 3, stress: 3, motivation: 3 };
    try {
      const raw = localStorage.getItem("padelop:daily-checkin");
      if (raw) { const p = JSON.parse(raw); base = { sleep: p.sleep ?? 3, energy: p.energy ?? 3, soreness: p.soreness ?? 3, hydration: p.hydration ?? 3, stress: p.stress ?? 3, motivation: p.motivation ?? 3 }; }
    } catch {}
    saveCheckIn({ ...base, ...partial });
  }

  if (sub === "recovery") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-4" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full max-w-lg bg-white r-xl overflow-hidden shadow-modal" style={{ animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }} onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 rounded-full bg-c-line mx-auto mt-4 mb-1"/>
          <div className="px-6 pt-3 pb-4 flex items-center justify-between">
            <div><p className="t-title text-c-text">Recovery Check-in</p><p className="t-body-sm text-c-text-sub mt-0.5">How is your body feeling today?</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            {([
              { key: "sleep",    label: "Sleep quality",   lo: "Poor",       hi: "Excellent" },
              { key: "energy",   label: "Energy level",    lo: "Exhausted",  hi: "Energised" },
              { key: "soreness", label: "Muscle soreness", lo: "Very sore",  hi: "No soreness" },
              { key: "hydration",label: "Hydration",       lo: "Dehydrated", hi: "Well hydrated" },
            ] as { key: keyof typeof recoveryCI; label: string; lo: string; hi: string }[]).map(({ key, label, lo, hi }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <p className="t-body-sm font-semibold text-c-text">{label}</p>
                  <span className="text-[13px] font-bold" style={{ color: PURPLE }}>{recoveryCI[key]}/5</span>
                </div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(v => {
                    const sel = recoveryCI[key] === v;
                    return (
                      <button key={v} onClick={() => setRecoveryCI(c => ({ ...c, [key]: v }))}
                        className="flex-1 py-2.5 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? PURPLE : "var(--c-line)", background: sel ? "#f5f3ff" : "var(--c-bg-input)", color: sel ? PURPLE : "var(--c-text-sub)" }}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-c-label">{lo}</span>
                  <span className="text-[10px] text-c-label">{hi}</span>
                </div>
              </div>
            ))}
            <button onClick={() => {
                savePartialCheckIn(recoveryCI);
                saveCheckInToDb({ date: new Date().toISOString().slice(0, 10), sleep: recoveryCI.sleep, energy: recoveryCI.energy, hydration: recoveryCI.hydration });
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl t-ui text-white active:scale-[0.98] transition-transform"
              style={{ background: PURPLE }}>
              Save Recovery
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "wellbeing") {
    const NIGHT_STEPS = [
      { key: "stress",           type: "scale", question: "Stress level today?",          lo: "Very stressed", hi: "No stress" },
      { key: "nutritionQuality", type: "face",  question: "How well did you eat?",         opts: [["bad","Poorly"],["ok","OK"],["great","Well"]] as [string,string][] },
      { key: "hydrationLitres",  type: "opts",  question: "How much did you drink today?", opts: ["<1L","1–1.5L","1.5–2L","2–2.5L","2.5–3L","3L+"] },
      { key: "urineColour",      type: "urine", question: "Urine colour?",
        opts: [
          { v: "clear",  label: "Clear",  bg: "#f0f9ff" },
          { v: "pale",   label: "Pale",   bg: "#fefce8" },
          { v: "yellow", label: "Yellow", bg: "#fef9c3" },
          { v: "dark",   label: "Dark",   bg: "#fef3c7" },
          { v: "brown",  label: "Brown",  bg: "#fdf4dc" },
        ]
      },
      { key: "habits", type: "habits", question: "Which habits did you do today?" },
      { key: "hydrationQuick", type: "hydration-quick", question: "Update your water intake?" },
      { key: "bedtime", type: "opts", question: "Bedtime tonight?", opts: ["9pm","10pm","10:30pm","11pm","After 11"] },
    ] as const;
    const totalNightSteps = NIGHT_STEPS.length;
    const nightStepDef = NIGHT_STEPS[nightStep];

    function nightPick(key: string, val: string | number, autoAdvance = true) {
      const next = { ...nightData, [key]: val };
      setNightData(next);
      if (autoAdvance && nightStep < totalNightSteps - 1) {
        setTimeout(() => setNightStep(s => s + 1), 180);
      } else if (!autoAdvance) {
        // habits step — don't advance yet
      } else {
        // last step: bedtime
        saveBedtime(val as string, next);
      }
    }

    function nightAdvance() {
      // called by Done button on habits step
      if (nightStep < totalNightSteps - 1) {
        setNightStep(s => s + 1);
      }
    }

    function saveBedtime(bedtime: string, next: Record<string, string | number>) {
      try {
        savePartialCheckIn({ stress: Number(next.stress) || 3 });

        const ts = new Date().toISOString();
        const protein = String(next.protein ?? "");
        const nutritionQuality = String(next.nutritionQuality ?? "ok");
        const hydrationLitres = String(next.hydrationLitres ?? "");
        const urineColour = String(next.urineColour ?? "");

        const nutritionEntry = {
          ts,
          proteinRating: protein === "yes" ? "high" : protein === "no" ? "low" : "mid",
          quality: nutritionQuality,
          foods: [] as string[],
          postMatch: "no",
        };
        const prevNutrition = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]");
        localStorage.setItem("padelop:nutrition-logs", JSON.stringify([nutritionEntry, ...prevNutrition].slice(0, 50)));

        const hydrationEntry = { ts, litres: hydrationLitres, urine: urineColour, quality: "ok", timing: [] as string[] };
        const prevHydration = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
        localStorage.setItem("padelop:hydration-logs", JSON.stringify([hydrationEntry, ...prevHydration].slice(0, 50)));
        if (hydrationLitres) saveHydrationToDb(todayYMD, rangeToMl(hydrationLitres));

        const earlyBed = ["9pm","10pm","10:30pm"].includes(bedtime);
        const habitsEntry = {
          date: todayYMD,
          sleep: earlyBed,
          mobility: nightHabits.includes("Mobility"),
          visualise: nightHabits.includes("Visualise"),
          boxBreathing: nightHabits.includes("Box breathing"),
          foamRoll: nightHabits.includes("Foam roll"),
          lightWalk: nightHabits.includes("Light walk"),
          coldShower: nightHabits.includes("Cold shower"),
        };
        const prevHabits = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
        localStorage.setItem("padelop:habits", JSON.stringify([habitsEntry, ...prevHabits].slice(0, 50)));
      } catch {}
      afterSave();
    }

    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={handleClose}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full max-w-lg bg-white r-t-xl shadow-modal"
          style={{ minHeight: "82dvh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
          onClick={e => e.stopPropagation()}>
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-c-line mx-auto mt-4"/>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <button
              onClick={() => { if (nightStep === 0) handleClose(); else setNightStep(s => s - 1); }}
              className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-sub)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            {/* Progress */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[12px] font-bold" style={{ color: PURPLE }}>{nightStep + 1} of {NIGHT_STEPS.length}</span>
              <div className="flex items-center gap-1">
                {NIGHT_STEPS.map((_, i) => (
                  <div key={i} style={{ width: i === nightStep ? 16 : 4, height: 4, borderRadius: "var(--r-pill)", background: i <= nightStep ? PURPLE : "var(--c-line)", transition: "all 0.25s" }}/>
                ))}
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          {/* Label */}
          <p className="t-label text-center text-c-hint mt-1">Night Check-in</p>
          {/* Question */}
          <p className="text-center font-bold text-c-text px-6 pt-8 pb-7" style={{ fontSize: "clamp(22px, 6vw, 28px)" }}>
            {nightStepDef.question}
          </p>
          {/* Answers */}
          <div className="px-5 pb-10">
            {nightStepDef.type === "scale" && (
              <div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(v => {
                    const sel = nightData[nightStepDef.key] === v;
                    return (
                      <button key={v} onClick={() => nightPick(nightStepDef.key, v)}
                        className="flex-1 rounded-2xl text-[20px] font-bold transition-all active:scale-95"
                        style={{ height: 48, background: sel ? PURPLE : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                {"lo" in nightStepDef && (
                  <div className="flex justify-between mt-2">
                    <span className="text-[11px] text-c-label">{nightStepDef.lo}</span>
                    <span className="text-[11px] text-c-label">{nightStepDef.hi}</span>
                  </div>
                )}
              </div>
            )}
            {nightStepDef.type === "face" && "opts" in nightStepDef && (
              <div className="flex gap-3">
                {(nightStepDef.opts as [string,string][]).map(([v, label]) => {
                  const sel = nightData[nightStepDef.key] === v;
                  return (
                    <button key={v} onClick={() => nightPick(nightStepDef.key, v)}
                      className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? PURPLE : "var(--c-line)", background: sel ? "#f5f3ff" : "var(--c-bg-input)" }}>
                      <Face v={v} sel={sel} color={PURPLE}/>
                      <span className="text-[13px] font-bold" style={{ color: sel ? PURPLE : "var(--c-text-sub)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {nightStepDef.type === "opts" && "opts" in nightStepDef && (
              <div className="flex flex-wrap gap-2">
                {(nightStepDef.opts as unknown as string[]).map((o: string) => {
                  const sel = nightData[nightStepDef.key] === o;
                  return (
                    <button key={o} onClick={() => {
                      const nextData = { ...nightData, [nightStepDef.key]: o };
                      setNightData(nextData);
                      if (nightStep < totalNightSteps - 1) {
                        setTimeout(() => setNightStep(s => s + 1), 180);
                      } else {
                        saveBedtime(o, nextData);
                      }
                    }}
                      className="rounded-2xl text-[16px] font-bold transition-all active:scale-95 px-5"
                      style={{ height: 48, background: sel ? PURPLE : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
            {nightStepDef.type === "urine" && "opts" in nightStepDef && (
              <div className="flex gap-2">
                {(nightStepDef.opts as unknown as { v: string; label: string; bg: string }[]).map(({ v, label, bg }) => {
                  const sel = nightData[nightStepDef.key] === v;
                  return (
                    <button key={v} onClick={() => nightPick(nightStepDef.key, v)}
                      className="flex-1 rounded-2xl text-[11px] font-bold transition-all active:scale-95 text-center"
                      style={{ height: 48, background: sel ? bg : "var(--c-bg)", color: "var(--c-text-sub)", border: sel ? "2px solid #d1d5db" : "2px solid transparent" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {nightStepDef.type === "habits" && (
              <div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {["Foam roll","Cold shower","Mobility","Box breathing","Light walk","Visualise"].map(habit => {
                    const sel = nightHabits.includes(habit);
                    return (
                      <button key={habit} onClick={() => setNightHabits(h => sel ? h.filter(x => x !== habit) : [...h, habit])}
                        className="flex items-center gap-2 px-4 rounded-2xl text-[14px] font-bold transition-all active:scale-95"
                        style={{ height: 48, background: sel ? PURPLE : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                        {sel && <span>✓</span>}
                        {habit}
                      </button>
                    );
                  })}
                </div>
                <button onClick={nightAdvance}
                  className="w-full rounded-2xl text-white text-[16px] font-bold transition-all active:scale-95"
                  style={{ height: 52, background: PURPLE }}>
                  Done →
                </button>
              </div>
            )}
            {nightStepDef.type === "hydration-quick" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                {/* ml display */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <p style={{ fontSize: "clamp(48px,15vw,64px)", fontWeight: 800, color: "#3b9eff", margin: 0, lineHeight: 1, letterSpacing: "-0.03em" }}>
                    {nightQuickMl >= 1000 ? `${+(nightQuickMl / 1000).toFixed(1)}L` : `${nightQuickMl}ml`}
                  </p>
                  <p className="t-body-sm" style={{ color: "var(--c-hint)", margin: 0 }}>of 3L goal · {Math.min(100, Math.round(nightQuickMl / 3000 * 100))}%</p>
                </div>
                {/* +/− buttons */}
                <div style={{ display: "flex", gap: "16px" }}>
                  <button
                    onClick={() => setNightQuickMl(m => Math.max(0, m - 250))}
                    style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: "var(--c-bg)", fontSize: 28, fontWeight: 700, color: "var(--c-text)", cursor: "pointer" }}>−</button>
                  <button
                    onClick={() => setNightQuickMl(m => Math.min(5000, m + 250))}
                    style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: "#3b9eff", fontSize: 28, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+</button>
                </div>
                <p className="t-caption" style={{ color: "#b0b8c1", margin: 0 }}>Each tap = 250ml</p>
                {/* Done */}
                <button
                  onClick={() => {
                    try {
                      const today = new Date().toISOString().slice(0, 10);
                      localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: today, ml: nightQuickMl }));
                      // Sync to hydration-logs so scoring engine picks it up
                      const ml = nightQuickMl;
                      const litres =
                        ml < 1000  ? "<1L"    :
                        ml < 1500  ? "1–1.5L" :
                        ml < 2000  ? "1.5–2L" :
                        ml < 2500  ? "2–2.5L" :
                        ml < 3000  ? "2.5–3L" : "3L+";
                      const quality = ml >= 2500 ? "great" : ml >= 1500 ? "ok" : "bad";
                      const entry = { ts: new Date().toISOString(), litres, quality, urine: "", timing: [] };
                      const prev: typeof entry[] = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
                      const todayIdx = prev.findIndex(e => e.ts.slice(0, 10) === today);
                      if (todayIdx >= 0) prev[todayIdx] = entry; else prev.unshift(entry);
                      localStorage.setItem("padelop:hydration-logs", JSON.stringify(prev.slice(0, 50)));
                      saveHydrationToDb(today, nightQuickMl);
                      window.dispatchEvent(new Event("storage"));
                    } catch {}
                    nightAdvance();
                  }}
                  className="w-full rounded-2xl text-white text-[16px] font-bold transition-all active:scale-95"
                  style={{ height: 52, background: PURPLE }}>
                  Save & continue →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sub === "checkin") {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const hasYesterdayHabits = (() => {
      try { const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}"); return (sd[yesterday] ?? []).length > 0; } catch { return false; }
    })();
    const hasYesterdayWater = (() => {
      try {
        const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
        if (hq?.date === yesterday && hq.ml > 0) return true;
        const logs: { ts?: string }[] = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
        return logs.some(l => l.ts?.startsWith(yesterday));
      } catch { return false; }
    })();

    type CStep =
      | { key: string; section: "night" | "morning"; type: "scale"; question: string; lo: string; hi: string }
      | { key: string; section: "night" | "morning"; type: "opts";  question: string; opts: string[] }
      | { key: string; section: "night" | "morning"; type: "face";  question: string; opts: [string,string][] }
      | { key: string; section: "night" | "morning"; type: "opts3"; question: string; opts: [string,string][] }
      | { key: string; section: "night" | "morning"; type: "habits"; question: string }
      | { key: string; section: "night" | "morning"; type: "yesno"; question: string }
      | { key: string; section: "morning"; type: "painArea"; question: string }
      | { key: string; section: "morning"; type: "complete"; question: string };

    const COMBINED_STEPS: CStep[] = [
      { key: "bedtime",          section: "night",   type: "opts",  question: "When did you go to bed last night?",  opts: ["9pm","10pm","10:30pm","11pm","After 11"] },
      { key: "sleep",            section: "night",   type: "scale", question: "How did you sleep last night?",        lo: "Poorly",       hi: "Excellent"  },
      { key: "sleepHours",       section: "night",   type: "opts",  question: "How many hours of sleep?",             opts: ["≤5h","6h","7h","8h","9h+"]            },
      { key: "stress",           section: "night",   type: "scale", question: "Stress level yesterday?",              lo: "Very stressed", hi: "No stress"  },
      { key: "nutritionQuality", section: "night",   type: "face",  question: "How well did you eat yesterday?",      opts: [["bad","Poorly"],["ok","OK"],["great","Well"]] },
      ...(hasYesterdayWater ? [] : [{ key: "hydrationLitres", section: "night" as const, type: "opts" as const, question: "How much did you drink yesterday?", opts: ["<1L","1–1.5L","1.5–2L","2–2.5L","2.5–3L","3L+"] }]),
      ...(hasYesterdayHabits ? [] : [{ key: "habits", section: "night" as const, type: "habits" as const, question: "Which habits did you complete?" }]),
      { key: "soreness",         section: "morning", type: "scale", question: "How does your body feel right now?",   lo: "Very sore",    hi: "No soreness" },
      { key: "pain",             section: "morning", type: "opts3", question: "Any pain or injury today?",            opts: [["none","None"],["minor","Minor"],["yes","Yes"]] },
      ...((morningData.pain === "minor" || morningData.pain === "yes") ? [{ key: "painArea", section: "morning" as const, type: "painArea" as const, question: "Where?" }] : []),
      { key: "energy",           section: "morning", type: "scale", question: "Current energy level?",                lo: "Exhausted",    hi: "Energised"   },
      { key: "motivation",       section: "morning", type: "scale", question: "Motivated today?",                     lo: "None",         hi: "Fired up"    },
      { key: "water",            section: "morning", type: "yesno", question: "Did you drink 500ml of water on waking?" },
      { key: "complete",         section: "morning", type: "complete", question: "" },
    ];

    const totalSteps = COMBINED_STEPS.length;
    const step = COMBINED_STEPS[morningStep];
    const accent = BLUE;

    const isLastStep = morningStep === totalSteps - 1;

    function pick(key: string, val: string | number) {
      const next = { ...morningData, [key]: val };
      setMorningData(next);
      if (!previewMode && key === "water" && val === "yes") {
        try {
          const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
          const titles = sd[todayYMD] ?? [];
          if (!titles.includes("Wake up")) {
            sd[todayYMD] = [...titles, "Wake up"];
            localStorage.setItem("padelop:schedule-done", JSON.stringify(sd));
          }
        } catch {}
        try {
          const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
          const currentMl = hq?.date === todayYMD ? (hq.ml ?? 0) : 0;
          if (currentMl < 500) {
            localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayYMD, ml: 500 }));
          }
        } catch {}
        window.dispatchEvent(new Event("storage"));
      }
      if (!isLastStep) {
        setTimeout(() => setMorningStep(s => s + 1), 180);
      }
    }

    function advance() {
      if (morningStep < totalSteps - 1) setMorningStep(s => s + 1);
      else saveCombined(morningData);
    }

    function saveCombined(next: Record<string, string | number>) {
      if (previewMode) { onClose(); return; }
      try {
        const ci = {
          sleep:      Number(next.sleep)      || 3,
          energy:     Number(next.energy)     || 3,
          soreness:   Number(next.soreness)   || 3,
          motivation: Number(next.motivation) || 3,
          stress:     Number(next.stress)     || 3,
        };
        savePartialCheckIn(ci);
        saveCheckInToDb({ date: todayYMD, sleep: ci.sleep, energy: ci.energy });

        localStorage.setItem("padelop:morning-log", JSON.stringify({
          date: todayYMD,
          sleepHours: next.sleepHours,
          pain: next.pain ?? "none",
          painAreas,
          waterOnWaking: next.water === "yes",
        }));

        // Auto-mark "Wake up" as done only if they drank water on waking
        if (next.water === "yes") {
          try {
            const sd: Record<string, string[]> = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
            const titles = sd[todayYMD] ?? [];
            const updated = titles.includes("Wake up") ? titles : [...titles, "Wake up"];
            sd[todayYMD] = updated;
            localStorage.setItem("padelop:schedule-done", JSON.stringify(sd));
            saveScheduleDoneToDb(todayYMD, updated);
          } catch {}
          // Seed hydration meter with 500ml so it isn't empty after check-in
          try {
            const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
            const existing = hq?.date === todayYMD ? (hq.ml ?? 0) : 0;
            if (existing < 500) {
              localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayYMD, ml: 500 }));
            }
            // Always attempt DB seed — ignoreDuplicates=true won't overwrite a real value,
            // but without this, a phone-side localStorage >= 500 would skip the DB write entirely
            seedHydrationToDb(todayYMD, 500);
          } catch {}
          window.dispatchEvent(new Event("storage"));
        }

        const bedtime = String(next.bedtime ?? "");
        const earlyBed = ["9pm","10pm","10:30pm"].includes(bedtime);
        const habitsEntry = {
          date:         todayYMD,
          sleep:        earlyBed,
          mobility:     nightHabits.includes("Mobility"),
          visualise:    nightHabits.includes("Visualise"),
          boxBreathing: nightHabits.includes("Box breathing"),
          foamRoll:     nightHabits.includes("Foam roll"),
          lightWalk:    nightHabits.includes("Light walk"),
          coldShower:   nightHabits.includes("Cold shower"),
        };
        const prevHabits = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
        localStorage.setItem("padelop:habits", JSON.stringify([habitsEntry, ...prevHabits].slice(0, 50)));

        const protein = String(next.protein ?? "");
        const nutritionQuality = String(next.nutritionQuality ?? "ok");
        const nutritionEntry = {
          ts: new Date().toISOString(),
          proteinRating: protein === "yes" ? "high" : protein === "no" ? "low" : "mid",
          quality: nutritionQuality,
          foods: [] as string[],
          postMatch: "no",
        };
        const prevNutrition = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]");
        localStorage.setItem("padelop:nutrition-logs", JSON.stringify([nutritionEntry, ...prevNutrition].slice(0, 50)));

        const hydrationLitres = String(next.hydrationLitres ?? "");
        if (hydrationLitres) {
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          const hydrationEntry = { ts: yesterday.toISOString(), litres: hydrationLitres, urine: "", quality: "ok", timing: [] as string[] };
          const prevHydration = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
          localStorage.setItem("padelop:hydration-logs", JSON.stringify([hydrationEntry, ...prevHydration].slice(0, 50)));
          const yesterdayYMD = yesterday.toISOString().slice(0, 10);
          saveHydrationToDb(yesterdayYMD, rangeToMl(hydrationLitres));
        }
      } catch {}

      afterSave();
    }

    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={handleClose}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full max-w-lg bg-white r-t-xl shadow-modal"
          style={{ minHeight: "82dvh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
          onClick={e => e.stopPropagation()}>
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-c-line mx-auto mt-4"/>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <button
              onClick={() => { if (morningStep === 0) handleClose(); else setMorningStep(s => s - 1); }}
              className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-sub)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            {/* Progress */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[12px] font-bold" style={{ color: accent }}>{morningStep + 1} of {totalSteps}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} style={{ width: i === morningStep ? 16 : 4, height: 4, borderRadius: "var(--r-pill)", background: i <= morningStep ? accent : "var(--c-line)", transition: "all 0.25s" }}/>
                ))}
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          {/* Question */}
          <p className="text-center font-bold text-c-text px-6 pt-8 pb-7" style={{ fontSize: "clamp(22px, 6vw, 28px)" }}>
            {step.question}
          </p>
          {/* Answers */}
          <div className="px-5 pb-10">
            {step.type === "scale" && (
              <div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(v => {
                    const sel = morningData[step.key] === v;
                    return (
                      <button key={v} onClick={() => pick(step.key, v)}
                        className="flex-1 rounded-2xl text-[20px] font-bold transition-all active:scale-95"
                        style={{ height: 48, background: sel ? accent : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[11px] text-c-label">{step.lo}</span>
                  <span className="text-[11px] text-c-label">{step.hi}</span>
                </div>
              </div>
            )}
            {step.type === "face" && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  {step.opts.map(([v, label]) => {
                    const sel = morningData[step.key] === v;
                    return (
                      <button key={v} onClick={() => pick(step.key, v)}
                        className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                        style={{ borderColor: sel ? accent : "var(--c-line)", background: sel ? "#eff6ff" : "var(--c-bg-input)" }}>
                        <Face v={v} sel={sel} color={accent}/>
                        <span className="text-[13px] font-bold" style={{ color: sel ? accent : "var(--c-text-sub)" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
                {step.key === "nutritionQuality" && (
                  <div className="flex flex-col gap-1.5 mt-3">
                    {[
                      ["Poorly", "Skipped meals, processed food, low protein"],
                      ["OK",     "Ate enough but not optimal — some snacks or gaps"],
                      ["Well",   "Balanced meals, good protein, fruit or veg"],
                    ].map(([label, def]) => (
                      <div key={label} className="flex gap-2 items-baseline">
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-sub)", minWidth: 40 }}>{label}</span>
                        <span style={{ fontSize: 12, color: "var(--c-hint)", lineHeight: 1.4 }}>{def}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {step.type === "opts3" && (
              <div className="flex gap-2">
                {step.opts.map(([v, label]) => {
                  const sel = morningData[step.key] === v;
                  return (
                    <button key={v} onClick={() => pick(step.key, v)}
                      className="flex-1 rounded-2xl text-[16px] font-bold transition-all active:scale-95"
                      style={{ height: 48, background: sel ? accent : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {step.type === "opts" && (
              <div className="flex flex-wrap gap-2">
                {step.opts.map((o: string) => {
                  const sel = morningData[step.key] === o;
                  return (
                    <button key={o} onClick={() => pick(step.key, o)}
                      className="rounded-2xl text-[16px] font-bold transition-all active:scale-95 px-5"
                      style={{ height: 48, background: sel ? accent : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
            {step.type === "painArea" && (
              <div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["Knee","Shoulder","Ankle","Back","Hip","Elbow","Wrist","Neck","Muscle"].map(area => {
                    const sel = painAreas.includes(area);
                    return (
                      <button key={area} onClick={() => setPainAreas(a => sel ? a.filter(x => x !== area) : [...a, area])}
                        className="flex items-center justify-center gap-1.5 rounded-2xl text-[14px] font-bold transition-all active:scale-95"
                        style={{ height: 44, background: sel ? accent : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                        {sel && <span style={{ fontSize: 11 }}>✓</span>}
                        {area}
                      </button>
                    );
                  })}
                </div>
                <button onClick={advance}
                  className="w-full rounded-2xl text-white text-[16px] font-bold transition-all active:scale-95"
                  style={{ height: 52, background: accent }}>
                  Next →
                </button>
              </div>
            )}
            {step.type === "habits" && (
              <div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {["Foam roll","Cold shower","Mobility","Box breathing","Light walk","Visualise"].map(habit => {
                    const sel = nightHabits.includes(habit);
                    return (
                      <button key={habit} onClick={() => setNightHabits(h => sel ? h.filter(x => x !== habit) : [...h, habit])}
                        className="flex items-center gap-2 px-4 rounded-2xl text-[14px] font-bold transition-all active:scale-95"
                        style={{ height: 48, background: sel ? accent : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                        {sel && <span>✓</span>}
                        {habit}
                      </button>
                    );
                  })}
                </div>
                <button onClick={advance}
                  className="w-full rounded-2xl text-white text-[16px] font-bold transition-all active:scale-95"
                  style={{ height: 52, background: accent }}>
                  Next →
                </button>
              </div>
            )}
            {step.type === "yesno" && (
              <div className="flex flex-col gap-3">
                {[{ v: "yes", label: "Yes", color: "var(--c-green)" }, { v: "no", label: "No", color: "var(--c-red)" }].map(({ v, label, color }) => {
                  const sel = morningData[step.key] === v;
                  return (
                    <button key={v} onClick={() => pick(step.key, v)}
                      className="w-full rounded-2xl text-[20px] font-bold transition-all active:scale-95"
                      style={{ height: 56, background: sel ? color : "var(--c-bg)", color: sel ? "#fff" : "var(--c-text-sub)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {step.type === "complete" && (
              <div className="flex flex-col items-center gap-6 pt-4">
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 800, color: "#1a1c1c" }}>Check-in complete</p>
                <button onClick={() => saveCombined(morningData)}
                  className="w-full rounded-2xl text-white text-[16px] font-bold transition-all active:scale-95"
                  style={{ height: 56, background: BLUE }}>
                  Save check-in (+1 pt)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sub === "hydration") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full bg-white rounded-t-[28px] overflow-y-auto shadow-modal" style={{ maxHeight: "70vh", paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div><p className="t-title text-c-text">Hydration Check</p><p className="t-body-sm text-c-text-sub mt-0.5">Log your water intake today</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            <div>
              <p className="t-label text-c-text-sub mb-3">How much have you drunk today?</p>
              <div className="flex gap-2 flex-wrap">
                {["<1L","1–1.5L","1.5–2L","2–2.5L","2.5–3L","3L+"].map(n => {
                  const sel = hydrationLog.litres === n;
                  return <button key={n} onClick={() => setHydrationLog(l => ({ ...l, litres: n }))}
                    className="flex-1 py-2.5 rounded-2xl border-2 text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? BLUE : "var(--c-text-sub)" }}>{n}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">What did you drink?</p>
              <div className="flex flex-wrap gap-2">
                {["Water","Sparkling water","Sports drink","Coconut water","Tea / Coffee","Juice","Milk","Protein shake"].map(drink => {
                  const sel = hydrationLog.timing.includes(drink);
                  return <button key={drink} onClick={() => setHydrationLog(l => ({ ...l, timing: sel ? l.timing.filter(d => d !== drink) : [...l.timing, drink] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? BLUE : "var(--c-text-sub)" }}>{drink}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-1">Urine colour check</p>
              <p className="t-tag text-c-text-sub mb-3">Best proxy for hydration status</p>
              <div className="flex gap-2">
                {[
                  { v: "clear",  label: "Clear",       bg: "#f0f9ff", border: "#bae6fd" },
                  { v: "pale",   label: "Pale yellow",  bg: "#fefce8", border: "#fde047" },
                  { v: "yellow", label: "Yellow",       bg: "#fef9c3", border: "#facc15" },
                  { v: "dark",   label: "Dark",         bg: "#fef3c7", border: "var(--c-amber)" },
                  { v: "brown",  label: "Brown",        bg: "#fdf4dc", border: "#b45309" },
                ].map(({ v, label, bg, border }) => {
                  const sel = hydrationLog.urine === v;
                  return <button key={v} onClick={() => setHydrationLog(l => ({ ...l, urine: v }))}
                    className="flex-1 py-2.5 rounded-2xl border-2 text-[10px] font-bold transition-all active:scale-95 text-center"
                    style={{ borderColor: sel ? border : "var(--c-line)", background: sel ? bg : "var(--c-bg-input)", color: "var(--c-text-sub)" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">How do you feel?</p>
              <div className="flex gap-3">
                {([["bad","Thirsty"],["ok","OK"],["great","Hydrated"]] as const).map(([v, label]) => {
                  const sel = hydrationLog.quality === v;
                  return (
                    <button key={v} onClick={() => setHydrationLog(l => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)" }}>
                      <Face v={v} sel={sel} color={BLUE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? BLUE : "var(--c-text-sub)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={() => {
                try {
                  const entry = { ...hydrationLog, ts: new Date().toISOString() };
                  const prev = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
                  localStorage.setItem("padelop:hydration-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                  const litreMap: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
                  const ml = litreMap[hydrationLog.litres] ?? 0;
                  const todayKey = entry.ts.slice(0, 10);
                  if (ml) localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: todayKey, ml }));
                  saveHydrationToDb(todayKey, ml);
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl t-ui text-white active:scale-[0.98] transition-transform"
              style={{ background: BLUE }}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "nutrition") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full bg-white rounded-t-[28px] overflow-y-auto shadow-modal" style={{ maxHeight: "78vh", paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div><p className="t-title text-c-text">Log Nutrition</p><p className="t-body-sm text-c-text-sub mt-0.5">Track your recovery fuelling today</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            <div>
              <p className="t-label text-c-text-sub mb-3">How was your protein intake today?</p>
              <div className="flex gap-3">
                {([["low","Not enough"],["mid","Getting there"],["high","Nailed it"]] as const).map(([v, label]) => {
                  const sel = nutritionLog.proteinRating === v;
                  return (
                    <button key={v} onClick={() => setNutritionLog(l => ({ ...l, proteinRating: v }))}
                      className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)" }}>
                      <Face v={v === "low" ? "bad" : v === "mid" ? "ok" : "great"} sel={sel} color={BLUE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? BLUE : "var(--c-text-sub)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">What protein sources did you have?</p>
              <div className="flex flex-wrap gap-2">
                {["Eggs","Chicken","Fish","Red meat","Greek yogurt","Protein shake","Legumes","Tofu / Tempeh","Cottage cheese","Nuts & seeds"].map(food => {
                  const sel = nutritionLog.foods.includes(food);
                  return <button key={food} onClick={() => setNutritionLog(l => ({ ...l, foods: sel ? l.foods.filter(f => f !== food) : [...l.foods, food] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? BLUE : "var(--c-text-sub)" }}>{food}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Did you eat within 30 min post-match?</p>
              <div className="flex gap-3">
                {[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }].map(({ v, label }) => {
                  const sel = nutritionLog.postMatch === v;
                  return <button key={v} onClick={() => setNutritionLog(l => ({ ...l, postMatch: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? (v === "yes" ? "var(--c-green)" : "var(--c-red)") : "var(--c-line)", background: sel ? (v === "yes" ? "var(--c-green-bg)" : "var(--c-red-bg)") : "var(--c-bg-input)", color: sel ? (v === "yes" ? "var(--c-green)" : "var(--c-red)") : "var(--c-text-sub)" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Overall nutrition quality today?</p>
              <div className="flex gap-3">
                {([["bad","Poor"],["ok","Decent"],["great","Great"]] as const).map(([v, label]) => {
                  const sel = nutritionLog.quality === v;
                  return (
                    <button key={v} onClick={() => setNutritionLog(l => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)" }}>
                      <Face v={v} sel={sel} color={BLUE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? BLUE : "var(--c-text-sub)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={() => {
                try {
                  const entry = { ...nutritionLog, ts: new Date().toISOString() };
                  const prev = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]");
                  localStorage.setItem("padelop:nutrition-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                  saveNutritionToDb({ date: entry.ts.slice(0, 10), description: nutritionLog.quality ?? undefined });
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl t-ui text-white active:scale-[0.98] transition-transform"
              style={{ background: BLUE }}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "training") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full bg-white rounded-t-[28px] overflow-y-auto shadow-modal" style={{ maxHeight: "85vh", paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div><p className="t-title text-c-text">Log Training</p><p className="t-body-sm text-c-text-sub mt-0.5">What did you do today?</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            <div>
              <p className="t-label text-c-text-sub mb-3">Session type</p>
              <div className="flex flex-wrap gap-2">
                {["Padel", "Drills", "Gym", "Cardio", "Mobility", "Rest"].map(t => {
                  const sel = trainingLog.sessionType.includes(t);
                  return <button key={t} onClick={() => setTrainingLog(l => ({ ...l, sessionType: sel ? l.sessionType.filter(s => s !== t) : [...l.sessionType, t] }))}
                    className="px-4 py-2 rounded-full border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? BLUE : "var(--c-text-sub)" }}>{t}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Drill focus</p>
              <div className="flex flex-wrap gap-2">
                {["Serve", "Bandeja", "Smash", "Volleys", "Defense", "Attack", "Positioning", "Movement"].map(tag => {
                  const sel = trainingLog.drillFocus.includes(tag);
                  return <button key={tag} onClick={() => setTrainingLog(l => ({ ...l, drillFocus: sel ? l.drillFocus.filter(t => t !== tag) : [...l.drillFocus, tag] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? BLUE : "var(--c-text-sub)" }}>{tag}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Duration</p>
              <div className="flex gap-2">
                {["30min", "60min", "90min", "2h+"].map(d => {
                  const sel = trainingLog.duration === d;
                  return <button key={d} onClick={() => setTrainingLog(l => ({ ...l, duration: d }))}
                    className="flex-1 py-2.5 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "var(--c-line)", background: sel ? "var(--c-blue-tint)" : "var(--c-bg-input)", color: sel ? BLUE : "var(--c-text-sub)" }}>{d}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Intensity</p>
              <div className="flex gap-3">
                {([["light","Light"],["moderate","Moderate"],["hard","Hard"]] as const).map(([v, label]) => {
                  const sel = trainingLog.intensity === v;
                  const color = v === "hard" ? "var(--c-red)" : v === "moderate" ? BLUE : "var(--c-green)";
                  return <button key={v} onClick={() => setTrainingLog(l => ({ ...l, intensity: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? color : "var(--c-line)", background: sel ? `${color}12` : "var(--c-bg-input)", color: sel ? color : "var(--c-text-sub)" }}>{label}</button>;
                })}
              </div>
            </div>
            <button onClick={() => {
                try {
                  const entry = { ...trainingLog, ts: new Date().toISOString() };
                  const prev = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]");
                  localStorage.setItem("padelop:training-logs", JSON.stringify([entry, ...prev].slice(0, 50)));
                  saveTrainingToDb({ date: entry.ts.slice(0, 10), drill_focus: trainingLog.drillFocus?.[0] ?? undefined, duration_mins: trainingLog.duration ? Number(trainingLog.duration) : undefined });
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl t-ui text-white active:scale-[0.98] transition-transform"
              style={{ background: BLUE }}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "matchreview") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
        <div className="relative w-full max-w-lg bg-white r-t-xl overflow-y-auto shadow-modal"
          style={{ maxHeight: "92vh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
          onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 rounded-full bg-c-line mx-auto mt-4 mb-1"/>
          <div className="px-6 pt-3 pb-2 flex items-center justify-between">
            <div><p className="t-title text-c-text">Match Review</p><p className="t-body-sm text-c-text-sub mt-0.5">Quick check-in while it&apos;s fresh</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6 mt-2">
            <div>
              <p className="t-label text-c-text-sub mb-3">How did the match feel?</p>
              <div className="flex gap-3">
                {([["bad","Rough"],["ok","Decent"],["great","Great"]] as const).map(([v, label]) => {
                  const sel = matchReview.feeling === v;
                  return (
                    <button key={v} onClick={() => setMatchReview(r => ({ ...r, feeling: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? PURPLE : "var(--c-line)", background: sel ? "#f5f3ff" : "var(--c-bg-input)" }}>
                      <Face v={v} sel={sel} color={PURPLE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? PURPLE : "var(--c-text-sub)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Result?</p>
              <div className="flex gap-3">
                {[{ v: "win", label: "Win", color: "var(--c-green)", bg: "var(--c-green-bg)" }, { v: "loss", label: "Loss", color: "var(--c-red)", bg: "var(--c-red-bg)" }].map(({ v, label, color, bg }) => {
                  const sel = matchReview.result === v;
                  return <button key={v} onClick={() => setMatchReview(r => ({ ...r, result: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? color : "var(--c-line)", background: sel ? bg : "var(--c-bg-input)", color: sel ? color : "var(--c-text-sub)" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Who did you play against?</p>
              <input
                type="text"
                placeholder="e.g. Marco & Luis"
                value={matchReview.opponentNames}
                onChange={e => setMatchReview(r => ({ ...r, opponentNames: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl border-2 text-[14px] text-c-text outline-none placeholder:text-[#b0b5ba]"
                style={{ borderColor: matchReview.opponentNames ? PURPLE : "var(--c-line)", background: matchReview.opponentNames ? "#f5f3ff" : "var(--c-bg-input)" }}
              />
              {matchResultImage ? (
                <div className="mt-3 relative">
                  <img src={matchResultImage} alt="Match result" className="w-full rounded-2xl object-cover" style={{ maxHeight: 200 }} />
                  <button
                    onClick={() => setMatchResultImage(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ) : (
                <label className="mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed cursor-pointer transition-colors"
                  style={{ borderColor: "var(--c-line)", background: "var(--c-bg-input)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-label)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                  </svg>
                  <span className="t-body-sm font-medium text-c-label">Upload match result screenshot</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setMatchResultImage(ev.target?.result as string);
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }} />
                </label>
              )}
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Opponent level?</p>
              <div className="flex gap-3">
                {[{ v: "easy", label: "Easier" }, { v: "equal", label: "Equal" }, { v: "tough", label: "Tougher" }].map(({ v, label }) => {
                  const sel = matchReview.opponent === v;
                  return <button key={v} onClick={() => setMatchReview(r => ({ ...r, opponent: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? PURPLE : "var(--c-line)", background: sel ? "#f5f3ff" : "var(--c-bg-input)", color: sel ? PURPLE : "var(--c-text-sub)" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Mental state</p>
              <div className="flex flex-col gap-3">
                {([
                  { key: "mentalBefore", label: "Before", opts: [["bad","Nervous"],["ok","Calm"],["great","Confident"]] },
                  { key: "mentalDuring", label: "During", opts: [["bad","Lost focus"],["ok","Steady"],["great","In the zone"]] },
                  { key: "mentalAfter",  label: "After",  opts: [["bad","Frustrated"],["ok","OK"],["great","Satisfied"]] },
                ] as { key: "mentalBefore"|"mentalDuring"|"mentalAfter"; label: string; opts: [string,string][] }[]).map(({ key, label, opts }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="t-tag font-bold text-c-label w-12 flex-shrink-0">{label}</span>
                    <div className="flex gap-2 flex-1">
                      {opts.map(([v, text]) => {
                        const sel = matchReview[key] === v;
                        return (
                          <button key={v} onClick={() => setMatchReview(r => ({ ...r, [key]: v }))}
                            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl border-2 transition-all active:scale-95"
                            style={{ borderColor: sel ? PURPLE : "var(--c-line)", background: sel ? "#f5f3ff" : "var(--c-bg-input)" }}>
                            <Face v={v} sel={sel} color={PURPLE}/>
                            <span className="text-[9px] font-bold leading-tight text-center" style={{ color: sel ? PURPLE : "var(--c-text-sub)" }}>{text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Did you warm up?</p>
              <div className="flex gap-3">
                {[{ v: "none", label: "No warmup" }, { v: "quick", label: "Quick" }, { v: "full", label: "Full warmup" }].map(({ v, label }) => {
                  const sel = matchReview.warmup === v;
                  return <button key={v} onClick={() => setMatchReview(r => ({ ...r, warmup: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? PURPLE : "var(--c-line)", background: sel ? "#f5f3ff" : "var(--c-bg-input)", color: sel ? PURPLE : "var(--c-text-sub)" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">What did you do well?</p>
              <div className="flex flex-wrap gap-2">
                {["Serve","Bandeja","Smash","Volleys","Defense","Attack","Positioning","Communication","Movement","Mental strength"].map(tag => {
                  const sel = matchReview.wellDone.includes(tag);
                  return <button key={tag} onClick={() => setMatchReview(r => ({ ...r, wellDone: sel ? r.wellDone.filter(t => t !== tag) : [...r.wellDone, tag] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "var(--c-green)" : "var(--c-line)", background: sel ? "var(--c-green-bg)" : "var(--c-bg-input)", color: sel ? "var(--c-green)" : "var(--c-text-sub)" }}>{tag}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">What needs work?</p>
              <div className="flex flex-wrap gap-2">
                {["Serve","Bandeja","Smash","Volleys","Defense","Attack","Positioning","Communication","Movement","Mental strength"].map(tag => {
                  const sel = matchReview.improved.includes(tag);
                  return <button key={tag} onClick={() => setMatchReview(r => ({ ...r, improved: sel ? r.improved.filter(t => t !== tag) : [...r.improved, tag] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "var(--c-red)" : "var(--c-line)", background: sel ? "var(--c-red-bg)" : "var(--c-bg-input)", color: sel ? "var(--c-red)" : "var(--c-text-sub)" }}>{tag}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="t-label text-c-text-sub mb-3">Match notes</p>
              <textarea
                value={matchReview.notes ?? ""}
                onChange={e => setMatchReview(r => ({ ...r, notes: e.target.value }))}
                placeholder="How did the game go? Describe the players, key moments, tactics…"
                rows={3}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid var(--c-line)", background: "var(--c-bg-input)", fontSize: 14, color: "var(--c-text)", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }}
              />
            </div>
            <button onClick={() => {
                try {
                  const matchDateSaved = (() => { try { const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); return m?.date ?? null; } catch { return null; } })();
                  const entry = { ...matchReview, resultImage: matchResultImage ?? undefined, ts: new Date().toISOString(), matchDate: matchDateSaved };
                  const prev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
                  localStorage.setItem("padelop:match-reviews", JSON.stringify([entry, ...prev].slice(0, 50)));
                  saveMatchReview(entry);
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl t-ui text-white active:scale-[0.98] transition-transform"
              style={{ background: PURPLE }}>
              Save Review
            </button>
            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }}/>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "matchlist") {
    let reviews: { ts: string; result?: string; feeling?: string }[] = [];
    try { reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); } catch {}
    let matchData: { date: string; time: string; club?: string } | null = null;
    try { matchData = JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch {}

    const hasMatch = !!(matchData?.date && matchData?.time);
    const matchPast = hasMatch && new Date(`${matchData!.date}T${matchData!.time}:00`).getTime() < Date.now();
    const alreadyReviewed = reviews[0]?.ts?.slice(0, 10) === matchData?.date;
    const hasUnrated = hasMatch && matchPast && !alreadyReviewed;
    const nothing = !hasUnrated && reviews.length === 0;
    const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const fmtReviewDate = (ts: string) => new Date(ts).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/>
        <div className="relative w-full max-w-lg bg-white r-t-xl overflow-hidden shadow-modal"
          style={{ maxHeight: "80vh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
          onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 rounded-full bg-c-line mx-auto mt-4 mb-1"/>
          <div className="px-6 pt-3 pb-4 flex items-center justify-between">
            <div><p className="t-title text-c-text">Match Reviews</p><p className="t-body-sm text-c-text-sub mt-0.5">Rate your games to track performance</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-c-bg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-sub)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 96px)" }}>
            {nothing && (
              <div className="px-6 py-12 text-center">
                <p className="text-[32px] mb-3">🎾</p>
                <p className="t-ui text-c-text">No matches yet</p>
                <p className="t-body-sm text-c-text-sub mt-1">Add a match to start tracking your game.</p>
              </div>
            )}
            {hasUnrated && (
              <>
                <div className="px-6 py-2 bg-c-bg-input"><p className="t-label text-[#5a7055]">Needs a rating</p></div>
                <button onClick={() => setSub("matchreview")}
                  className="w-full flex items-center gap-4 px-6 py-4 active:bg-c-bg-input transition-colors"
                  style={{ borderBottom: "1px solid #f4f4f4" }}>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#f0f4ff]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 21h8M12 17v4"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.3-2.7 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="t-ui text-c-text">{matchData?.date ? fmtDate(matchData.date) : "Recent match"}</p>
                    <p className="t-caption text-c-text-sub mt-0.5">{matchData?.time}{matchData?.club ? ` · ${matchData.club}` : ""}</p>
                  </div>
                  <span className="t-tag px-2.5 py-1 rounded-full bg-[#fff3cd] text-[#a16207] whitespace-nowrap flex-shrink-0">Rate now</span>
                </button>
              </>
            )}
            {reviews.length > 0 && (
              <>
                <div className="px-6 py-2 bg-c-bg-input"><p className="t-label text-[#5a7055]">Previous games</p></div>
                {reviews.map((rev, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: i < reviews.length - 1 ? "1px solid #f4f4f4" : "none" }}>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-c-bg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-sub)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill="var(--c-text-sub)" stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill="var(--c-text-sub)" stroke="none"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="t-ui text-c-text">{fmtReviewDate(rev.ts)}</p>
                      <p className="t-caption text-c-text-sub mt-0.5">{[rev.result, rev.feeling ? `Felt ${rev.feeling}` : ""].filter(Boolean).join(" · ") || "Reviewed"}</p>
                    </div>
                    <span className="t-tag px-2.5 py-1 rounded-full bg-[#caecbc] text-c-forest whitespace-nowrap flex-shrink-0">Rated</span>
                  </div>
                ))}
              </>
            )}
            <div className="h-6"/>
          </div>
        </div>
      </div>
    );
  }

  // ── Main picker ──────────────────────────────────────────────────────────

  const scoringData = loadScoringData();
  const overallScore = Math.round(computeScores(scoringData.checkIn, scoringData.hydration, scoringData.review, scoringData.nutrition, scoringData.gameDaysThisWeek, scoringData.habits, scoringData.training).overall);

  const todayStr = todayYMD;
  let recoveryDone = false;
  try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); recoveryDone = ci?.date === todayStr && ci.sleep !== undefined; } catch {}
  let wellbeingDone = false;
  try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); wellbeingDone = ci?.date === todayStr && ci.stress !== undefined; } catch {}
  let hydroDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0]; hydroDone = r?.ts.slice(0, 10) === todayStr; } catch {}
  let nutriDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0]; nutriDone = r?.ts.slice(0, 10) === todayStr; } catch {}
  let reviewDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0]; reviewDone = r?.ts.slice(0, 10) === todayStr; } catch {}
  let trainingDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:training-logs") || "[]")[0]; trainingDone = r?.ts.slice(0, 10) === todayStr; } catch {}

  const GREEN = "var(--c-green)";
  const TEAL = "var(--c-teal)";
  const categories = [
    { label: "Recovery", sub: "Sleep · energy · soreness · hydration", color: PURPLE, done: recoveryDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
      action: () => setSub("recovery") },
    { label: "Nutrition", sub: "Protein, fuel & hydration", color: TEAL, done: nutriDone && hydroDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
      action: () => setSub("nutrition") },
    { label: "Training", sub: "Sessions, drills & intensity", color: GREEN, done: trainingDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5v14M18 5v14M2 9h4M18 9h4M2 15h4M18 15h4M6 12h12"/></svg>,
      action: () => setSub("training") },
    { label: "Wellbeing", sub: "Stress & motivation", color: AMBER, done: wellbeingDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill={AMBER} stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill={AMBER} stroke="none"/></svg>,
      action: () => setSub("wellbeing") },
    { label: "Hydration", sub: "Log today's water intake", color: TEAL, done: hydroDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>,
      action: () => setSub("hydration") },
    { label: "Review a match", sub: "Log your last match performance", color: PURPLE, done: reviewDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill={PURPLE} stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill={PURPLE} stroke="none"/></svg>,
      action: () => setSub("matchlist") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={handleClose}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative w-full max-w-lg bg-white r-t-xl flex flex-col overflow-hidden"
        style={{ animation: "slideUp 0.3s cubic-bezier(0.22,1,0.36,1)", minHeight: startWizard ? "65vh" : "55vh", maxHeight: "90dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-c-line mx-auto mt-4 mb-2 flex-shrink-0"/>
        {/* Nav row */}
        <div className="flex justify-around items-center px-2 pb-3 pt-1 flex-shrink-0" style={{ borderBottom: "1px solid #f0f0f0" }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={handleClose}
                className="flex flex-col items-center gap-1 px-2 py-1"
                style={{ color: active ? "var(--c-blue)" : "var(--c-label)" }}>
                {item.icon ?? (
                  <span style={{ fontSize: 20, fontWeight: 700, lineHeight: "20px", letterSpacing: "-0.02em", display: "block", width: 20, textAlign: "center" }}>{overallScore}</span>
                )}
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* Method picker */}
          {!logMethod && (
            <div className="px-5 pt-6 pb-10">
              <p className="t-ui font-bold tracking-widest uppercase text-c-label mb-5 text-center">Log something to update your score</p>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={handleCamera} className="flex flex-col items-center gap-3 py-7 rounded-2xl active:scale-95 transition-transform" style={{ background: "#f4f6ff" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BLUE }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <span className="t-ui" style={{ color: BLUE }}>Camera</span>
                </button>
                <button onClick={() => uploadRef.current?.click()} className="flex flex-col items-center gap-3 py-7 rounded-2xl active:scale-95 transition-transform" style={{ background: "#f4f6ff" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BLUE }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <span className="t-ui" style={{ color: BLUE }}>Upload</span>
                </button>
                <button onClick={() => setLogMethod("wizard")} className="flex flex-col items-center gap-3 py-7 rounded-2xl active:scale-95 transition-transform" style={{ background: "#f4f6ff" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BLUE }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3l-4 8h6l-4 10"/><path d="M5 12h2"/><path d="M17 12h2"/><path d="M12 5v-2"/><path d="M12 21v-2"/>
                    </svg>
                  </div>
                  <span className="t-ui" style={{ color: BLUE }}>Wizard</span>
                </button>
              </div>
              <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={() => {}}/>
              <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={e => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = () => { try { importData(JSON.parse(reader.result as string)); setImportDone(true); handleClose(); window.location.reload(); } catch { alert("Couldn't read that file."); } };
                reader.readAsText(file); e.target.value = "";
              }}/>

              {/* App actions */}
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid #f0f0f0" }}>
                <p className="t-label text-c-label mb-3">More</p>
                <div className="flex flex-col" style={{ background: "var(--c-bg-input)", borderRadius: 16, overflow: "hidden" }}>
                  {[
                    { label: "My Profile", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, action: () => { handleClose(); startNavLoad(); router.push("/profile"); } },
                    { label: "Weekly Shopping List", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, action: () => { handleClose(); startNavLoad(); router.push("/shopping-list"); } },
                    { label: "Export my data", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, action: () => { downloadSnapshot(); handleClose(); } },
                    { label: importDone ? "Data restored ✓" : "Import backup", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>, action: () => importRef.current?.click() },
                  ].map((item, i, arr) => (
                    <button key={item.label} onClick={item.action}
                      className="flex items-center gap-4 px-5 py-4 active:bg-c-bg transition-colors text-left w-full"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid #ebebeb" : "none", background: "none" }}>
                      <span style={{ color: "var(--c-text-dim)" }}>{item.icon}</span>
                      <span className="t-ui text-c-text">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Wizard category list */}
          {logMethod === "wizard" && (
            <div className="px-5 pt-6 pb-10">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setLogMethod(null)} className="w-9 h-9 rounded-full flex items-center justify-center active:bg-[#f0f0f0]" style={{ background: "var(--c-bg)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <p className="t-title font-bold text-c-text">What are you logging?</p>
              </div>
              <div className="flex flex-col gap-3">
                {categories.map(cat => (
                  <button key={cat.label} onClick={cat.action}
                    className="flex items-center gap-5 px-5 py-6 rounded-2xl active:opacity-70 transition-opacity"
                    style={{ background: "var(--c-bg-input)", border: "1px solid #f0f0f0" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}15` }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="t-title font-semibold text-c-text">{cat.label}</p>
                      <p className="t-body text-c-text-dim mt-1">{cat.sub}</p>
                    </div>
                    {cat.done && <span className="t-body-sm font-bold px-3 py-1 rounded-full flex-shrink-0" style={{ background: "var(--c-green-bg)", color: "var(--c-green)" }}>Done</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
