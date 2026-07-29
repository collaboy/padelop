"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

const LEVELS = [
  { value: "beginner",      label: "Beginner",      sub: "Still learning the basics" },
  { value: "intermediate",  label: "Intermediate",  sub: "Comfortable playing regularly" },
  { value: "competitive",   label: "Competitive",   sub: "Tournament or league player" },
];

const GOALS = [
  "Improve consistency",
  "Better net game",
  "Stronger serve",
  "Improve movement",
  "Win more matches",
  "Play more often",
];

const POSITIONS = ["Left wall", "Right wall", "Both"];

export default function OnboardingFlow({ previewMode = false }: { previewMode?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [hand, setHand] = useState<"right" | "left" | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [playingSince, setPlayingSince] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const steps = ["Name", "Hand", "Level", "Goal", "Position", "Playing Since", "Notifications"];

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
        display_name:  name.trim(),
        dominant_hand: hand,
        play_level:    level,
        overall_goal:  goal,
        position,
        playing_since: playingSince.trim() || null,
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
      finish();
      return;
    }
    if (typeof Notification === "undefined" || !("PushManager" in window)) {
      alert("To enable notifications on iPhone, add padla to your Home Screen first:\n\nSafari → Share button → Add to Home Screen\n\nThen open the app from the home screen icon and try again.");
      finish();
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") await subscribeToPush();
    } catch {}
    finish();
  }

  const canContinue =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && hand !== null) ||
    (step === 2 && level !== null) ||
    (step === 3 && goal !== null) ||
    (step === 4 && position !== null) ||
    (step === 5);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--c-bg)", padding: "60px 24px 40px" }}>
      {previewMode && (
        <p style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 600, color: "#8a9096", background: "#fff", padding: "5px 12px", borderRadius: 999, boxShadow: "0 1px 6px rgba(0,0,0,0.12)", zIndex: 10, margin: 0 }}>
          Preview mode — no data is saved
        </p>
      )}
      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 48 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= step ? "var(--c-blue)" : "var(--c-line)", transition: "background 0.3s" }} />
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Step 0: Name */}
        {step === 0 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>What's your name?</p>
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

        {/* Step 1: Dominant hand */}
        {step === 1 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Dominant hand?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Affects drill instructions.</p>
            <div style={{ display: "flex", gap: 12 }}>
              {(["right", "left"] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setHand(h)}
                  style={{ flex: 1, padding: "28px 16px", borderRadius: "var(--r-md)", border: `2px solid ${hand === h ? "var(--c-blue)" : "var(--c-line)"}`, background: hand === h ? "var(--c-blue-tint)" : "#fff", cursor: "pointer", fontSize: 17, fontWeight: 700, color: hand === h ? "var(--c-blue)" : "var(--c-text)", transition: "all 0.15s" }}
                >
                  {h === "right" ? "Right" : "Left"}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Play level */}
        {step === 2 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Your play level?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Helps tailor your experience.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LEVELS.map(l => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  style={{ padding: "20px 18px", borderRadius: "var(--r-md)", border: `2px solid ${level === l.value ? "var(--c-blue)" : "var(--c-line)"}`, background: level === l.value ? "var(--c-blue-tint)" : "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                >
                  <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: level === l.value ? "var(--c-blue)" : "var(--c-text)" }}>{l.label}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-sub)" }}>{l.sub}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Goal */}
        {step === 3 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Main goal?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>This shapes your training focus.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {GOALS.map(g => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  style={{ padding: "12px 18px", borderRadius: "var(--r-pill)", border: `2px solid ${goal === g ? "var(--c-blue)" : "var(--c-line)"}`, background: goal === g ? "var(--c-blue-tint)" : "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600, color: goal === g ? "var(--c-blue)" : "var(--c-text)", transition: "all 0.15s" }}
                >
                  {g}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 4: Position */}
        {step === 4 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Where do you play?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Your usual court position.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {POSITIONS.map(p => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  style={{ padding: "20px 18px", borderRadius: "var(--r-md)", border: `2px solid ${position === p ? "var(--c-blue)" : "var(--c-line)"}`, background: position === p ? "var(--c-blue-tint)" : "#fff", cursor: "pointer", textAlign: "left", fontSize: 16, fontWeight: 700, color: position === p ? "var(--c-blue)" : "var(--c-text)", transition: "all 0.15s" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 5: Playing since */}
        {step === 5 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Playing since?</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Optional — the year you started.</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 2019"
              value={playingSince}
              onChange={e => setPlayingSince(e.target.value)}
              style={{ padding: "16px 18px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-line)", fontSize: 18, background: "#fff", outline: "none", color: "var(--c-text)" }}
            />
          </>
        )}

        {/* Step 6: Notifications */}
        {step === 6 && (
          <>
            <p className="t-heading" style={{ margin: "0 0 8px" }}>Stay on track</p>
            <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 32px" }}>Get a nudge for your morning warm-up and a reminder to wind down at night. You can change this anytime in Settings.</p>
          </>
        )}
      </div>

      {/* Continue */}
      {step < steps.length - 1 && (
        <button
          onClick={() => setStep(s => s + 1)}
          disabled={!canContinue || saving}
          style={{ width: "100%", padding: "18px", borderRadius: "var(--r-sm)", background: canContinue ? "var(--c-blue)" : "var(--c-disabled)", color: "#fff", border: "none", fontSize: 17, fontWeight: 700, cursor: canContinue ? "pointer" : "not-allowed", marginTop: 32, transition: "background 0.2s" }}
        >
          Continue
        </button>
      )}

      {/* Notifications step: enable or skip, both finish onboarding */}
      {step === steps.length - 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 32 }}>
          <button
            onClick={enableNotifications}
            disabled={saving}
            style={{ width: "100%", padding: "18px", borderRadius: "var(--r-sm)", background: "var(--c-blue)", color: "#fff", border: "none", fontSize: 17, fontWeight: 700, cursor: saving ? "default" : "pointer", transition: "background 0.2s" }}
          >
            {saving ? "Saving..." : "Enable Notifications"}
          </button>
          <button
            onClick={finish}
            disabled={saving}
            style={{ width: "100%", padding: "16px", borderRadius: "var(--r-sm)", background: "none", color: "var(--c-text-sub)", border: "none", fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer" }}
          >
            Maybe later
          </button>
        </div>
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
