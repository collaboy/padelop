"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { computeNotifications, type Notif } from "@/lib/notifications";



export default function Nav() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
      <header className="vt-header fixed top-0 w-full z-[70] bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="flex items-center justify-between w-full px-5 md:px-12 max-w-7xl mx-auto h-16">
          {/* Left: logo */}
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "Inter, sans-serif" }}>
            {(["p","a","d","l","a"] as const).map((ch, i) => (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${5 - i}px)` }}>{ch}</span>
            ))}
            <span id="logo-circle" style={{ display: "inline-block", width: "0.55em", height: "0.55em", borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", margin: "0 0.02em 0.05em", transform: "translateY(-1px)" }} />
          </Link>

          {/* Right: profile avatar — opens hamburger menu */}
          <button onClick={() => setMenuOpen(true)} className="relative active:scale-90 transition-transform flex items-center" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#f4f4f6" }}>
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
          </button>
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

      {/* Hamburger menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[80] flex items-end" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-[#1c1f23] rounded-t-[28px] overflow-hidden"
            style={{ fontFamily: "var(--font-hanken)", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#3a3f45]" />
            </div>
            {/* Profile header */}
            <div className="flex items-center gap-3 px-6 pt-4 pb-5">
              <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#2a2f35" }}>
                {profileAvatar ? (
                  <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
                ) : profileName ? (
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{profileName.trim()[0].toUpperCase()}</span>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="1.4" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3"/><path d="M6 20c0-3 2.7-5 6-5s6 2 6 5"/></svg>
                )}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{profileName || "Player"}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#6b7480" }}>padla</p>
              </div>
            </div>
            <div style={{ height: 1, background: "#272b30", margin: "0 0 8px" }} />
            {/* Menu links */}
            {[
              { label: "My Profile", href: "/profile", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.1-7 7-7s7 3 7 7"/></svg> },
              { label: "Today's Schedule", href: "/schedule", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { label: "Matches", href: "/matches", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg> },
              { label: "Settings", href: "/settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 px-6 py-4 active:bg-[#272b30] transition-colors"
                style={{ textDecoration: "none" }}
              >
                <span style={{ color: "#9aa0a6" }}>{item.icon}</span>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>{item.label}</span>
                <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a3f45" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            ))}
            <div style={{ height: 16 }} />
          </div>
        </div>
      )}

    </>
  );
}
