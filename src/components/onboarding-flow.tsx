"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";
import { GOALS } from "@/lib/profile-options";

// Values match Settings' 1.0–5.0 level scale (same "profiles.play_level"
// column) so the two pickers never disagree on a user's level.
const LEVELS = [
  { value: "2.0", label: "Beginner",     sub: "Still learning the basics" },
  { value: "3.0", label: "Intermediate", sub: "You play regularly and know the basics" },
  { value: "4.5", label: "Advanced",     sub: "Tournament or league player" },
];

export default function OnboardingFlow({ previewMode = false }: { previewMode?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dominant hand, court position, and playing-since were dropped from
  // onboarding — nothing in the app uses them to personalize anything yet,
  // and they're all still editable in Settings whenever that changes.
  const steps = ["Name", "Level", "Goal", "Notifications", "Welcome"];

  async function finish() {
    if (previewMode) {
      router.push("/home");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }

    const { error } = await supabase.from("profiles")
      .update({
        display_name:         name.trim(),
        play_level:           level,
        overall_goal:         goal,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    router.push("/home");
  }

  async function enableNotifications() {
    if (previewMode) {
      setStep(s => s + 1);
      return;
    }
    if (typeof Notification === "undefined" || !("PushManager" in window)) {
      alert("To enable notifications on iPhone, add padla to your Home Screen first:\n\nSafari → Share button → Add to Home Screen\n\nThen open the app from the home screen icon and try again.");
      setStep(s => s + 1);
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") await subscribeToPush();
    } catch {}
    setStep(s => s + 1);
  }

  const canContinue = step === 0 && name.trim().length > 0;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--c-bg)", padding: "60px 24px 40px" }}>
      {previewMode && (
        <p style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 600, color: "#8a9096", background: "#fff", padding: "5px 12px", borderRadius: 999, boxShadow: "0 1px 6px rgba(0,0,0,0.12)", zIndex: 10, margin: 0 }}>
          Preview mode — no data is saved
        </p>
      )}
      {/* Progress — a single track with a green ball travelling along it */}
      <div style={{ position: "relative", height: 24, marginBottom: 48 }}>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 6, borderRadius: 99, background: "var(--c-line)", transform: "translateY(-50%)" }} />
        <div
          style={{
            position: "absolute", top: "50%", left: `${(step / (steps.length - 1)) * 100}%`,
            width: 24, height: 24, borderRadius: "50%", background: "#00D455",
            transform: "translate(-50%, -50%)", transition: "left 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            opacity: step === steps.length - 1 ? 0.25 : 1,
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Step 0: Name */}
        {step === 0 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>First things first… What should we call you?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>We'll use this across the app.</p>
            <input
              autoFocus
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ padding: "16px 18px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", fontSize: 18, background: "#fff", outline: "none", color: "var(--c-text)" }}
            />
          </>
        )}

        {/* Step 1: Play level */}
        {step === 1 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Your play level?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Helps tailor your experience.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LEVELS.map(l => (
                <button
                  key={l.value}
                  onClick={() => { setLevel(l.value); setStep(s => s + 1); }}
                  style={{ padding: "20px 18px", borderRadius: "var(--r-md)", border: `2px solid ${level === l.value ? "var(--c-blue)" : "var(--c-line)"}`, background: level === l.value ? "var(--c-blue-tint)" : "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                >
                  <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: level === l.value ? "var(--c-blue)" : "var(--c-text)" }}>{l.label}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-sub)" }}>{l.sub}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Main goal?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>This shapes your training focus.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {GOALS.map(g => (
                <button
                  key={g}
                  onClick={() => { setGoal(g); setStep(s => s + 1); }}
                  style={{ padding: "12px 18px", borderRadius: "var(--r-pill)", border: `2px solid ${goal === g ? "var(--c-blue)" : "var(--c-line)"}`, background: goal === g ? "var(--c-blue-tint)" : "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600, color: goal === g ? "var(--c-blue)" : "var(--c-text)", transition: "all 0.15s" }}
                >
                  {g}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Notifications */}
        {step === 3 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "nowrap", margin: "0 0 8px" }}>
              <p className="t-heading" style={{ margin: 0, lineHeight: 1 }}>Stay in sync</p>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--c-blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--c-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
            </div>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Allow notifications so padla can reach you when its guidance will be most useful — not just on the schedule.</p>
          </>
        )}

        {/* Step 4: Welcome */}
        {step === 4 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div className="animate-tap-pulse" style={{ width: 84, height: 84, borderRadius: "50%", background: "#00D455", marginBottom: 28, flexShrink: 0 }} />
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Welcome to REZI</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: 0 }}>Open the app to find out what you should be doing right in this moment.</p>
          </div>
        )}
      </div>

      {/* Continue — only shown on the one free-text step (Name). Every
          single-choice step auto-advances on tap instead, since picking an
          option is already the complete answer. */}
      {step === 0 && (
        <button
          onClick={() => setStep(s => s + 1)}
          disabled={!canContinue || saving}
          style={{ width: "100%", padding: "18px", borderRadius: "var(--r-sm)", background: canContinue ? "var(--c-blue)" : "var(--c-disabled)", color: "#fff", border: "none", fontSize: 17, fontWeight: 700, cursor: canContinue ? "pointer" : "not-allowed", marginTop: 32, transition: "background 0.2s" }}
        >
          Continue
        </button>
      )}

      {/* Notifications step: enable or skip, both advance to the Welcome step */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 32 }}>
          <button
            onClick={enableNotifications}
            style={{ width: "100%", padding: "18px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", color: "#fff", border: "none", fontSize: 17, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
          >
            Enable Notifications
          </button>
          <button
            onClick={() => setStep(s => s + 1)}
            style={{ width: "100%", padding: "16px", borderRadius: "var(--r-sm)", background: "none", color: "var(--c-text-sub)", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Maybe later
          </button>
        </div>
      )}

      {/* Welcome step: the actual finish — saves profile and enters the app */}
      {step === steps.length - 1 && (
        <button
          onClick={finish}
          disabled={saving}
          style={{ width: "100%", padding: "18px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", color: "#fff", border: "none", fontSize: 17, fontWeight: 700, cursor: saving ? "default" : "pointer", marginTop: 32, transition: "background 0.2s" }}
        >
          {saving ? "Saving..." : "Let's go"}
        </button>
      )}

      {saveError && (
        <p style={{ fontSize: 13, color: "var(--c-red)", textAlign: "center", marginTop: 8 }}>{saveError}</p>
      )}

      {step > 0 && (
        <button
          onClick={() => setStep(s => s - 1)}
          style={{ background: "none", border: "none", color: "var(--c-text-sub)", fontSize: 14, cursor: "pointer", marginTop: 16, textAlign: "center", width: "100%" }}
        >
          Back
        </button>
      )}
    </div>
  );
}
