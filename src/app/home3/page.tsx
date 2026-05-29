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

const UP_NEXT = [
  { time: "13:00", label: "Protein lunch" },
  { time: "18:00", label: "Mobility" },
  { time: "20:00", label: "Pack bag" },
  { time: "22:30", label: "Wind down" },
];

export default function Home3() {
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
      <div
        className="bg-white rounded-[24px] px-5 py-5 flex items-center gap-4 active:opacity-60 transition-opacity"
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
        <button
          onClick={() => setDone(d => !d)}
          className="flex-shrink-0 text-[12px] font-bold px-3 py-2 rounded-xl transition-all active:scale-95"
          style={{
            background: done ? "#caecbc" : "#2a5c2a",
            color: done ? "#2a5c2a" : "#fff",
          }}
        >
          {done ? "✓" : "Done"}
        </button>
      </div>

      {/* Up Next */}
      <div className="bg-white rounded-[24px] px-6 py-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-4">Up Next</p>
        <div className="flex flex-col gap-3">
          {UP_NEXT.map((item) => (
            <div key={item.time} className="flex items-center gap-3">
              <span className="text-[13px] text-[#8a9096] font-mono w-12 flex-shrink-0">{item.time}</span>
              <span className="text-[16px] font-medium text-[#1a1c1c]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

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
