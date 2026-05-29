"use client";

import React from "react";
import Nav2a from "@/components/nav2a";

const ITEMS = [
  { title: "Hydration", subtitle: "Log water intake" },
  { title: "Energy", subtitle: "How do you feel today?" },
  { title: "Soreness", subtitle: "Rate body condition" },
  { title: "Sleep", subtitle: "Log last night" },
];

export default function Track2a() {
  return (
    <main
      className="h1-font min-h-screen flex flex-col pb-32"
      style={{ background: "#e2e5e9" }}
    >
      <p className="text-[26px] font-bold text-[#1a1c1c] px-4 pt-10 pb-4 leading-tight tracking-tight">
        What do you want to track?
      </p>

      <div className="flex flex-col gap-3 px-4">
        {ITEMS.map((item) => (
          <button
            key={item.title}
            className="bg-white rounded-[24px] px-6 py-5 flex items-center justify-between active:opacity-70 transition-opacity w-full text-left"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[18px] font-bold text-[#1a1c1c]">{item.title}</span>
              <span className="text-[13px] text-[#6b7480]">{item.subtitle}</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <Nav2a />
    </main>
  );
}
