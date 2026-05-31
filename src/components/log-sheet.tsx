"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { saveCheckIn, computeScores, loadScoringData } from "@/lib/scoring";

const NAV_ITEMS = [
  { href: "/home4",     label: "Home",      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { href: "/today4",    label: "Today",     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg> },
  { href: "/home-v1",   label: "Readiness", icon: null },
  { href: "/track4",    label: "Track",     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { href: "/matches4",  label: "Matches",   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { href: "/insights4", label: "Insights",  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

type Sub = "checkin" | "hydration" | "nutrition" | "matchlist" | "matchreview" | null;

const PURPLE = "#7c3aed";
const BLUE = "#2653d4";

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function Face({ v, sel, color }: { v: string; sel: boolean; color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sel ? color : "#4a5050"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      {v === "bad"   && <path d="M8 17c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5"/>}
      {v === "ok"    && <line x1="9" y1="15.5" x2="15" y2="15.5"/>}
      {v === "great" && <path d="M8 14c1 2 6 2 8 0"/>}
      <circle cx="9" cy="9.5" r="0.8" fill={sel ? color : "#4a5050"} stroke="none"/>
      <circle cx="15" cy="9.5" r="0.8" fill={sel ? color : "#4a5050"} stroke="none"/>
    </svg>
  );
}

export default function LogSheet({ open, onClose }: Props) {
  const pathname = usePathname();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [sub, setSub] = useState<Sub>(null);
  const [logMethod, setLogMethod] = useState<"wizard" | null>(null);

  const [checkIn, setCheckIn] = useState({ sleep: 3, energy: 3, soreness: 3, hydration: 3 });
  const [hydrationLog, setHydrationLog] = useState({ litres: "", timing: [] as string[], quality: "", urine: "" });
  const [nutritionLog, setNutritionLog] = useState({ proteinRating: "", foods: [] as string[], postMatch: "", quality: "" });
  const [matchReview, setMatchReview] = useState({ feeling: "", result: "", opponent: "", energy: "", injury: "", wellDone: [] as string[], improved: [] as string[], mentalBefore: "", mentalDuring: "", mentalAfter: "" });

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

  if (sub === "checkin") {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-4" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden shadow-2xl" style={{ animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }} onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1"/>
          <div className="px-6 pt-3 pb-4 flex items-center justify-between">
            <div><p className="h1-headline-md text-[#1a1c1c]">Daily Check-in</p><p className="text-[13px] text-[#4a5050] mt-0.5">How are you feeling today?</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            {([
              { key: "sleep",     label: "Sleep quality",   lo: "Poor",       hi: "Excellent" },
              { key: "energy",    label: "Energy level",    lo: "Exhausted",  hi: "Energised" },
              { key: "soreness",  label: "Muscle soreness", lo: "Very sore",  hi: "No soreness" },
              { key: "hydration", label: "Hydration",       lo: "Dehydrated", hi: "Well hydrated" },
            ] as { key: keyof typeof checkIn; label: string; lo: string; hi: string }[]).map(({ key, label, lo, hi }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-semibold text-[#1a1c1c]">{label}</p>
                  <span className="text-[13px] font-bold text-[#2653d4]">{checkIn[key]}/5</span>
                </div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(v => {
                    const sel = checkIn[key] === v;
                    return (
                      <button key={v} onClick={() => setCheckIn(c => ({ ...c, [key]: v }))}
                        className="flex-1 py-2.5 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                        style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? BLUE : "#4a5050" }}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#8a9096]">{lo}</span>
                  <span className="text-[10px] text-[#8a9096]">{hi}</span>
                </div>
              </div>
            ))}
            <button onClick={() => { saveCheckIn(checkIn); afterSave(); }}
              className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
              style={{ background: BLUE }}>
              Save check-in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "hydration") {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-y-auto max-h-[88vh] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div><p className="h1-headline-md text-[#1a1c1c]">Hydration Check</p><p className="text-[13px] text-[#4a5050] mt-0.5">Log your water intake today</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">How much have you drunk today?</p>
              <div className="flex gap-2 flex-wrap">
                {["<1L","1–1.5L","1.5–2L","2–2.5L","2.5–3L","3L+"].map(n => {
                  const sel = hydrationLog.litres === n;
                  return <button key={n} onClick={() => setHydrationLog(l => ({ ...l, litres: n }))}
                    className="flex-1 py-2.5 rounded-2xl border-2 text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? BLUE : "#4a5050" }}>{n}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">What did you drink?</p>
              <div className="flex flex-wrap gap-2">
                {["Water","Sparkling water","Sports drink","Coconut water","Tea / Coffee","Juice","Milk","Protein shake"].map(drink => {
                  const sel = hydrationLog.timing.includes(drink);
                  return <button key={drink} onClick={() => setHydrationLog(l => ({ ...l, timing: sel ? l.timing.filter(d => d !== drink) : [...l.timing, drink] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? BLUE : "#4a5050" }}>{drink}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-1">Urine colour check</p>
              <p className="text-[11px] text-[#4a5050] mb-3">Best proxy for hydration status</p>
              <div className="flex gap-2">
                {[
                  { v: "clear",  label: "Clear",       bg: "#f0f9ff", border: "#bae6fd" },
                  { v: "pale",   label: "Pale yellow",  bg: "#fefce8", border: "#fde047" },
                  { v: "yellow", label: "Yellow",       bg: "#fef9c3", border: "#facc15" },
                  { v: "dark",   label: "Dark",         bg: "#fef3c7", border: "#f59e0b" },
                  { v: "brown",  label: "Brown",        bg: "#fdf4dc", border: "#b45309" },
                ].map(({ v, label, bg, border }) => {
                  const sel = hydrationLog.urine === v;
                  return <button key={v} onClick={() => setHydrationLog(l => ({ ...l, urine: v }))}
                    className="flex-1 py-2.5 rounded-2xl border-2 text-[10px] font-bold transition-all active:scale-95 text-center"
                    style={{ borderColor: sel ? border : "#e2e2e2", background: sel ? bg : "#f9f9f9", color: "#4a5050" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">How do you feel?</p>
              <div className="flex gap-3">
                {([["bad","Thirsty"],["ok","OK"],["great","Hydrated"]] as const).map(([v, label]) => {
                  const sel = hydrationLog.quality === v;
                  return (
                    <button key={v} onClick={() => setHydrationLog(l => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9" }}>
                      <Face v={v} sel={sel} color={BLUE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? BLUE : "#4a5050" }}>{label}</span>
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
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
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
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" onClick={handleClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] overflow-y-auto max-h-[88vh] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div><p className="h1-headline-md text-[#1a1c1c]">Log Nutrition</p><p className="text-[13px] text-[#4a5050] mt-0.5">Track your recovery fuelling today</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">How was your protein intake today?</p>
              <div className="flex gap-3">
                {([["low","Not enough"],["mid","Getting there"],["high","Nailed it"]] as const).map(([v, label]) => {
                  const sel = nutritionLog.proteinRating === v;
                  return (
                    <button key={v} onClick={() => setNutritionLog(l => ({ ...l, proteinRating: v }))}
                      className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9" }}>
                      <Face v={v === "low" ? "bad" : v === "mid" ? "ok" : "great"} sel={sel} color={BLUE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? BLUE : "#4a5050" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">What protein sources did you have?</p>
              <div className="flex flex-wrap gap-2">
                {["Eggs","Chicken","Fish","Red meat","Greek yogurt","Protein shake","Legumes","Tofu / Tempeh","Cottage cheese","Nuts & seeds"].map(food => {
                  const sel = nutritionLog.foods.includes(food);
                  return <button key={food} onClick={() => setNutritionLog(l => ({ ...l, foods: sel ? l.foods.filter(f => f !== food) : [...l.foods, food] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? BLUE : "#4a5050" }}>{food}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">Did you eat within 30 min post-match?</p>
              <div className="flex gap-3">
                {[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }].map(({ v, label }) => {
                  const sel = nutritionLog.postMatch === v;
                  return <button key={v} onClick={() => setNutritionLog(l => ({ ...l, postMatch: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? (v === "yes" ? "#16a34a" : "#dc2626") : "#e2e2e2", background: sel ? (v === "yes" ? "#f0fdf4" : "#fef2f2") : "#f9f9f9", color: sel ? (v === "yes" ? "#16a34a" : "#dc2626") : "#4a5050" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">Overall nutrition quality today?</p>
              <div className="flex gap-3">
                {([["bad","Poor"],["ok","Decent"],["great","Great"]] as const).map(([v, label]) => {
                  const sel = nutritionLog.quality === v;
                  return (
                    <button key={v} onClick={() => setNutritionLog(l => ({ ...l, quality: v }))}
                      className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? BLUE : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9" }}>
                      <Face v={v} sel={sel} color={BLUE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? BLUE : "#4a5050" }}>{label}</span>
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
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
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
        <div className="h1-font relative w-full max-w-lg bg-white rounded-t-[28px] overflow-y-auto shadow-2xl"
          style={{ maxHeight: "92vh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
          onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1"/>
          <div className="px-6 pt-3 pb-2 flex items-center justify-between">
            <div><p className="h1-headline-md text-[#1a1c1c]">Match Review</p><p className="text-[13px] text-[#4a5050] mt-0.5">Quick check-in while it&apos;s fresh</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]"><XIcon/></button>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-6 mt-2">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">How did the match feel?</p>
              <div className="flex gap-3">
                {([["bad","Rough"],["ok","Decent"],["great","Great"]] as const).map(([v, label]) => {
                  const sel = matchReview.feeling === v;
                  return (
                    <button key={v} onClick={() => setMatchReview(r => ({ ...r, feeling: v }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{ borderColor: sel ? PURPLE : "#e2e2e2", background: sel ? "#f5f3ff" : "#f9f9f9" }}>
                      <Face v={v} sel={sel} color={PURPLE}/>
                      <span className="text-[10px] font-bold tracking-wide" style={{ color: sel ? PURPLE : "#4a5050" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">Result?</p>
              <div className="flex gap-3">
                {[{ v: "win", label: "Win", color: "#16a34a", bg: "#f0fdf4" }, { v: "loss", label: "Loss", color: "#dc2626", bg: "#fef2f2" }].map(({ v, label, color, bg }) => {
                  const sel = matchReview.result === v;
                  return <button key={v} onClick={() => setMatchReview(r => ({ ...r, result: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? color : "#e2e2e2", background: sel ? bg : "#f9f9f9", color: sel ? color : "#4a5050" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">Opponent level?</p>
              <div className="flex gap-3">
                {[{ v: "easy", label: "Easier" }, { v: "equal", label: "Equal" }, { v: "tough", label: "Tougher" }].map(({ v, label }) => {
                  const sel = matchReview.opponent === v;
                  return <button key={v} onClick={() => setMatchReview(r => ({ ...r, opponent: v }))}
                    className="flex-1 py-3 rounded-2xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? PURPLE : "#e2e2e2", background: sel ? "#f5f3ff" : "#f9f9f9", color: sel ? PURPLE : "#4a5050" }}>{label}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">What did you do well?</p>
              <div className="flex flex-wrap gap-2">
                {["Serve","Bandeja","Smash","Volleys","Defense","Attack","Positioning","Communication","Movement","Mental strength"].map(tag => {
                  const sel = matchReview.wellDone.includes(tag);
                  return <button key={tag} onClick={() => setMatchReview(r => ({ ...r, wellDone: sel ? r.wellDone.filter(t => t !== tag) : [...r.wellDone, tag] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "#16a34a" : "#e2e2e2", background: sel ? "#f0fdf4" : "#f9f9f9", color: sel ? "#16a34a" : "#4a5050" }}>{tag}</button>;
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#4a5050] mb-3">What needs work?</p>
              <div className="flex flex-wrap gap-2">
                {["Serve","Bandeja","Smash","Volleys","Defense","Attack","Positioning","Communication","Movement","Mental strength"].map(tag => {
                  const sel = matchReview.improved.includes(tag);
                  return <button key={tag} onClick={() => setMatchReview(r => ({ ...r, improved: sel ? r.improved.filter(t => t !== tag) : [...r.improved, tag] }))}
                    className="px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "#dc2626" : "#e2e2e2", background: sel ? "#fef2f2" : "#f9f9f9", color: sel ? "#dc2626" : "#4a5050" }}>{tag}</button>;
                })}
              </div>
            </div>
            <button onClick={() => {
                try {
                  const entry = { ...matchReview, ts: new Date().toISOString() };
                  const prev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
                  localStorage.setItem("padelop:match-reviews", JSON.stringify([entry, ...prev].slice(0, 50)));
                } catch {}
                afterSave();
              }}
              className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform"
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
        <div className="h1-font relative w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden shadow-2xl"
          style={{ maxHeight: "80vh", animation: "slideUp 0.28s cubic-bezier(0.22,1,0.36,1)" }}
          onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-1"/>
          <div className="px-6 pt-3 pb-4 flex items-center justify-between">
            <div><p className="h1-headline-md text-[#1a1c1c]">Match Reviews</p><p className="text-[13px] text-[#4a5050] mt-0.5">Rate your games to track performance</p></div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 96px)" }}>
            {nothing && (
              <div className="px-6 py-12 text-center">
                <p className="text-[32px] mb-3">🎾</p>
                <p className="text-[16px] font-semibold text-[#1a1c1c]">No matches yet</p>
                <p className="text-[13px] text-[#4a5050] mt-1">Add a match to start tracking your game.</p>
              </div>
            )}
            {hasUnrated && (
              <>
                <div className="px-6 py-2 bg-[#f9f9f9]"><p className="text-[10px] font-bold uppercase tracking-widest text-[#5a7055]">Needs a rating</p></div>
                <button onClick={() => setSub("matchreview")}
                  className="w-full flex items-center gap-4 px-6 py-4 active:bg-[#f9f9f9] transition-colors"
                  style={{ borderBottom: "1px solid #f4f4f4" }}>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#f0f4ff]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 21h8M12 17v4"/><path d="M7 4H4a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6"/><path d="M17 4h3a2 2 0 0 1 2 2v2c0 3.3-2.7 6-6 6"/><path d="M7 4h10v8a5 5 0 0 1-10 0V4z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15px] font-semibold text-[#1a1c1c]">{matchData?.date ? fmtDate(matchData.date) : "Recent match"}</p>
                    <p className="text-[12px] text-[#4a5050] mt-0.5">{matchData?.time}{matchData?.club ? ` · ${matchData.club}` : ""}</p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#fff3cd] text-[#a16207] whitespace-nowrap flex-shrink-0">Rate now</span>
                </button>
              </>
            )}
            {reviews.length > 0 && (
              <>
                <div className="px-6 py-2 bg-[#f9f9f9]"><p className="text-[10px] font-bold uppercase tracking-widest text-[#5a7055]">Previous games</p></div>
                {reviews.map((rev, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: i < reviews.length - 1 ? "1px solid #f4f4f4" : "none" }}>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#f4f4f4]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill="#4a5050" stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill="#4a5050" stroke="none"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] font-semibold text-[#1a1c1c]">{fmtReviewDate(rev.ts)}</p>
                      <p className="text-[12px] text-[#4a5050] mt-0.5">{[rev.result, rev.feeling ? `Felt ${rev.feeling}` : ""].filter(Boolean).join(" · ") || "Reviewed"}</p>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#caecbc] text-[#496640] whitespace-nowrap flex-shrink-0">Rated</span>
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
  const overallScore = Math.round(computeScores(scoringData.checkIn, scoringData.hydration, scoringData.review, scoringData.nutrition, scoringData.gameDaysThisWeek, scoringData.habits).overall);

  const todayStr = todayYMD;
  let ciDone = false;
  try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); ciDone = ci?.date === todayStr; } catch {}
  let hydroDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0]; hydroDone = r?.ts.slice(0, 10) === todayStr; } catch {}
  let nutriDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:nutrition-logs") || "[]")[0]; nutriDone = r?.ts.slice(0, 10) === todayStr; } catch {}
  let reviewDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0]; reviewDone = r?.ts.slice(0, 10) === todayStr; } catch {}

  const categories = [
    { label: "Daily Check-in", sub: "Sleep · energy · soreness · hydration", color: "#4169e1", done: ciDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4169e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
      action: () => setSub("checkin") },
    { label: "Hydration", sub: "Log today's water intake", color: "#0891b2", done: hydroDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>,
      action: () => setSub("hydration") },
    { label: "Nutrition", sub: "Protein & recovery fuel", color: "#ea580c", done: nutriDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
      action: () => setSub("nutrition") },
    { label: "Review a match", sub: "Log your last match performance", color: PURPLE, done: reviewDone,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 6 2 8 0"/><circle cx="9" cy="9.5" r="0.8" fill={PURPLE} stroke="none"/><circle cx="15" cy="9.5" r="0.8" fill={PURPLE} stroke="none"/></svg>,
      action: () => setSub("matchlist") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="h1-font relative w-full max-w-lg bg-white rounded-[28px] flex flex-col overflow-hidden"
        style={{ animation: "speedDialUp 0.25s cubic-bezier(0.22,1,0.36,1)", maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#e2e2e2] mx-auto mt-4 mb-2 flex-shrink-0"/>
        {/* Nav row */}
        <div className="flex justify-around items-center px-2 pb-3 pt-1 flex-shrink-0" style={{ borderBottom: "1px solid #f0f0f0" }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={handleClose}
                className="flex flex-col items-center gap-1 px-2 py-1"
                style={{ color: active ? "#2653d4" : "#8a9096" }}>
                {item.icon ?? (
                  <span style={{ fontSize: 20, fontWeight: 700, lineHeight: "20px", letterSpacing: "-0.02em", display: "block", width: 20, textAlign: "center" }}>{overallScore}</span>
                )}
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="px-6 pt-3 pb-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[32px] font-bold leading-none text-[#1a1c1c]">{overallScore}</span>
            <span className="text-[13px] font-semibold text-[#4a5050]">Match Readiness</span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* Method picker */}
          {!logMethod && (
            <div className="px-5 pt-4 pb-3">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-3">Log something to update your score</p>
              <div className="grid grid-cols-3 gap-2.5">
                <button onClick={handleCamera} className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform" style={{ background: "#f4f6ff" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BLUE }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: BLUE }}>Camera</span>
                </button>
                <button onClick={() => uploadRef.current?.click()} className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform" style={{ background: "#f4f6ff" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BLUE }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: BLUE }}>Upload</span>
                </button>
                <button onClick={() => setLogMethod("wizard")} className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform" style={{ background: "#f4f6ff" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BLUE }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3l-4 8h6l-4 10"/><path d="M5 12h2"/><path d="M17 12h2"/><path d="M12 5v-2"/><path d="M12 21v-2"/>
                    </svg>
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: BLUE }}>Wizard</span>
                </button>
              </div>
              <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={() => {}}/>
            </div>
          )}

          {/* Wizard category list */}
          {logMethod === "wizard" && (
            <div className="px-5 pt-4 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setLogMethod(null)} className="w-7 h-7 rounded-full flex items-center justify-center active:bg-[#f0f0f0]" style={{ background: "#f4f4f6" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <p className="text-[13px] font-bold text-[#1a1c1c]">What are you logging?</p>
              </div>
              <div className="flex flex-col gap-2">
                {categories.map(cat => (
                  <button key={cat.label} onClick={cat.action}
                    className="flex items-center gap-4 px-4 py-3.5 rounded-2xl active:opacity-70 transition-opacity"
                    style={{ background: "#f9f9f9", border: "1px solid #f0f0f0" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}15` }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[14px] font-semibold text-[#1a1c1c]">{cat.label}</p>
                      <p className="text-[11px] text-[#6b7480] mt-0.5">{cat.sub}</p>
                    </div>
                    {cat.done && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#f0fdf4", color: "#16a34a" }}>Done</span>}
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
