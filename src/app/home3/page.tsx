"use client";

import React, { useState, useEffect, useRef } from "react";
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

const WIZARD_CATEGORIES = ["Check-in", "Hydration", "Nutrition", "Match Review"];

export default function Home3() {
  const [matchTime, setMatchTime] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [logMethod, setLogMethod] = useState<"camera" | "upload" | "wizard" | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
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

  function handleCamera() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.click();
    setFabOpen(false);
    setLogMethod(null);
  }

  function handleUpload() {
    uploadRef.current?.click();
    setFabOpen(false);
    setLogMethod(null);
  }

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
        className="bg-white rounded-[24px] px-6 py-6 flex items-center gap-5 active:opacity-60 transition-opacity text-left w-full"
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

      {/* Do This Now modal — homepage schedule style */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="h1-font relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden max-h-[88vh] overflow-y-auto"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4" style={{ background: "#f59e0b18" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#f59e0b" }}>Today&apos;s Schedule</p>
              </div>
              <h3 className="text-[22px] font-bold text-[#1a1c1c] leading-tight">Wake up &amp; hydrate</h3>
              <p className="text-[13px] text-[#2c3235] mt-0.5">Drink 500ml water</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[15px] text-[#2c3235] leading-relaxed">
                Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration.
              </p>
            </div>
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

      {/* Hidden upload input */}
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" />

      {/* FAB */}
      <button
        onClick={() => { setFabOpen(true); setLogMethod(null); }}
        className="fixed z-40 flex items-center justify-center rounded-full shadow-lg active:opacity-80 transition-opacity"
        style={{
          width: 56,
          height: 56,
          background: "#2653d4",
          bottom: "calc(5rem + 56px + env(safe-area-inset-bottom))",
          right: "1.25rem",
        }}
        aria-label="Log something"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* FAB modal */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          onClick={() => { setFabOpen(false); setLogMethod(null); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white rounded-[28px] px-6 py-7"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            {logMethod === "wizard" ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <button
                    onClick={() => setLogMethod(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <p className="text-[17px] font-bold text-[#1a1c1c]">Wizard</p>
                </div>
                <div className="flex flex-col gap-2">
                  {WIZARD_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      className="w-full text-left px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-[#1a1c1c] active:opacity-60 transition-opacity"
                      style={{ background: "#f4f6ff" }}
                      onClick={() => { setFabOpen(false); setLogMethod(null); }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-[18px] font-bold text-[#1a1c1c] mb-1">Log something</p>
                <p className="text-[13px] text-[#8a9096] mb-5">to update your score</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleCamera}
                    className="flex flex-col items-center gap-2 py-5 rounded-2xl active:opacity-60 transition-opacity"
                    style={{ background: "#f4f6ff" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className="text-[12px] font-semibold text-[#2653d4]">Camera</span>
                  </button>
                  <button
                    onClick={handleUpload}
                    className="flex flex-col items-center gap-2 py-5 rounded-2xl active:opacity-60 transition-opacity"
                    style={{ background: "#f4f6ff" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="text-[12px] font-semibold text-[#2653d4]">Upload</span>
                  </button>
                  <button
                    onClick={() => setLogMethod("wizard")}
                    className="flex flex-col items-center gap-2 py-5 rounded-2xl active:opacity-60 transition-opacity"
                    style={{ background: "#f4f6ff" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-[12px] font-semibold text-[#2653d4]">Wizard</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
