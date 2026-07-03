"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProfileToDb } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import AvatarCropModal from "@/components/avatar-crop-modal";

const PROFILE_KEY = "padelop:profile";
type Profile = { name: string; level: string; position: string; hand: string; avatar: string; playingSince: string };
const EMPTY_PROFILE: Profile = { name: "", level: "", position: "", hand: "", avatar: "", playingSince: "" };
const LEVELS    = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const POSITIONS = ["Left wall","Right wall","Both"];
const HANDS     = ["Right","Left"];

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

async function subscribeAndSave() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
  }
  const json = sub.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }),
  });
}

async function unsubscribeAndRemove() {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  }
}

type NotifStatus = "unsupported" | "denied" | "enabled" | "off";

export default function SettingsPage() {
  const router = useRouter();
  const[notifStatus, setNotifStatus] = useState<NotifStatus>("off");
  const [notifLoading, setNotifLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [pwStatus, setPwStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) setProfile(JSON.parse(raw));
  }, []);

  const setField = (k: keyof Profile, v: string) => { setProfileSaved(false); setProfile(p => ({ ...p, [k]: v })); };
  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const saveAvatar = (croppedDataUrl: string) => {
    setCropSrc(null);
    resizeImage(croppedDataUrl, 320, 0.80).then(resized => {
      setField("avatar", resized);
      const updated = { ...profile, avatar: resized };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      saveProfileToDb({ display_name: updated.name, avatar_url: resized });
      setProfileSaved(true);
    }).catch(() => {
      setField("avatar", croppedDataUrl);
      const updated = { ...profile, avatar: croppedDataUrl };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      saveProfileToDb({ display_name: updated.name, avatar_url: croppedDataUrl });
      setProfileSaved(true);
    });
  };
  const saveProfile = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("storage"));
    saveProfileToDb({
      display_name:  profile.name,
      dominant_hand: profile.hand         || undefined,
      play_level:    profile.level        || undefined,
      position:      profile.position     || undefined,
      playing_since: profile.playingSince || undefined,
    });
    setProfileSaved(true);
  };
  const canSaveProfile = profile.name.trim().length > 0;

  async function handleEmailChange() {
    if (!newEmail.trim() || newEmail === userEmail) return;
    setEmailStatus("sending");
    const { error } = await createClient().auth.updateUser({ email: newEmail.trim() });
    if (error) { setEmailStatus("error"); return; }
    setEmailStatus("sent");
    setEmailExpanded(false);
    setNewEmail("");
  }

  async function handlePasswordReset() {
    if (!userEmail) return;
    setPwStatus("sending");
    const { error } = await createClient().auth.resetPasswordForEmail(userEmail);
    if (error) { setPwStatus("error"); return; }
    setPwStatus("sent");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Something went wrong."); setDeleting(false); return; }
      Object.keys(localStorage).filter(k => k.startsWith("padelop:")).forEach(k => localStorage.removeItem(k));
      window.location.href = "/auth";
    } catch {
      alert("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (typeof Notification === "undefined" || !("PushManager" in window)) {
      setNotifStatus("unsupported");
    } else if (Notification.permission === "denied") {
      setNotifStatus("denied");
    } else if (Notification.permission === "granted") {
      setNotifStatus("enabled");
    } else {
      setNotifStatus("off");
    }
  }, []);

  async function handleNotifications() {
    if (notifStatus === "unsupported") {
      alert("To enable notifications on iPhone, add padla to your Home Screen first:\n\nSafari → Share button → Add to Home Screen\n\nThen open the app from the home screen icon and try again.");
      return;
    }
    if (notifStatus === "denied") {
      alert("Notifications are blocked. Go to Settings → Safari → padla and allow notifications.");
      return;
    }
    if (notifStatus === "enabled") {
      setNotifLoading(true);
      try {
        await unsubscribeAndRemove();
        setNotifStatus("off");
      } catch (e) {
        alert("Could not disable notifications: " + String(e));
      } finally {
        setNotifLoading(false);
      }
      return;
    }
    setNotifLoading(true);
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        await subscribeAndSave();
        setNotifStatus("enabled");
      } else {
        setNotifStatus("denied");
      }
    } catch (e) {
      alert("Could not enable notifications: " + String(e));
    } finally {
      setNotifLoading(false);
    }
  }

  const notifSub: Record<NotifStatus, string> = {
    off:         "Tap to enable schedule reminders",
    enabled:     "Tap to disable",
    denied:      "Blocked in system settings",
    unsupported: "Open from home screen (iOS) to enable",
  };

  return (
    <><div className="px-5 pt-6 pb-24 max-w-lg mx-auto flex flex-col gap-6">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="t-heading" style={{ color: "var(--c-text)", margin: 0 }}>Settings</h1>
      </div>

      {/* Profile card */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 18px 4px" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div onClick={() => setProfilePanelOpen(v => !v)} style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", background: profile.avatar ? "transparent" : "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {profile.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 30, fontWeight: 800, color: "#2653d4" }}>{initials(profile.name)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <p style={{ margin: 0, fontSize: "clamp(20px, 5.1vw, 25px)", fontWeight: 700, color: "var(--c-text)", textAlign: "center", lineHeight: 1.2 }}>{profile.name || "Your Name"}</p>
          {(profile.level || profile.position) && (
            <p style={{ margin: 0, fontSize: "clamp(14px, 3.5vw, 16px)", fontWeight: 500, color: "var(--c-hint)", textAlign: "center", lineHeight: 1.3 }}>
              {[profile.level ? `Level ${profile.level}` : null, profile.position].filter(Boolean).join(" · ")}
            </p>
          )}
          {profile.hand         && <p style={{ margin: 0, fontSize: "clamp(14px, 3.5vw, 16px)", fontWeight: 500, color: "var(--c-hint)", textAlign: "center", lineHeight: 1.3 }}>{profile.hand}-handed</p>}
          {profile.playingSince && <p style={{ margin: 0, fontSize: "clamp(14px, 3.5vw, 16px)", fontWeight: 500, color: "var(--c-hint)", textAlign: "center", lineHeight: 1.3 }}>Since {profile.playingSince}</p>}
        </div>
        <button onClick={() => setProfilePanelOpen(v => !v)} style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: "#2653d4", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
          {profilePanelOpen ? "Done" : "Edit profile"}
        </button>
      </div>

      {profilePanelOpen && (
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)", overflow: "hidden" }}>
          <div style={{ padding: "18px 18px 16px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-hint)" }}>Edit Profile</p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", background: "#f0f2f5", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {profile.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={profile.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 22, fontWeight: 800, color: "#2653d4" }}>{initials(profile.name)}</span>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#2653d4" }}>Change photo</span>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
              </label>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-hint)" }}>Name</label>
                <input value={profile.name} onChange={e => setField("name", e.target.value)} placeholder="Your name" style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--c-line)", background: "var(--c-bg-input)", fontSize: 15, color: "var(--c-text)", outline: "none" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-hint)" }}>Playing since</label>
                <input value={profile.playingSince} onChange={e => setField("playingSince", e.target.value)} placeholder="e.g. 2019" style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--c-line)", background: "var(--c-bg-input)", fontSize: 15, color: "var(--c-text)", outline: "none" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-hint)" }}>Level</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LEVELS.map(l => (
                    <button key={l} onClick={() => setField("level", l)} style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid", fontSize: 13, fontWeight: 700, cursor: "pointer", borderColor: profile.level === l ? "#2653d4" : "var(--c-line)", background: profile.level === l ? "#eef2ff" : "transparent", color: profile.level === l ? "#2653d4" : "var(--c-hint)" }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-hint)" }}>Position</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {POSITIONS.map(p => (
                      <button key={p} onClick={() => setField("position", p)} style={{ padding: "7px 10px", borderRadius: 10, border: "1.5px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", borderColor: profile.position === p ? "#2653d4" : "var(--c-line)", background: profile.position === p ? "#eef2ff" : "transparent", color: profile.position === p ? "#2653d4" : "var(--c-hint)", textAlign: "left" }}>{p}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-hint)" }}>Hand</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {HANDS.map(h => (
                      <button key={h} onClick={() => setField("hand", h)} style={{ padding: "7px 10px", borderRadius: 10, border: "1.5px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", borderColor: profile.hand === h ? "#2653d4" : "var(--c-line)", background: profile.hand === h ? "#eef2ff" : "transparent", color: profile.hand === h ? "#2653d4" : "var(--c-hint)", textAlign: "left" }}>{h}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={saveProfile} disabled={!canSaveProfile} style={{ padding: 11, borderRadius: 14, background: canSaveProfile ? "#2653d4" : "#c4c7c7", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: canSaveProfile ? "pointer" : "default", marginTop: 4 }}>{profileSaved ? "Saved ✓" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Account */}
      <section>
        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px" }}>Account</p>
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)" }}>

          {/* Email */}
          <div>
            <button
              onClick={() => { setEmailExpanded(v => !v); setEmailStatus("idle"); setNewEmail(""); }}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "var(--c-text-dim)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <div style={{ textAlign: "left" }}>
                  <span className="t-ui" style={{ color: "var(--c-text)", display: "block" }}>Email</span>
                  <span className="t-caption" style={{ color: emailStatus === "sent" ? "var(--c-green)" : "var(--c-hint)" }}>
                    {emailStatus === "sent" ? "Confirmation sent — check your inbox" : userEmail || "—"}
                  </span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: emailExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div style={{ maxHeight: emailExpanded ? "200px" : 0, overflow: "hidden", transition: "max-height 0.25s ease" }}>
              <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--c-line-dim)" }}>
                <input
                  type="email"
                  placeholder="New email address"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", background: "var(--c-bg-input)", fontSize: 15, color: "var(--c-text)", outline: "none", marginTop: 12 }}
                />
                {emailStatus === "error" && <p style={{ margin: 0, fontSize: 13, color: "var(--c-red)" }}>Something went wrong. Try again.</p>}
                <button
                  onClick={handleEmailChange}
                  disabled={emailStatus === "sending" || !newEmail.trim()}
                  style={{ padding: "12px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", color: "#fff", border: "none", cursor: emailStatus === "sending" || !newEmail.trim() ? "default" : "pointer", opacity: !newEmail.trim() ? 0.5 : 1, fontWeight: 600, fontSize: 15 }}
                >
                  {emailStatus === "sending" ? "Sending…" : "Send confirmation"}
                </button>
              </div>
            </div>
          </div>

          {/* Password */}
          <button
            onClick={handlePasswordReset}
            disabled={pwStatus === "sending" || pwStatus === "sent"}
            style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: "1px solid var(--c-line-dim)", cursor: pwStatus === "sent" ? "default" : "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: pwStatus === "sent" ? "var(--c-green)" : "var(--c-text-dim)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <div style={{ textAlign: "left" }}>
                <span className="t-ui" style={{ color: "var(--c-text)", display: "block" }}>Password</span>
                <span className="t-caption" style={{ color: pwStatus === "sent" ? "var(--c-green)" : pwStatus === "error" ? "var(--c-red)" : "var(--c-hint)" }}>
                  {pwStatus === "sent" ? "Reset link sent — check your inbox" : pwStatus === "error" ? "Something went wrong" : pwStatus === "sending" ? "Sending…" : "Send a reset link to your email"}
                </span>
              </div>
            </div>
            {pwStatus === "sent"
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            }
          </button>

        </div>
      </section>

      {/* Preferences */}
      <section>
        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px" }}>Preferences</p>
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)" }}>
          <button
            onClick={handleNotifications}
            style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: notifStatus === "unsupported" ? "default" : "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: notifStatus === "enabled" ? "var(--c-green)" : "var(--c-text-dim)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </span>
              <div style={{ textAlign: "left" }}>
                <span className="t-ui" style={{ color: "var(--c-text)", display: "block" }}>Notifications</span>
                <span className="t-caption" style={{ color: notifStatus === "enabled" ? "var(--c-green)" : notifStatus === "denied" ? "var(--c-red, #ba1a1a)" : "var(--c-hint)" }}>
                  {notifLoading ? (notifStatus === "enabled" ? "Disabling…" : "Enabling…") : notifSub[notifStatus]}
                </span>
              </div>
            </div>
            {notifStatus === "enabled"
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            }
          </button>
          <a
            href="mailto:tiborboris@proton.me"
            style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f4f4f6", textDecoration: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: "var(--c-text-dim)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <div style={{ textAlign: "left" }}>
                <span className="t-ui" style={{ color: "var(--c-text)", display: "block" }}>Contact Support</span>
                <span className="t-caption" style={{ color: "var(--c-hint)" }}>tiborboris@proton.me</span>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
      </section>

      {/* Legal */}
      <section>
        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px" }}>Legal</p>
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)" }}>
          {[
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
            { label: "Cookie Policy", href: "/cookies" },
          ].map(({ label, href }, i) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: i > 0 ? "1px solid var(--c-line-dim)" : "none", cursor: "pointer" }}
            >
              <span className="t-ui" style={{ color: "var(--c-text)" }}>{label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      </section>

      {/* Admin */}
      {userEmail.toLowerCase() === "evanderbijl@hotmail.com" && (
        <section>
          <p className="t-label" style={{ color: "#7c3aed", margin: "0 4px 10px" }}>Admin</p>
          <div style={{ background: "#faf5ff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid #e9d5ff" }}>
            {[
              { label: "Insights", sub: "Performance data & analytics", href: "/profile", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
            ].map(({ label, sub, href, icon }, i) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: i > 0 ? "1px solid #ede9fe" : "none", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "#7c3aed" }}>{icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <span className="t-ui" style={{ color: "#7c3aed", display: "block" }}>{label}</span>
                    <span className="t-caption" style={{ color: "#a78bfa" }}>{sub}</span>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Log out */}
      <section>
        <form
          action="/auth/signout"
          method="post"
          onSubmit={() => {
            setSigningOut(true);
            Object.keys(localStorage).filter(k => k.startsWith("padelop:")).forEach(k => localStorage.removeItem(k));
          }}
        >
          <button
            type="submit"
            className="t-ui"
            disabled={signingOut}
            style={{ width: "100%", padding: "16px", color: signingOut ? "#fff" : "#ba1a1a", border: "1.5px solid rgba(186,26,26,0.2)", borderRadius: "var(--r-sm)", background: signingOut ? "#ba1a1a" : "#fff", cursor: signingOut ? "default" : "pointer", boxShadow: "var(--shadow-soft)", transition: "background 0.15s, color 0.15s" }}
          >
            {signingOut ? "Signing out…" : "Log Out"}
          </button>
        </form>
      </section>

      {/* Danger zone */}
      <section>
        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px" }}>Danger Zone</p>
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid rgba(186,26,26,0.15)" }}>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "var(--c-red)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </span>
                <div style={{ textAlign: "left" }}>
                  <span className="t-ui" style={{ color: "var(--c-red)", display: "block" }}>Delete account</span>
                  <span className="t-caption" style={{ color: "var(--c-hint)" }}>Permanently removes all your data</span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ) : (
            <div style={{ padding: "20px" }}>
              <p className="t-body-sm" style={{ color: "var(--c-text)", margin: "0 0 4px", fontWeight: 600 }}>Are you sure?</p>
              <p className="t-caption" style={{ color: "var(--c-hint)", margin: "0 0 16px" }}>This will permanently delete your account and all data. This cannot be undone.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: "var(--r-sm)", background: "var(--c-bg)", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 15, color: "var(--c-text)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  style={{ flex: 1, padding: "12px", borderRadius: "var(--r-sm)", background: "var(--c-red)", border: "none", cursor: deleting ? "default" : "pointer", fontWeight: 600, fontSize: 15, color: "#fff" }}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <p className="t-caption" style={{ textAlign: "center", color: "var(--c-disabled)" }}>
        padla Version 2.4.1
      </p>

    </div>

    {cropSrc && (
      <AvatarCropModal
        imageSrc={cropSrc}
        onSave={saveAvatar}
        onClose={() => setCropSrc(null)}
      />
    )}
  </>
  );
}
