"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { downloadSnapshot, importData } from "@/lib/storage";
import ProfileModal from "@/components/profile-modal";
import { computeNotifications, type Notif } from "@/lib/notifications";
import { computeScores, computeAllTimeScores, loadScoringData } from "@/lib/scoring";

export default function Nav() {
  const [pct, setPct] = useState(71);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [matchDate, setMatchDate] = useState<string>("");
  const [matchTime, setMatchTime] = useState<string>("");
  const [nowDate, setNowDate] = useState<Date | null>(null);
  const [dayType, setDayType] = useState<string>("Rest Day");
  const [profileAvatar, setProfileAvatar] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function refreshScore() {
      const data = loadScoringData();
      const today = computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek);
      setPct(today.overall);
    }
    function refreshMatch() {
      try {
        const saved = localStorage.getItem("padelop:next-match");
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        if (saved) {
          const parsed = JSON.parse(saved);
          setMatchDate(parsed.date ?? "");
          setMatchTime(parsed.time ?? "");
          if (parsed.date === today) setDayType("Game Day");
          else if (parsed.date === yesterday) setDayType("Recovery Day");
          else setDayType("Rest Day");
        } else {
          setMatchDate(""); setMatchTime("");
          setDayType("Rest Day");
        }
      } catch {}
    }
    function refreshProfile() {
      try {
        const p = JSON.parse(localStorage.getItem("padelop:profile") || "{}");
        setProfileAvatar(p.avatar ?? "");
        setProfileName(p.name ?? "");
      } catch {}
    }
    setNowDate(new Date());
    refreshScore();
    refreshMatch();
    refreshProfile();
    setNotifications(computeNotifications());
    const id = setInterval(() => {
      refreshScore();
      setNotifications(computeNotifications());
    }, 60_000);
    window.addEventListener("storage", () => { refreshScore(); refreshMatch(); });
    return () => { clearInterval(id); window.removeEventListener("storage", () => {}); };
  }, []);

  const items: { label: string; action: (() => void) | null; icon: React.ReactNode }[] = [];

  const dataItems = [
    {
      label: "My Profile",
      action: () => { setProfileOpen(true); setMenuOpen(false); },
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
    },
    {
      label: "Export my data",
      action: () => { downloadSnapshot(); setMenuOpen(false); },
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    },
    {
      label: importDone ? "Data restored ✓" : "Import backup",
      action: () => { importRef.current?.click(); },
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    },
  ];

  return (
    <>
      <header className="vt-header fixed top-0 w-full z-50 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
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
          <div className="flex justify-center items-center">
            <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "Inter, sans-serif" }}>
              {(["p","a","d","l","a"] as const).map((ch, i) => (
                <span key={i} style={{ display: "inline-block", transform: `translateY(${5 - i}px)` }}>{ch}</span>
              ))}
              <span id="logo-circle" style={{ display: "inline-block", width: "0.55em", height: "0.55em", borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", margin: "0 0.02em 0.05em", transform: "translateY(-1px)" }} />
            </Link>
          </div>

          {/* Right: profile avatar */}
          <div className="flex items-center justify-end">
            <Link href="/profile" className="relative active:scale-90 transition-transform flex items-center">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : profileName ? (
                  <span className="text-[14px] font-bold text-[#1e3a1e]">{profileName.trim()[0].toUpperCase()}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setNotifOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-[#1c1f23] rounded-[28px] overflow-hidden flex flex-col max-h-[88vh]"
            style={{ fontFamily: "var(--font-hanken)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-shrink-0">
              <p className="text-[18px] font-semibold text-[var(--text)]">Notifications</p>
              <button onClick={() => setNotifOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#272b30] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-[#272b30]">
              {notifications.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-[14px] text-[#6b7480]">You&apos;re all caught up.</p>
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
                              <span className="text-[11px] font-bold tracking-wide text-[#4169e1]">{featured.time}</span>
                            </div>
                            <p className="text-[14px] font-semibold text-[var(--text)] leading-snug">{featured.message}</p>
                            {featured.link && <p className="text-[12px] font-semibold mt-1.5 text-[#4169e1]">{featured.link} →</p>}
                          </div>
                        )}
                        {rest.map((n, i) => (
                          <div key={i} className="flex items-start gap-4 px-6 py-4">
                            <span className="text-[11px] font-semibold text-[#6b7480] flex-shrink-0 w-12 pt-0.5">{n.time}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] text-[var(--text)] leading-snug">{n.message}</p>
                              {n.link && <p className="text-[12px] font-semibold mt-1 text-[#4169e1]">{n.link} →</p>}
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

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Hidden import file input */}
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const snap = JSON.parse(reader.result as string);
              importData(snap);
              setImportDone(true);
              setMenuOpen(false);
              window.location.reload();
            } catch {
              alert("Couldn't read that file. Make sure it's a Padelop backup.");
            }
          };
          reader.readAsText(file);
          e.target.value = "";
        }}
      />

      {/* Hamburger menu modal */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-start pt-16" onClick={() => setMenuOpen(false)}>
          <div className="w-full max-w-[320px] bg-white shadow-2xl mx-5 mt-2 rounded-2xl overflow-y-auto" style={{ maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
            {items.map((item) => (
              <button
                key={item.label}
                onClick={item.action ?? undefined}
                className="w-full flex items-center gap-4 px-5 py-4 text-[15px] font-semibold text-[#1a1c1c] active:bg-[#f4f6ff] transition-colors"
                style={{ borderBottom: "1px solid #f0f0f0" }}
              >
                <span style={{ color: "#2653d4" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="px-5 py-2 bg-[#f7f8f9]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9096]">Your data</p>
            </div>
            {dataItems.map((item, i) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-4 px-5 py-4 text-[15px] font-semibold text-[#1a1c1c] active:bg-[#f4f6ff] transition-colors"
                style={{ borderBottom: i < dataItems.length - 1 ? "1px solid #f0f0f0" : "none" }}
              >
                <span style={{ color: "#6b7480" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
