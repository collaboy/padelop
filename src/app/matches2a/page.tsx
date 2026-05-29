"use client";

import React from "react";
import Nav2a from "@/components/nav2a";

const PREP = [
  { time: "13:00", label: "Eat" },
  { time: "18:00", label: "Stretch" },
  { time: "20:00", label: "Pack" },
];

export default function Matches2a() {
  return (
    <main
      className="h1-font min-h-screen flex flex-col gap-4 px-4 pt-10 pb-24"
      style={{ background: "#e2e5e9" }}
    >
      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-3">
          Next Match
        </p>
        <p className="text-[22px] font-bold text-[#1a1c1c] leading-snug">Tonight</p>
        <p className="text-[18px] font-semibold mt-1" style={{ color: "#2653d4" }}>21:00</p>
      </div>

      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-4">
          Match Prep Timeline
        </p>
        <div className="flex flex-col gap-3">
          {PREP.map((row) => (
            <div key={row.time} className="flex items-center gap-3">
              <span className="text-[13px] text-[#8a9096] font-mono w-12 flex-shrink-0">{row.time}</span>
              <span className="text-[16px] font-medium text-[#1a1c1c]">{row.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="bg-white rounded-[24px] px-6 py-5 flex items-center justify-center active:opacity-70 transition-opacity w-full"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <span className="text-[16px] font-bold" style={{ color: "#2653d4" }}>Add Match +</span>
      </button>

      <Nav2a />
    </main>
  );
}
