"use client";

import React, { useState } from "react";

export default function PostMatch2a() {
  const [rating, setRating] = useState(4);
  const [done, setDone] = useState(false);

  return (
    <main
      className="h1-font min-h-screen flex flex-col gap-4 px-4 pt-10 pb-10"
      style={{ background: "#e2e5e9" }}
    >
      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[28px] font-bold text-[#1a1c1c] leading-tight tracking-tight">Great Game</p>
        <p className="text-[15px] text-[#8a9096] mt-1">How did it go?</p>
      </div>

      <div
        className="bg-white rounded-[24px] px-6 py-6 flex flex-col items-center gap-5"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="text-[32px] leading-none transition-transform active:scale-90"
              style={{ color: star <= rating ? "#f59e0b" : "#d1d5db" }}
            >
              ★
            </button>
          ))}
        </div>

        <button
          className="w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide text-white transition-all active:scale-[0.97]"
          style={{ background: "#2a5c2a" }}
        >
          Save
        </button>
      </div>

      <div
        className="bg-white rounded-[24px] px-6 py-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a9096] mb-4">Do This Now</p>
        <p className="text-[20px] font-bold text-[#1a1c1c] leading-snug mb-1">Wind down</p>
        <p className="text-[14px] text-[#6b7480] mb-6">5 minutes light stretching</p>
        <button
          onClick={() => setDone((d) => !d)}
          className="w-full py-4 rounded-2xl font-bold text-[15px] tracking-wide transition-all active:scale-[0.97]"
          style={{
            background: done ? "#caecbc" : "#2a5c2a",
            color: done ? "#2a5c2a" : "#fff",
          }}
        >
          {done ? "✓  Completed" : "Complete"}
        </button>
      </div>
    </main>
  );
}
