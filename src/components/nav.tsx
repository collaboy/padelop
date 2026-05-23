"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const pct = 71;
  const [menuOpen, setMenuOpen] = useState(false);

  const items = [
    {
      label: "Things to Do Today",
      action: null as (() => void) | null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    },
    {
      label: "Things to Do This Week",
      action: null as (() => void) | null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9,16 11,18 15,14" /></svg>,
    },
    {
      label: "Add Data",
      action: null as (() => void) | null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    },
    {
      label: "Take Quiz",
      action: null as (() => void) | null,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" /></svg>,
    },
    {
      label: "Plan this week",
      action: () => {
        window.dispatchEvent(new CustomEvent("open-week-plan"));
        setMenuOpen(false);
      },
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" /></svg>,
    },
  ];

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="grid grid-cols-3 items-center w-full px-5 md:px-12 max-w-7xl mx-auto h-16">
          {/* Left: hamburger */}
          <div className="flex items-center">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex flex-col gap-1.5 p-1 active:scale-90 transition-transform"
              aria-label="Menu"
            >
              <span className="block w-5 h-0.5 bg-[var(--text)]" />
              <span className="block w-5 h-0.5 bg-[var(--text)]" />
              <span className="block w-5 h-0.5 bg-[var(--text)]" />
            </button>
          </div>

          {/* Center: title */}
          <div className="flex justify-center">
            <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>
              {"Padelop!".split("").map((char, i) => (
                <span key={i} style={{ position: "relative", top: `${-i * 1.5}px` }}>{char}</span>
              ))}
            </Link>
          </div>

          {/* Right: score arc */}
          <div className="flex justify-end">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <defs>
                <linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="24" y1="4" x2="44" y2="24">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="g2" gradientUnits="userSpaceOnUse" x1="44" y1="24" x2="24" y2="44">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
                <linearGradient id="g3" gradientUnits="userSpaceOnUse" x1="24" y1="44" x2="4" y2="24">
                  <stop offset="0%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#84cc16" />
                </linearGradient>
                <linearGradient id="g4" gradientUnits="userSpaceOnUse" x1="4" y1="24" x2="24" y2="4">
                  <stop offset="0%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <path d="M 24 4 A 20 20 0 0 1 44 24" fill="none" stroke="url(#g1)" strokeWidth="2.5" strokeLinecap="butt" />
              <path d="M 44 24 A 20 20 0 0 1 24 44" fill="none" stroke="url(#g2)" strokeWidth="2.5" strokeLinecap="butt" />
              <path d="M 24 44 A 20 20 0 0 1 4 24"  fill="none" stroke="url(#g3)" strokeWidth="2.5" strokeLinecap="butt" />
              <path d="M 4 24 A 20 20 0 0 1 24 4"   fill="none" stroke="url(#g4)" strokeWidth="2.5" strokeLinecap="butt" />
              <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--text)" fontFamily="var(--font-hanken)">{pct}%</text>
            </svg>
          </div>
        </div>
      </header>

      {/* Hamburger menu modal */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-start pt-16" onClick={() => setMenuOpen(false)}>
          <div className="w-full max-w-[320px] bg-white shadow-2xl mx-5 mt-2 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {items.map((item, i) => (
              <button
                key={item.label}
                onClick={item.action ?? undefined}
                className="w-full flex items-center gap-4 px-6 py-5 text-base font-bold text-[var(--text)] active:bg-[var(--bg)] transition-colors"
                style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <span style={{ color: "#2653d4" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
