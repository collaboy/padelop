"use client";

import React from "react";
import Nav2a from "@/components/nav2a";

const BREAKDOWN = [
  { label: "Hydration", value: 84, color: "#0891b2" },
  { label: "Recovery", value: 76, color: "#7c3aed" },
  { label: "Energy", value: 89, color: "#f59e0b" },
  { label: "Sleep", value: 91, color: "#2653d4" },
];

const IMPROVE = ["Drink water", "Mobility session", "Early dinner"];

export default function Insights2a() {
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
          Match Readiness
        </p>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[64px] font-bold leading-none" style={{ color: "#2653d4" }}>
            82
          </span>
          <span className="text-[28px] font-bold leading-none" style={{ color: "#2653d4" }}>
            %
          </span>
        </div>
      </div>

      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-4">
          Breakdown
        </p>
        <div className="flex flex-col gap-4">
          {BREAKDOWN.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[15px] font-medium text-[#1a1c1c]">{row.label}</span>
                <span className="text-[15px] font-bold text-[#1a1c1c]">{row.value}%</span>
              </div>
              <div className="h-[4px] rounded-full w-full" style={{ background: "#f0f0f0" }}>
                <div
                  className="h-[4px] rounded-full"
                  style={{ width: `${row.value}%`, background: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-4">
          Improve Score
        </p>
        <div className="flex flex-col gap-3">
          {IMPROVE.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "#2653d4" }}
              />
              <span className="text-[15px] font-medium text-[#1a1c1c]">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <Nav2a />
    </main>
  );
}
