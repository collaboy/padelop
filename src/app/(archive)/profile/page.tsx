"use client";

import { useState, useEffect } from "react";

const PROFILE_KEY = "padelop:profile";

type Profile = {
  name: string;
  level: string;
  position: string;
  hand: string;
  avatar: string;
};

const EMPTY: Profile = { name: "", level: "", position: "", hand: "", avatar: "" };
const LEVELS = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const POSITIONS = ["Left wall","Right wall","Both"];
const HANDS = ["Right","Left"];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
  }, []);

  const set = (k: keyof Profile, v: string) => {
    setSaved(false);
    setProfile(p => ({ ...p, [k]: v }));
  };

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
    window.dispatchEvent(new Event("storage"));
    setSaved(true);
  };

  const canSave = profile.name.trim().length > 0;

  return (
    <div className="px-4 pt-6 pb-16 max-w-lg mx-auto flex flex-col gap-6">

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <label htmlFor="avatar-upload" className="cursor-pointer group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#e2e2e2] group-active:opacity-80 transition-opacity flex items-center justify-center bg-[#f4f4f4]">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c4c7c7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="9" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            )}
          </div>
        </label>
        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
        <p className="text-[13px] text-[#747878]">{profile.avatar ? "Tap to change photo" : "Add a photo (optional)"}</p>
      </div>

      {/* Name */}
      <div className="bg-white rounded-[20px] p-5 h1-ambient border border-[#c4c7c7]/10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-3">Your name</p>
        <input
          type="text"
          value={profile.name}
          onChange={e => set("name", e.target.value)}
          placeholder="e.g. Eddie"
          className="w-full px-4 py-3 rounded-2xl border-2 border-[#e2e2e2] text-[15px] font-semibold text-[#1a1c1c] outline-none focus:border-[#2653d4] transition-colors bg-[#f9f9f9] focus:bg-white"
        />
      </div>

      {/* Padel level */}
      <div className="bg-white rounded-[20px] p-5 h1-ambient border border-[#c4c7c7]/10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-3">Padel level</p>
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
      <div className="bg-white rounded-[20px] p-5 h1-ambient border border-[#c4c7c7]/10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-3">Preferred position</p>
        <div className="flex gap-2">
          {POSITIONS.map(pos => {
            const sel = profile.position === pos;
            return (
              <button key={pos} onClick={() => set("position", pos)}
                className="flex-1 py-2.5 rounded-xl border-2 text-[12px] font-bold transition-all active:scale-95"
                style={{ borderColor: sel ? "#2653d4" : "#e2e2e2", background: sel ? "#eef2ff" : "#f9f9f9", color: sel ? "#2653d4" : "#747878" }}>
                {pos}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dominant hand */}
      <div className="bg-white rounded-[20px] p-5 h1-ambient border border-[#c4c7c7]/10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#747878] mb-3">Dominant hand</p>
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

      {/* Save */}
      <button
        disabled={!canSave}
        onClick={save}
        className="w-full py-4 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98]"
        style={{ background: saved ? "#16a34a" : canSave ? "#2653d4" : "#e2e2e2", color: canSave ? "#fff" : "#b0b3b3" }}
      >
        {saved ? "Saved ✓" : "Save profile"}
      </button>

    </div>
  );
}
