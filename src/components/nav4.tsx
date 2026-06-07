"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { computeScores, loadScoringData } from "@/lib/scoring";

const items = [
  {
    href: "/home8",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Matches",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Insights",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
];

export default function Nav4() {
  const pathname = usePathname();
  const [readiness, setReadiness] = useState(65);
  useEffect(() => {
    function load() {
      const d = loadScoringData();
      setReadiness(Math.round(computeScores(d.checkIn, d.hydration, d.review, d.nutrition, d.gameDaysThisWeek, d.habits, d.training).overall));
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);
  return (
    <nav
      className="fixed inset-x-0 z-[100]"
      style={{
        bottom: "env(safe-area-inset-bottom)",
        background: "#ffffff",
        borderTop: "1px solid #e8eaed",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex justify-around items-center pt-3 pb-5 px-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1"
              style={{ color: active ? "#2653d4" : "#8a9096" }}
            >
              {item.icon ?? (
                <span style={{ fontSize: 22, fontWeight: 700, lineHeight: "22px", letterSpacing: "-0.02em", display: "block", width: 22, textAlign: "center" }}>{readiness}</span>
              )}
              <span className="text-[11px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
