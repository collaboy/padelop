"use client";

import { useEffect, useState } from "react";

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    }),
  });
}

async function subscribeToPush(reg: ServiceWorkerRegistration) {
  const existing = await reg.pushManager.getSubscription();
  if (existing) { await saveSubscription(existing); return; }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  await saveSubscription(sub);
}

export default function PushPrompt() {
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    if (Notification.permission === "granted") {
      navigator.serviceWorker.register("/sw.js").then(subscribeToPush).catch(() => {});
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
      const reg = await navigator.serviceWorker.register("/sw.js");
      await subscribeToPush(reg).catch(() => {});
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
        <p className="text-[13px] font-semibold text-[#1a1c1c]">Stay on track</p>
        <p className="text-[11px] text-[#6b7480]">Get reminders for check-ins and matches</p>
      </div>
      <button onClick={() => setShowing(false)} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold flex-shrink-0" style={{ background: "#f4f4f6", color: "#6b7480" }}>Later</button>
      <button onClick={allow} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white flex-shrink-0" style={{ background: "#2653d4" }}>Allow</button>
    </div>
  );
}
