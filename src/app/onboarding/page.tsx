"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [hand, setHand] = useState<"right" | "left" | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const steps = ["Name", "Hand", "Level", "Goal"];

  async function finish() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }

    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name.trim(),
      dominant_hand: hand,
      play_level: level,
      overall_goal: goal,
    });

    router.push("/home8");
  }

  const canContinue =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && hand !== null) ||
    (step === 2 && level !== null) ||
    (step === 3 && goal !== null);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--c-bg)", padding: "60px 24px 40px" }}>
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
      </div>

      {/* Continue / Finish */}
      <button
        onClick={step < 3 ? () => setStep(s => s + 1) : finish}
        disabled={!canContinue || saving}
        style={{ width: "100%", padding: "18px", borderRadius: "var(--r-sm)", background: canContinue ? "var(--c-blue)" : "var(--c-disabled)", color: "#fff", border: "none", fontSize: 17, fontWeight: 700, cursor: canContinue ? "pointer" : "not-allowed", marginTop: 32, transition: "background 0.2s" }}
      >
        {saving ? "Saving..." : step < 3 ? "Continue" : "Let's go"}
      </button>

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
