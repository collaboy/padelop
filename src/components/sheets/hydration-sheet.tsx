"use client";

import React, { useState, useEffect } from "react";

function readHydrationMl(): number {
  const today = new Date().toISOString().slice(0, 10);
  const LITRE_ML: Record<string, number> = { "<1L": 750, "1–1.5L": 1250, "1.5–2L": 1750, "2–2.5L": 2250, "2.5–3L": 2750, "3L+": 3000 };
  try {
    const hq = JSON.parse(localStorage.getItem("padelop:hydration-quick") || "null");
    if (hq?.date === today && typeof hq.ml === "number" && hq.ml > 0) return hq.ml;
    const logs: { ts: string; litres: string }[] = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
    const todayLog = logs.find(e => new Date(e.ts).toISOString().slice(0, 10) === today);
    if (todayLog) return LITRE_ML[todayLog.litres] ?? 0;
    const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
    if (ci?.date === today && ci?.waterOnWaking === true) return 500;
  } catch {}
  return 0;
}

function hasTodayLog(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const logs: { ts: string }[] = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]");
    return logs.some(e => new Date(e.ts).toISOString().slice(0, 10) === today);
  } catch { return false; }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HydrationSheet({ open, onClose }: Props) {
  const [ml, setMl] = useState(0);
  const [todayLogged, setTodayLogged] = useState(false);

  useEffect(() => {
    if (!open) return;
    function load() {
      setMl(readHydrationMl());
      setTodayLogged(hasTodayLog());
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

  const target = 3000;
  const pct = ml > 0 ? Math.min(ml / target, 1) : null;
  const displayMl = ml > 0 ? (ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, "")}L` : `${ml}ml`) : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full flex flex-col" style={{ background: "#f8f9fa", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85dvh", minHeight: "50dvh", animation: "mg-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mg-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ background: "#0ea5e914", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "#0ea5e940", margin: "12px auto 10px" }} />
          <div style={{ padding: "0 18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#0ea5e9" }}>Hydration</p>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0ea5e9", background: "#0ea5e920", borderRadius: 999, padding: "3px 12px" }}>{displayMl ?? "—"}</span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, padding: "16px 18px 40px" }}>
          {pct !== null && (
            <>
              <div style={{ height: 7, borderRadius: 99, background: "#f0f0f0", marginBottom: 6 }}>
                <div style={{ width: `${Math.round(pct * 100)}%`, height: "100%", borderRadius: 99, background: pct >= 1 ? "#16a34a" : "#0ea5e9", transition: "width 0.4s" }} />
              </div>
              <span style={{ fontSize: 16, color: "#9aa0a6", fontWeight: 500 }}>{Math.round(pct * 100)}% of {target / 1000}L daily target</span>
            </>
          )}
          {pct !== null && pct < 1 && (
            <p style={{ margin: "14px 0 0", fontSize: 16, color: "#0ea5e9", fontWeight: 600 }}>
              {pct === 0 ? "Start with a glass of water." :
               pct < 0.25 ? "Have a big glass right now." :
               pct < 0.5 ? "Drink up — you're less than halfway." :
               pct < 0.75 ? "Keep it going, almost there." :
               "One more glass and you're done."}
            </p>
          )}
          {!displayMl && !todayLogged && (
            <p style={{ margin: 0, fontSize: 16, color: "#9aa0a6" }}>No hydration logged today. Log from the home screen or check-in.</p>
          )}
        </div>
      </div>
    </div>
  );
}
