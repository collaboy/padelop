"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { saveUpcomingMatch, saveNutritionToDb, saveNoteToDb, saveMatchReview, saveGearToDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { startNavLoad } from "@/lib/nav-events";

type StoredMatch = { date: string; time: string; club: string; court: string; player_1: string; player_2: string; player_3: string; player_4: string };

function getMatchList(): StoredMatch[] {
  try {
    const raw = localStorage.getItem("padelop:upcoming-matches");
    if (raw) return JSON.parse(raw);
    const single = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
    if (single?.date) return [single];
  } catch {}
  return [];
}

function saveMatchListLocal(list: StoredMatch[]) {
  const today = new Date().toISOString().slice(0, 10);
  const future = list.filter(m => m.date >= today && m.time).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  try {
    localStorage.setItem("padelop:upcoming-matches", JSON.stringify(future));
    if (future.length > 0) localStorage.setItem("padelop:next-match", JSON.stringify(future[0]));
    else localStorage.removeItem("padelop:next-match");
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export default function Fab() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const prevPathnameRef = useRef(pathname);

  const [hiddenForModal, setHiddenForModal] = useState(false);
  const [tileScrolled, setTileScrolled] = useState(false);
  const tileRowRef = useRef<HTMLDivElement>(null);
  const [logPickerOpen, setLogPickerOpen] = useState(false);
  const [logPickerSub, setLogPickerSub] = useState<"nutrition" | "matchreview" | "upload-confirm" | null>(null);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [insertUploadLoading, setInsertUploadLoading] = useState(false);
  const [insertUploadCategory, setInsertUploadCategory] = useState<string | null>(null);
  const [smartUploadResult, setSmartUploadResult] = useState<{ category: string; label: string; confidence: string; data: Record<string, string> } | null>(null);
  const [smartUploadError, setSmartUploadError] = useState<string | null>(null);
  const [mealTime, setMealTime] = useState("");
  const [mealText, setMealText] = useState("");
  const [mealsToday, setMealsToday] = useState<{ id: string; time: string; description: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [checkinDone, setCheckinDone] = useState(() => {
    try {
      const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
      return ml?.date === new Date().toISOString().slice(0, 10);
    } catch { return false; }
  });

  const insertUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      closeAll();
    }
  }, [pathname]);

  useEffect(() => {
    const onStorage = () => {
      try {
        const ml = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null");
        setCheckinDone(ml?.date === new Date().toISOString().slice(0, 10));
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let prev = false;
    const check = () => {
      // Detect any visible fixed overlay (modal/sheet) by computed style.
      // z-index 100–8999 covers modals; 9000+ is the "open on phone" layout div.
      let found = false;
      for (const el of Array.from(document.querySelectorAll('div'))) {
        const s = window.getComputedStyle(el);
        if (s.position !== 'fixed') continue;
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const z = parseInt(s.zIndex, 10);
        if (isNaN(z) || z < 100 || z >= 9000) continue;
        found = true; break;
      }
      if (found !== prev) { prev = found; setHiddenForModal(found); }
    };
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    const id = setInterval(check, 200);
    return () => { obs.disconnect(); clearInterval(id); };
  }, []);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setIsAdmin((data.user?.email ?? "").toLowerCase() === "evanderbijl@hotmail.com");
    });
  }, []);

  useEffect(() => {
    function handleOpen() { setSmartUploadError(null); setFabExpanded(false); setLogPickerOpen(true); }
    function handleAddMatch() {
      setSmartUploadResult({ category: "match_schedule", label: "Schedule a match", confidence: "high", data: { date: "", time: "", club: "", court: "", player_1: "", player_2: "", player_3: "", player_4: "" } });
      setLogPickerSub("upload-confirm");
    }
    window.addEventListener("padelop:open-fab", handleOpen);
    window.addEventListener("padelop:add-match", handleAddMatch);
    return () => { window.removeEventListener("padelop:open-fab", handleOpen); window.removeEventListener("padelop:add-match", handleAddMatch); };
  }, []);

  function saveMealEntry(time: string, description: string) {
    if (!description.trim()) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const entry = { id: Date.now().toString(), date: todayKey, time, description: description.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]");
      localStorage.setItem("padelop:meal-log", JSON.stringify([...existing, entry]));
      window.dispatchEvent(new Event("storage"));
    } catch {}
    saveNutritionToDb({ date: todayKey, meal_type: time, description: description.trim() });
    setMealsToday(prev => [...prev, entry]);
    setMealText("");
  }

  function saveNote(text: string) {
    if (!text.trim()) return;
    const date = new Date().toISOString().slice(0, 10);
    const entry = { id: Date.now().toString(), date, ts: new Date().toISOString(), text: text.trim() };
    try {
      const existing = JSON.parse(localStorage.getItem("padelop:notes") || "[]");
      localStorage.setItem("padelop:notes", JSON.stringify([entry, ...existing].slice(0, 200)));
      window.dispatchEvent(new Event("storage"));
    } catch {}
    saveNoteToDb({ date, body: text.trim() });
    setNoteText("");
  }

  function closeAll() {
    setLogPickerOpen(false);
    setLogPickerSub(null);
    setFabExpanded(false);
    setSmartUploadError(null);
    setTileScrolled(false);
  }

  const inputSt: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e8eaed", fontSize: "clamp(14px, 3.6vw, 16px)", color: "#1a1c1c", outline: "none", fontFamily: "inherit", background: "#f8f9fa", boxSizing: "border-box" };
  const labelSt: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a9096", marginBottom: 4, display: "block" };

  if (pathname === "/settings") return null;

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => { setSmartUploadError(null); setFabExpanded(false); setLogPickerOpen(true); }}
        className="fixed z-[30] active:scale-90 transition-transform"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.5rem", width: 54, height: 54, borderRadius: 27, background: "#ffffff", boxShadow: "0 4px 16px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08)", visibility: hiddenForModal ? "hidden" : undefined, pointerEvents: hiddenForModal ? "none" : undefined }}
        aria-label="Add"
      >
      </button>

      {/* Always-mounted file input */}
      <input
        ref={insertUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          setInsertUploadLoading(true);
          try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const body: Record<string, string> = { image: base64, mediaType: file.type };
            if (insertUploadCategory) body.forceCategory = insertUploadCategory;
            // Hint the classifier if the user has a recent match (today or yesterday)
            try {
              const todayStr = new Date().toISOString().slice(0, 10);
              const yStr = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
              const stored: StoredMatch[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
              const nextRaw: StoredMatch | null = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
              const hasRecent = stored.some(m => m.date === todayStr || m.date === yStr)
                || (nextRaw?.date === todayStr || nextRaw?.date === yStr);
              if (hasRecent) body.hint = "post-match";
            } catch {}
            const res = await fetch("/api/classify-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const result = await res.json();
            if (!res.ok || result.error) {
              setSmartUploadError(result.message || "Could not read the image.");
            } else {
              setSmartUploadResult(result);
              setLogPickerSub("upload-confirm");
              setLogPickerOpen(false);
            }
          } catch {
            setSmartUploadError("Upload failed. Please try again.");
          }
          setInsertUploadLoading(false);
          setInsertUploadCategory(null);
          if (insertUploadRef.current) insertUploadRef.current.value = "";
        }}
      />

      {/* Log picker modal */}
      {logPickerOpen && (
        <div className="fixed inset-0 z-[200] flex items-end" onClick={closeAll} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full rounded-t-[28px] shadow-2xl" style={{ background: "#f0f1f4", animation: "sheetUp 0.3s cubic-bezier(0.22,1,0.36,1)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "85dvh", paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>

            <div style={{ overflowY: "auto", minHeight: 0 }}>
              <div style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: fabExpanded ? 8 : 10 }}>

                {smartUploadError && (
                  <div style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 12, padding: "10px 14px" }}>
                    <p style={{ fontSize: 14, color: "#dc2626", margin: 0 }}>{smartUploadError}</p>
                  </div>
                )}

                {/* Top row — Home, My Game, +, [Settings — swipe left to reveal] */}
                <div ref={tileRowRef} onScroll={e => setTileScrolled((e.currentTarget.scrollLeft) > 30)} style={{ overflowX: "scroll", scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
                  <div style={{ display: "flex", gap: 10 }}>
                    {([
                      { label: "Home", action: () => { startNavLoad(); router.push("/home8"); }, icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                      { label: "My Game", action: () => { if (pathname.startsWith("/my-game")) { setLogPickerOpen(false); return; } startNavLoad(); router.push("/my-game"); }, icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><g transform="rotate(-45, 12, 12)"><circle cx="12" cy="8" r="6.5"/><path d="M10.5 14.2 L10.5 20 Q12 22 13.5 20 L13.5 14.2"/><line x1="10.5" y1="18" x2="13.5" y2="18"/><circle cx="12" cy="6.5" r="0.9" fill="#6b7480" stroke="none"/><circle cx="9.8" cy="9" r="0.9" fill="#6b7480" stroke="none"/><circle cx="14.2" cy="9" r="0.9" fill="#6b7480" stroke="none"/><circle cx="12" cy="11.5" r="0.9" fill="#6b7480" stroke="none"/></g></svg> },
                      { label: "Log", action: () => setFabExpanded(v => !v), icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, active: fabExpanded },
                      { label: "Settings", action: () => { closeAll(); startNavLoad(); router.push("/settings"); }, icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                    ] as { label: string; action: () => void; icon: React.ReactNode; active?: boolean }[]).map(({ label, action, icon, active }) => (
                      <button key={label} onClick={action} className="active:scale-95 transition-transform"
                        style={{ flex: "0 0 calc((100vw - 52px) / 3.5)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: "50%", background: active ? "#e8e9ec" : "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          {icon}
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#9aa5b0", letterSpacing: "0.01em" }}>{label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Log manually expanded */}
                <div style={{ overflow: "hidden", maxHeight: fabExpanded ? 300 : 0, transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 10 }}>
                    <button
                      onClick={() => { setSmartUploadResult({ category: "match_schedule", label: "Schedule a match", confidence: "high", data: { date: "", time: "", club: "", court: "", player_1: "", player_2: "", player_3: "", player_4: "" } }); setLogPickerSub("upload-confirm"); setLogPickerOpen(false); }}
                      className="active:scale-95 transition-transform"
                      style={{ background: "#ffffff", border: "none", borderRadius: "50%", padding: "14px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", aspectRatio: "1/1", width: "100%" }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1c1c", margin: 0, lineHeight: 1.2 }}>Match</p>
                    </button>
                    <button
                      onClick={() => { if (!checkinDone) { window.dispatchEvent(new CustomEvent("padelop:open-checkin")); setLogPickerOpen(false); setFabExpanded(false); } }}
                      className="active:scale-95 transition-transform"
                      style={{ background: "#ffffff", border: "none", borderRadius: "50%", padding: "14px", cursor: checkinDone ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", aspectRatio: "1/1", width: "100%", position: "relative", opacity: checkinDone ? 0.5 : 1 }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1c1c", margin: 0, lineHeight: 1.2 }}>Check-in</p>
                      {checkinDone && (
                        <div style={{ position: "absolute", top: 10, right: 10 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Food sub-modal */}
            {logPickerSub === "nutrition" && (
              <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setLogPickerSub(null)}>
                <div className="fixed inset-0 bg-black/20" />
                <div className="relative w-full bg-white rounded-t-[24px] shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
                  <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
                  <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <p style={{ fontSize: "clamp(18px, 4.6vw, 22px)", fontWeight: 800, color: "#1a1c1c", margin: 0 }}>Food &amp; Snacks</p>
                      <input type="time" value={mealTime || nowTimeStr()} onChange={e => setMealTime(e.target.value)} onClick={() => { if (!mealTime) setMealTime(nowTimeStr()); }} style={{ padding: "4px 8px", borderRadius: 8, border: "1.5px solid #e8eaed", fontSize: "clamp(13px, 3.4vw, 15px)", color: "#6b7480", outline: "none", background: "#f8f9fa" }} />
                    </div>
                    <button onClick={() => setLogPickerSub(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ padding: "12px 20px 20px" }}>
                    <textarea value={mealText} onChange={e => setMealText(e.target.value)} placeholder="What are you actually eating?" rows={4} autoFocus style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: "clamp(16px, 4.1vw, 19px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
                    <button onClick={() => saveMealEntry(mealTime || nowTimeStr(), mealText)} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: mealText.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: mealText.trim() ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 17px)", fontWeight: 700, color: mealText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
                    {mealsToday.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 16 }}>
                        {mealsToday.map(m => (
                          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            <span style={{ fontSize: "clamp(11px, 2.8vw, 14px)", fontWeight: 600, color: "#b0b8c1", flexShrink: 0 }}>{m.time}</span>
                            <span style={{ fontSize: "clamp(13px, 3.4vw, 16px)", color: "#6b7480", lineHeight: 1.4 }}>{m.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Note sub-modal */}
            {logPickerSub === "matchreview" && (
              <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setLogPickerSub(null)}>
                <div className="fixed inset-0 bg-black/20" />
                <div className="relative w-full bg-white rounded-t-[24px] shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={e => e.stopPropagation()}>
                  <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
                  <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: "clamp(18px, 4.6vw, 22px)", fontWeight: 800, color: "#1a1c1c", margin: 0 }}>Add a note</p>
                    <button onClick={() => setLogPickerSub(null)} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ padding: "12px 20px 20px" }}>
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What&apos;s on your mind?" rows={4} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e8eaed", fontSize: "clamp(16px, 4.1vw, 19px)", color: "#1a1c1c", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
                    <button onClick={() => { saveNote(noteText); setLogPickerSub(null); }} style={{ marginTop: 8, padding: "10px 22px", borderRadius: 999, background: noteText.trim() ? "#2653d4" : "#e8eaed", border: "none", cursor: noteText.trim() ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 17px)", fontWeight: 700, color: noteText.trim() ? "#fff" : "#b0b8c1" }}>Save</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Upload confirm modal */}
      {logPickerSub === "upload-confirm" && smartUploadResult && (() => {
        const { category, label, data } = smartUploadResult;
        const categoryMeta: Record<string, { title: string; color: string }> = {
          match_schedule: { title: "Match schedule", color: "#2653d4" },
          meal:           { title: "Meal detected",  color: "#16a34a" },
          gear:           { title: "Gear identified", color: "#7c3aed" },
          match_result:   { title: "Match result",   color: "#ea580c" },
          unknown:        { title: "Couldn't identify", color: "#8a9096" },
        };
        const meta = categoryMeta[category] ?? categoryMeta.unknown;
        const updateData = (key: string, val: string) =>
          setSmartUploadResult(r => r ? { ...r, data: { ...r.data, [key]: val } } : r);
        const canConfirm = category !== "match_schedule" || (!!data.date && !!data.time);

        const handleConfirm = () => {
          if (category === "match_schedule") {
            const matchData: StoredMatch = { date: data.date ?? "", time: data.time ?? "", club: data.club ?? "", court: data.court ?? "", player_1: data.player_1 ?? "", player_2: data.player_2 ?? "", player_3: data.player_3 ?? "", player_4: data.player_4 ?? "" };
            saveMatchListLocal([...getMatchList(), matchData]);
            saveUpcomingMatch(matchData);
            window.dispatchEvent(new CustomEvent("padelop:match-added", { detail: matchData }));
          } else if (category === "meal") {
            saveMealEntry(nowTimeStr(), data.description ?? label);
          } else if (category === "match_result") {
            // Find a recent match to link the result to (today or yesterday)
            let linkedMatch: StoredMatch | null = null;
            try {
              const todayStr = new Date().toISOString().slice(0, 10);
              const yStr = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
              const stored: StoredMatch[] = JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]");
              linkedMatch = stored.find(m => m.date === todayStr || m.date === yStr) ?? null;
              if (!linkedMatch) {
                const nextRaw: StoredMatch | null = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
                if (nextRaw?.date === todayStr || nextRaw?.date === yStr) linkedMatch = nextRaw;
              }
            } catch {}
            const entry = { ts: new Date().toISOString(), feeling: "", result: data.result ?? "", opponent: data.opponent_names ?? "", energy: "", wellDone: [] as string[], improved: [] as string[] };
            const prev = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
            localStorage.setItem("padelop:match-reviews", JSON.stringify([entry, ...prev].slice(0, 50)));
            window.dispatchEvent(new Event("storage"));
            saveMatchReview({ ts: entry.ts, result: entry.result, opponentNames: entry.opponent, matchDate: linkedMatch?.date, matchTime: linkedMatch?.time });
          } else if (category === "gear") {
            saveGearToDb({ type: data.type || "other", name: data.name || data.brand || "" });
          }
          setLogPickerSub(null); setSmartUploadResult(null);
        };

        const handleEditManually = () => {
          if (category === "meal") {
            setMealText(data.description ?? label); setLogPickerSub("nutrition"); setSmartUploadResult(null);
          } else {
            setLogPickerSub(null); setSmartUploadResult(null);
          }
        };

        return (
          <div className="fixed inset-0 z-[300] flex items-end" onClick={() => { setLogPickerSub(null); setSmartUploadResult(null); }}>
            <div className="fixed inset-0 bg-black/20" />
            <div className="relative w-full bg-white rounded-t-[24px] shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)", maxHeight: "82vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[#e0e0e0]" /></div>
              <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 6, background: meta.color + "18", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{meta.title}</span>
                  </span>
                  <p style={{ fontSize: "clamp(15px, 3.9vw, 18px)", fontWeight: 700, color: "#1a1c1c", margin: 0, lineHeight: 1.3 }}>{label}</p>
                </div>
                <button onClick={() => { setLogPickerSub(null); setSmartUploadResult(null); }} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7480" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {(category === "match_schedule" || category === "match_result") && (() => {
                const reviews: { ts: string }[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]"); } catch { return []; } })();
                const reviewedDates = new Set(reviews.map((r: { ts: string; matchDate?: string }) => r.matchDate ?? r.ts?.slice(0, 10)).filter(Boolean));
                const upcoming: StoredMatch[] = (() => { try { return JSON.parse(localStorage.getItem("padelop:upcoming-matches") || "[]"); } catch { return []; } })();
                const nextRaw: StoredMatch | null = (() => { try { return JSON.parse(localStorage.getItem("padelop:next-match") || "null"); } catch { return null; } })();
                const seen = new Set<string>();
                const unrated = [...upcoming, ...(nextRaw ? [nextRaw] : [])].filter(m => {
                  if (!m.date || !m.time || seen.has(m.date)) return false;
                  seen.add(m.date);
                  return new Date(`${m.date}T${m.time}:00`).getTime() < Date.now() && !reviewedDates.has(m.date);
                });
                if (unrated.length === 0) return null;
                return (
                  <div style={{ padding: "8px 20px 4px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em", textTransform: "uppercase" }}>Needs rating</p>
                    {unrated.map((m, i) => (
                      <button key={i} onClick={() => { window.dispatchEvent(new Event("padelop:open-matchreview")); setLogPickerSub(null); setSmartUploadResult(null); }} style={{ width: "100%", padding: "11px 14px", borderRadius: 12, background: "#f0f4ff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a1c1c" }}>{new Date(m.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                          <p style={{ margin: "1px 0 0", fontSize: 12, color: "#6b7480" }}>{m.time}{m.club ? ` · ${m.club}` : ""}</p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#2653d4", background: "#dce8ff", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>Rate now</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
              {(category === "match_schedule" || category === "match_result") && (
                <div style={{ padding: "12px 20px 2px" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#8a9096", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {category === "match_schedule" ? "Schedule a match" : "Log result"}
                  </p>
                </div>
              )}
              <div style={{ padding: "10px 20px 4px" }}>
                <button
                  onClick={() => { setInsertUploadCategory(category); insertUploadRef.current?.click(); }}
                  disabled={insertUploadLoading}
                  style={{ width: "100%", padding: "13px 16px", borderRadius: 14, background: "#2653d4", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: insertUploadLoading ? 0.6 : 1 }}
                >
                  {insertUploadLoading ? (
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  )}
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
                    {insertUploadLoading ? "Reading…" : "Upload screenshot"}
                  </span>
                </button>
              </div>

              {/* Editable fields */}
              <div style={{ padding: "12px 20px 4px" }}>
                {category === "match_schedule" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelSt}>Date</label>
                        <div style={{ position: "relative" }}>
                          <div style={{ ...inputSt, color: data.date ? "#1a1c1c" : "#b0b5ba", minHeight: 38, display: "flex", alignItems: "center" }}>{data.date ? new Date(data.date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Pick date"}</div>
                          <input type="date" value={data.date ?? ""} onChange={e => updateData("date", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%" }} />
                        </div>
                      </div>
                      <div>
                        <label style={labelSt}>Time</label>
                        <div style={{ position: "relative" }}>
                          <div style={{ ...inputSt, color: data.time ? "#1a1c1c" : "#b0b5ba", minHeight: 38, display: "flex", alignItems: "center" }}>{data.time || "Pick time"}</div>
                          <input type="time" value={data.time ?? ""} onChange={e => updateData("time", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%" }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={labelSt}>Club</label><input type="text" value={data.club ?? ""} onChange={e => updateData("club", e.target.value)} style={inputSt} placeholder="Club name" /></div>
                      <div><label style={labelSt}>Court</label><input type="text" value={data.court ?? ""} onChange={e => updateData("court", e.target.value)} style={inputSt} placeholder="Court #" /></div>
                    </div>
                    <div>
                      <label style={labelSt}>Players</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(["player_1","player_2","player_3","player_4"] as const).map((k, i) => (
                          <input key={k} type="text" value={data[k] ?? ""} onChange={e => updateData(k, e.target.value)} style={inputSt} placeholder={`Player ${i + 1}${i === 0 ? " (you)" : ""}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {category === "meal" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelSt}>What you ate</label>
                      <textarea value={data.description ?? ""} onChange={e => updateData("description", e.target.value)} rows={3} style={{ ...inputSt, resize: "none", lineHeight: 1.5 }} />
                    </div>
                    <div>
                      <label style={labelSt}>Meal type</label>
                      <select value={data.meal_type ?? ""} onChange={e => updateData("meal_type", e.target.value)} style={inputSt}>
                        <option value="">Select…</option>
                        {["breakfast","lunch","dinner","snack","pre-match","post-match"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {category === "gear" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelSt}>Type</label>
                      <select value={data.type ?? ""} onChange={e => updateData("type", e.target.value)} style={inputSt}>
                        <option value="">Select…</option>
                        {["racket","shoes","bag","other"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div><label style={labelSt}>Brand</label><input type="text" value={data.brand ?? ""} onChange={e => updateData("brand", e.target.value)} style={inputSt} placeholder="Brand name" /></div>
                    <div><label style={labelSt}>Name / Model</label><input type="text" value={data.name ?? ""} onChange={e => updateData("name", e.target.value)} style={inputSt} placeholder="Model or description" /></div>
                  </div>
                )}
                {category === "match_result" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelSt}>Result</label>
                      <select value={data.result ?? ""} onChange={e => updateData("result", e.target.value)} style={inputSt}>
                        <option value="">Select…</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="draw">Draw</option>
                      </select>
                    </div>
                    <div><label style={labelSt}>Score</label><input type="text" value={data.score ?? ""} onChange={e => updateData("score", e.target.value)} style={inputSt} placeholder="e.g. 6-3, 7-5" /></div>
                    <div><label style={labelSt}>Opponents</label><input type="text" value={data.opponent_names ?? ""} onChange={e => updateData("opponent_names", e.target.value)} style={inputSt} placeholder="Opponent names" /></div>
                  </div>
                )}
                {category === "unknown" && (
                  <p style={{ fontSize: "clamp(14px, 3.6vw, 16px)", color: "#6b7480", lineHeight: 1.5, margin: 0 }}>
                    We couldn&apos;t identify a category for this image. Try uploading a match schedule screenshot, a meal photo, gear, or a match result scoreboard.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {category !== "unknown" && (
                  <button onClick={handleConfirm} disabled={!canConfirm} style={{ padding: "13px 20px", borderRadius: 999, background: canConfirm ? meta.color : "#e8eaed", border: "none", cursor: canConfirm ? "pointer" : "default", fontSize: "clamp(14px, 3.6vw, 16px)", fontWeight: 700, color: canConfirm ? "#fff" : "#b0b8c1", width: "100%" }}>
                    {category === "match_schedule" ? "Save match" : category === "meal" ? "Log meal" : category === "match_result" ? "Save result" : "Save"}
                  </button>
                )}
                {category !== "gear" && category !== "match_result" && (
                  <button onClick={handleEditManually} style={{ padding: "10px 20px", borderRadius: 999, background: "none", border: "1.5px solid #e8eaed", cursor: "pointer", fontSize: "clamp(13px, 3.4vw, 15px)", fontWeight: 600, color: "#6b7480", width: "100%" }}>
                    {category === "unknown" ? "Enter manually" : "Edit manually"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
