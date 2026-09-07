"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let becameReady = false;
    // The recovery link lands here with the token in the URL hash, which
    // Supabase's client picks up automatically and fires this event once
    // the temporary recovery session is set.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        becameReady = true;
        setReady(true);
      }
    });
    // Cover the case where the hash was already processed before this
    // component mounted (fast reloads, etc.) — if there's already a
    // session by the time we check, treat it as ready too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        becameReady = true;
        setReady(true);
      }
    });
    const timeout = setTimeout(() => {
      if (!becameReady) setInvalid(true);
    }, 4000);
    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setDone(true);
    setLoading(false);
    setTimeout(() => { window.location.href = "/home"; }, 1500);
  }

  if (done) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: "var(--r-xl)", padding: "40px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "var(--shadow-card)" }}>
          <p style={{ fontSize: 40, margin: "0 0 16px" }}>✅</p>
          <p className="t-title" style={{ margin: "0 0 8px" }}>Password updated</p>
          <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: 0 }}>Taking you to your homepage...</p>
        </div>
      </div>
    );
  }

  if (invalid && !ready) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: "var(--r-xl)", padding: "40px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "var(--shadow-card)" }}>
          <p style={{ fontSize: 40, margin: "0 0 16px" }}>⚠️</p>
          <p className="t-title" style={{ margin: "0 0 8px" }}>Link expired</p>
          <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 24px" }}>
            This password reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
          <a href="/auth" style={{ color: "var(--c-blue)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: "var(--r-xl)", padding: "40px 32px", maxWidth: 380, width: "100%", boxShadow: "var(--shadow-card)" }}>
        <p className="t-heading" style={{ margin: "0 0 4px", color: "var(--c-text)" }}>padla</p>
        <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Choose a new password</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={!ready}
            style={{ padding: "14px 16px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", fontSize: 16, background: "var(--c-bg-input)", outline: "none", color: "var(--c-text)" }}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            disabled={!ready}
            style={{ padding: "14px 16px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", fontSize: 16, background: "var(--c-bg-input)", outline: "none", color: "var(--c-text)" }}
          />

          {error && (
            <p style={{ fontSize: 13, color: "var(--c-red)", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            style={{ padding: "16px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: loading || !ready ? "not-allowed" : "pointer", opacity: loading || !ready ? 0.7 : 1, marginTop: 4 }}
          >
            {ready ? (loading ? "..." : "Update password") : "Verifying link..."}
          </button>
        </form>
      </div>
    </div>
  );
}
