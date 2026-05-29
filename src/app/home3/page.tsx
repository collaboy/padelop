"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Nav2a from "@/components/nav2a";

function useCountdown(matchTimeISO: string | null) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!matchTimeISO) { setLabel(""); return; }
    function tick() {
      const diff = new Date(matchTimeISO!).getTime() - Date.now();
      if (diff <= 0) { setLabel("Match time!"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(`Match in ${h}h ${m}m`);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [matchTimeISO]);
  return label;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}


export default function Home3() {
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const countdown = useCountdown(matchTime);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) setMatchTime(`${m.date}T${m.time}`);
      }
    } catch {}
  }, []);

  return (
    <main
      className="h1-font min-h-screen flex flex-col gap-4 px-4 pt-4 pb-44"
      style={{ background: "#e2e5e9" }}
    >
      {/* Greeting */}
      <div className="bg-white rounded-[24px] px-6 py-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p className="text-[28px] font-bold text-[#1a1c1c] leading-tight tracking-tight">
          {greeting()} Eddie
        </p>
        {countdown && (
          <p className="text-[15px] font-medium text-[#6b7480] mt-1">{countdown}</p>
        )}
      </div>

      {/* Do This Now */}
      <button
        onClick={() => setModalOpen(true)}
        className="bg-white rounded-[24px] px-5 py-5 flex items-center gap-4 active:opacity-60 transition-opacity text-left w-full"
        style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)", border: "2px solid #f59e0b" }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b18" }}>
          <div className="w-3.5 h-3.5 rounded-full animate-breathe" style={{ background: "#f59e0b", ["--glow" as string]: "#f59e0b" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055] mb-1">Do this now</p>
          <p className="text-[20px] font-bold text-[#1a1c1c] leading-tight">Drink 500ml water</p>
          <p className="text-[13px] text-[#4a5050] mt-1 leading-snug">Before anything else this morning</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      {/* Explanatory modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white rounded-[28px] px-6 py-7"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b18" }}>
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#5a7055]">Do this now</p>
                <p className="text-[18px] font-bold text-[#1a1c1c] leading-tight">Drink 500ml water</p>
              </div>
            </div>
            <p className="text-[15px] text-[#4a5050] leading-relaxed mb-3">
              Your body loses water overnight — even mild dehydration affects energy, focus, and physical output. Drinking 500ml first thing kicks off your hydration for the day.
            </p>
            <p className="text-[13px] font-semibold text-[#8a9096]">→ Affects: Hydration · Recovery · Energy</p>
            <button
              onClick={() => setModalOpen(false)}
              className="mt-6 w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:opacity-70 transition-opacity"
              style={{ background: "#2653d4" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}


<Link
        href="/insights2a"
        className="bg-white rounded-[24px] px-6 py-5 flex items-center justify-between active:opacity-70 transition-opacity"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <span className="text-[16px] font-bold text-[#1a1c1c]">View Optimization</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </Link>

      <Link
        href="/track2a"
        className="bg-white rounded-[24px] px-6 py-5 flex items-center justify-between active:opacity-70 transition-opacity"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <span className="text-[16px] font-bold text-[#1a1c1c]">Track Something</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </Link>

      <Link
        href="/matches2a"
        className="bg-white rounded-[24px] px-6 py-5 flex items-center justify-between active:opacity-70 transition-opacity"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <span className="text-[16px] font-bold text-[#1a1c1c]">Match Log</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </Link>

      <Nav2a />
    </main>
  );
}
