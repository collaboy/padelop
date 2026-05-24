"use client";

import { useState, useEffect } from "react";

const PROFILE_KEY = "padelop:profile";

type Profile = {
  name: string;
  level: string;
  position: string;
  hand: string;
  avatar: string; // base64 data URL or ""
};

const EMPTY: Profile = { name: "", level: "", position: "", hand: "", avatar: "" };

const LEVELS = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const POSITIONS = ["Left wall","Right wall","Both"];
const HANDS = ["Right","Left"];

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const p = loadProfile();
      setProfile(p ?? EMPTY);
      setSaved(false);
    }
  }, [open]);

  if (!open) return null;

  const set = (k: keyof Profile, v: string) => setProfile(p => ({ ...p, [k]: v }));

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const save = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(onClose, 600);
  };

  const canSave = profile.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[420px] bg-white rounded-[28px] shadow-2xl overflow-y-auto max-h-[88vh]"
        style={{ fontFamily: "var(--font-hanken)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#f4f4f4]">
          <p className="text-[18px] font-bold text-[var(--text)]">My Profile</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#f4f4f4]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747878" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 pt-5 pb-8 flex flex-col gap-6">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <label htmlFor="avatar-upload" className="cursor-pointer group">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#e2e2e2] group-active:opacity-80 transition-opacity flex items-center justify-center bg-[#f4f4f4]">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                )}
              </div>
            </label>
            <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            <p className="text-[12px] text-[#747878]">{profile.avatar ? "Tap photo to change" : "Add a photo (optional)"}</p>
          </div>

          {/* Name */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-2">Your name</p>
            <input
              type="text"
              value={profile.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Eddie"
              className="w-full px-4 py-3 rounded-2xl border-2 border-[#e2e2e2] text-[15px] font-semibold text-[var(--text)] outline-none focus:border-[#2653d4] transition-colors bg-[#f9f9f9] focus:bg-white"
            />
          </div>

          {/* Padel level */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-2">Padel level</p>
            <div className="grid grid-cols-5 gap-2">
              {LEVELS.map(l => {
                const sel = profile.level === l;
                return (
                  <button key={l} onClick={() => set("level", l)}
                    className="py-2.5 rounded-xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#2653d4" : "#f9f9f9", color: sel ? "#fff" : "#747878" }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred position */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-2">Preferred position</p>
            <div className="flex gap-2">
              {POSITIONS.map(p => {
                const sel = profile.position === p;
                return (
                  <button key={p} onClick={() => set("position", p)}
                    className="flex-1 py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dominant hand */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-2">Dominant hand</p>
            <div className="flex gap-2">
              {HANDS.map(h => {
                const sel = profile.hand === h;
                return (
                  <button key={h} onClick={() => set("hand", h)}
                    className="flex-1 py-2.5 rounded-xl border-2 text-[13px] font-bold transition-all active:scale-95"
                    style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                    {h}-handed
                  </button>
                );
              })}
            </div>
          </div>

          <button
            disabled={!canSave}
            onClick={save}
            className="w-full py-4 rounded-2xl text-[14px] font-bold transition-all active:scale-[0.98]"
            style={{ background: saved ? "#16a34a" : canSave ? "#2653d4" : "#e2e2e2", color: canSave ? "#fff" : "#b0b3b3" }}
          >
            {saved ? "Saved ✓" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
