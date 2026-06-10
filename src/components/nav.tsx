"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { computeNotifications, type Notif } from "@/lib/notifications";

export default function Nav() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [profileAvatar, setProfileAvatar] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    function refreshProfile() {
      try {
        const p = JSON.parse(localStorage.getItem("padelop:profile") || "{}");
        setProfileAvatar(p.avatar ?? "");
        setProfileName(p.name ?? "");
      } catch {}
    }
    refreshProfile();
    setNotifications(computeNotifications());
    const id = setInterval(() => setNotifications(computeNotifications()), 60_000);
    window.addEventListener("storage", refreshProfile);
    return () => { clearInterval(id); window.removeEventListener("storage", refreshProfile); };
  }, []);

  return (
    <>
      <header className="vt-header fixed top-0 w-full z-50 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="flex items-center justify-between w-full px-5 md:px-12 max-w-7xl mx-auto h-16">
          {/* Left: logo */}
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "Inter, sans-serif" }}>
            {(["p","a","d","l","a"] as const).map((ch, i) => (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${5 - i}px)` }}>{ch}</span>
            ))}
            <span id="logo-circle" style={{ display: "inline-block", width: "0.55em", height: "0.55em", borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", margin: "0 0.02em 0.05em", transform: "translateY(-1px)" }} />
          </Link>

          {/* Right: profile avatar */}
          <div className="flex items-center justify-end">
            <Link href="/profile" className="relative active:scale-90 transition-transform flex items-center">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : profileName ? (
                  <span className="t-body-sm font-bold text-[#1e3a1e]">{profileName.trim()[0].toUpperCase()}</span>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="9" r="3" />
                    <path d="M6 20c0-3 2.7-5 6-5s6 2 6 5" />
                  </svg>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Notifications modal */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setNotifOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-[#1c1f23] rounded-t-[28px] overflow-hidden flex flex-col"
            style={{ fontFamily: "var(--font-hanken)", maxHeight: "70vh", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#3a3f45]" />
            </div>
            <div className="px-6 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
              <p className="t-subtitle text-[var(--text)]">Notifications</p>
              <button onClick={() => setNotifOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#272b30] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-dim)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-[#272b30]">
              {notifications.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="t-body-sm text-c-text-dim">You&apos;re all caught up.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const featured = notifications.find(n => n.featured);
                    const rest = notifications.filter(n => !n.featured);
                    return (
                      <>
                        {featured && (
                          <div className="mx-4 mb-3 mt-1 px-4 py-3.5 rounded-2xl" style={{ background: "#4169e110" }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4169e1] flex-shrink-0" />
                              <span className="t-tag text-[#4169e1]">{featured.time}</span>
                            </div>
                            <p className="t-body-sm font-semibold text-[var(--text)] leading-snug">{featured.message}</p>
                            {featured.link && <p className="t-caption font-semibold mt-1.5 text-[#4169e1]">{featured.link} →</p>}
                          </div>
                        )}
                        {rest.map((n, i) => (
                          <div key={i} className="flex items-start gap-4 px-6 py-4">
                            <span className="t-tag text-c-text-dim flex-shrink-0 w-12 pt-0.5">{n.time}</span>
                            <div className="flex-1 min-w-0">
                              <p className="t-body-sm text-[var(--text)] leading-snug">{n.message}</p>
                              {n.link && <p className="t-caption font-semibold mt-1 text-[#4169e1]">{n.link} →</p>}
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
