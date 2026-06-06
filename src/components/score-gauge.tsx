// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { computeScores, loadScoringData, type Scores } from "@/lib/scoring";

export default function ScoreGauge() {
  const [scores, setScores] = useState<Scores>({ overall: 65, recovery: 65, nutrition: 65, training: 65, wellbeing: 65 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function load() {
      const data = loadScoringData();
      setScores(computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek));
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="w-full h-3 bg-[#e2e2e2] rounded-full overflow-hidden">
      <div style={{ width: mounted ? `${scores.overall}%` : "0%", background: "#2653d4", height: "100%", borderRadius: 999, transition: "width 0.8s ease" }} />
    </div>
  );
}
