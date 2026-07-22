"use client";

import React, { useState, useEffect } from "react";

const STIERS = [
  { min: 0,   label: "Beginner",  color: "#9aa0a6", grad: ["#f4f4f6", "#eaecee"] },
  { min: 5,   label: "Starter",   color: "#2653d4", grad: ["#eef2ff", "#dbe4ff"] },
  { min: 15,  label: "Grinder",   color: "#059669", grad: ["#ecfdf5", "#d1fae5"] },
  { min: 30,  label: "Dedicated", color: "#d97706", grad: ["#fffbeb", "#fde68a"] },
  { min: 60,  label: "Elite",     color: "#7c3aed", grad: ["#faf5ff", "#ede9fe"] },
  { min: 100, label: "Legend",    color: "#0ea5e9", grad: ["#f0f9ff", "#bae6fd"] },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StreakSheet({ open, onClose }: Props) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!open) return;
    function load() {
      let habitDates = new Set<string>();
      try {
        const habits: { date: string }[] = JSON.parse(localStorage.getItem("padelop:habits") || "[]");
        habitDates = new Set(habits.map(h => h.date));
      } catch {}
      const cur = new Date();
      if (!habitDates.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
      let streakCount = 0;
      while (habitDates.has(cur.toISOString().slice(0, 10))) { streakCount++; cur.setDate(cur.getDate() - 1); }
      setStreak(streakCount);
    }
    load();
    window.addEventListener("storage", load);
    window.addEventListener("padelop:sync-done", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("padelop:sync-done", load);
    };
  }, [open]);

  if (!open) return null;

  const stier = [...STIERS].reverse().find(t => streak >= t.min) ?? STIERS[0];
  const snext = STIERS[STIERS.indexOf(stier) + 1];
  const msg = streak === 0 ? "Log your first check-in to start your streak." : streak === 1 ? "Day one. Come back tomorrow to keep it going." : !snext ? "Legend status. You're in a league of your own." : `${snext.min - streak} day${snext.min - streak === 1 ? "" : "s"} to ${snext.label}.`;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ background: `${stier.color}14`, flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: `${stier.color}40`, margin: "12px auto 10px" }} />
          <div style={{ padding: "0 18px 16px" }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: stier.color }}>Streak</p>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
          <div style={{ background: `linear-gradient(145deg, ${stier.grad[0]}, ${stier.grad[1]})`, padding: "16px 20px 16px", textAlign: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: stier.color }}>{stier.label}</span>
            <p style={{ margin: "6px 0 3px", fontSize: 44, fontWeight: 800, color: stier.color, lineHeight: 1 }}>{streak}</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: stier.color, opacity: 0.7 }}>day streak</p>
            <p style={{ margin: "10px 0 0", fontSize: 16, fontWeight: 500, color: "#4b5563" }}>{msg}</p>
          </div>
          <div style={{ background: "#fff", padding: "14px 16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            {STIERS.map(t => {
              const active = t.label === stier.label, unlocked = streak >= t.min;
              return (
                <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: 3, borderRadius: 99, background: unlocked ? t.color : "#e5e7eb", opacity: unlocked ? 1 : 0.4 }} />
                  <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, color: active ? t.color : "#9aa0a6", textAlign: "center", lineHeight: 1.2, letterSpacing: "0.04em" }}>{t.label}</span>
                  <span style={{ fontSize: 9, color: "#b0b8c1", fontWeight: 500 }}>{t.min === 0 ? "0" : `${t.min}d`}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
