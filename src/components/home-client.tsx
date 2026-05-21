"use client";

import { useState, useEffect } from "react";
import WeekStrip from "./week-strip";
import Recommendations from "./recommendations";

const STORAGE_KEY = "padelop:game-days";

export default function HomeClient() {
  const [gameDays, setGameDays] = useState<string[]>([]);
  const todayYMD = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setGameDays(JSON.parse(stored));
  }, []);

  function toggleGameDay(ymd: string) {
    setGameDays((prev) => {
      const next = prev.includes(ymd)
        ? prev.filter((d) => d !== ymd)
        : [...prev, ymd];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      <WeekStrip gameDays={gameDays} onToggle={toggleGameDay} />
      <Recommendations todayYMD={todayYMD} gameDays={gameDays} />
    </div>
  );
}
