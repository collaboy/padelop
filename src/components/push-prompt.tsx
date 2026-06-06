"use client";

import { useEffect, useState } from "react";

function msUntilTomorrow8am(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(8, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function msUntilToday8am(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(8, 0, 0, 0);
  return target.getTime() - now.getTime();
}

function hasCheckedInToday(): boolean {
  try {
    const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
    return ci?.date === new Date().toISOString().slice(0, 10);
  } catch { return false; }
}

function hasNotifiedToday(): boolean {
  try {
    return localStorage.getItem("padelop:notified-date") === new Date().toISOString().slice(0, 10);
  } catch { return false; }
}

function markNotifiedToday(): void {
  try {
    localStorage.setItem("padelop:notified-date", new Date().toISOString().slice(0, 10));
  } catch {}
}

async function notify(reg: ServiceWorkerRegistration) {
  if (hasNotifiedToday()) return;
  markNotifiedToday();
  await reg.showNotification("padla", {
    body: "Time for your morning check-in — takes 30 seconds",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "daily-checkin",
    data: { url: "/home8" },
  } as NotificationOptions);
}

function scheduleDaily(reg: ServiceWorkerRegistration) {
  const now = new Date();
  const past8 = now.getHours() >= 8;

  if (past8) {
    if (!hasCheckedInToday()) notify(reg);
    setTimeout(() => { if (!hasCheckedInToday()) notify(reg); scheduleDaily(reg); }, msUntilTomorrow8am());
  } else {
    setTimeout(() => { if (!hasCheckedInToday()) notify(reg); scheduleDaily(reg); }, msUntilToday8am());
  }
}

export default function PushPrompt() {
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return;

    if (Notification.permission === "granted") {
      navigator.serviceWorker.register("/sw.js").then(scheduleDaily).catch(() => {});
      return;
    }

    if (Notification.permission === "default") {
      const t = setTimeout(() => setShowing(true), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  async function allow() {
    setShowing(false);
    const result = await Notification.requestPermission();
    if (result === "granted") {
      navigator.serviceWorker.register("/sw.js").then(scheduleDaily).catch(() => {});
    }
  }

  if (!showing) return null;

  return (
    <div
      className="fixed left-4 right-4 z-50 bg-white rounded-2xl flex items-center gap-3 px-4 py-3"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))", boxShadow: "0 4px 24px rgba(0,0,0,0.13)" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2653d418" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2653d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#1a1c1c]">Daily reminders</p>
        <p className="text-[11px] text-[#6b7480]">Check-in prompt every morning at 8am</p>
      </div>
      <button onClick={() => setShowing(false)} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold flex-shrink-0" style={{ background: "#f4f4f6", color: "#6b7480" }}>Later</button>
      <button onClick={allow} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white flex-shrink-0" style={{ background: "#2653d4" }}>Allow</button>
    </div>
  );
}
