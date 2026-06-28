"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

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
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto flex flex-col gap-6">

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
          {[
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              label: "Privacy & Security",
              sub: null,
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
              label: "Language",
              sub: "English (US)",
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
              label: "Support Center",
              sub: null,
            },
          ].map(({ icon, label, sub }) => (
            <button
              key={label}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: "1px solid #f4f4f6", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "var(--c-text-dim)" }}>{icon}</span>
                <div style={{ textAlign: "left" }}>
                  <span className="t-ui" style={{ color: "var(--c-text)", display: "block" }}>{label}</span>
                  {sub && <span className="t-caption" style={{ color: "var(--c-hint)" }}>{sub}</span>}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      </section>

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
  );
}
