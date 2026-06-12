"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.session) {
        window.location.href = "/onboarding";
      } else {
        setCheckEmail(true);
        setLoading(false);
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", data.user.id)
      .single();

    window.location.href = profile?.display_name ? "/home8" : "/onboarding";
  }

  if (checkEmail) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: "var(--r-xl)", padding: "40px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "var(--shadow-card)" }}>
          <p style={{ fontSize: 40, margin: "0 0 16px" }}>📬</p>
          <p className="t-title" style={{ margin: "0 0 8px" }}>Check your email</p>
          <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: 0 }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: "var(--r-xl)", padding: "40px 32px", maxWidth: 380, width: "100%", boxShadow: "var(--shadow-card)" }}>
        <p className="t-heading" style={{ margin: "0 0 4px", color: "var(--c-text)" }}>padla</p>
        <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: "14px 16px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", fontSize: 16, background: "var(--c-bg-input)", outline: "none", color: "var(--c-text)" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: "14px 16px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", fontSize: 16, background: "var(--c-bg-input)", outline: "none", color: "var(--c-text)" }}
          />

          {error && (
            <p style={{ fontSize: 13, color: "var(--c-red)", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: "16px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", margin: "24px 0 0", fontSize: 14, color: "var(--c-text-sub)" }}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            style={{ background: "none", border: "none", color: "var(--c-blue)", fontWeight: 700, cursor: "pointer", fontSize: 14, padding: 0 }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
