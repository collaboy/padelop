"use client";

import React from "react";

const GEAR_ITEMS = [
  { title: "Scan Shoes", subtitle: "Check sole wear" },
  { title: "Scan Grip", subtitle: "Check condition" },
  { title: "Scan Racket", subtitle: "Check visible damage" },
];

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export default function Gear2a() {
  return (
    <main
      className="h1-font min-h-screen flex flex-col gap-4 px-4 pt-10 pb-10"
      style={{ background: "#e2e5e9" }}
    >
      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[24px] font-bold text-[#1a1c1c] leading-tight tracking-tight">Check Your Gear</p>
      </div>

      <div className="flex flex-col gap-3">
        {GEAR_ITEMS.map((item) => (
          <button
            key={item.title}
            className="bg-white rounded-[24px] px-6 py-5 flex items-center justify-between active:opacity-70 transition-opacity w-full text-left"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[18px] font-bold text-[#1a1c1c]">{item.title}</span>
              <span className="text-[13px] text-[#6b7480]">{item.subtitle}</span>
            </div>
            <CameraIcon />
          </button>
        ))}
      </div>
    </main>
  );
}
