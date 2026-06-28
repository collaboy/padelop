"use client";
import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="t-heading" style={{ margin: 0 }}>Terms of Service</h1>
      </div>
      <p className="t-caption" style={{ color: "var(--c-hint)", marginBottom: 32 }}>Last updated: June 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Section title="Acceptance">
          By creating an account or using padla, you agree to these terms. If you do not agree, do not use the app.
        </Section>

        <Section title="The service">
          padla is a personal padel performance tracking app. We provide tools to log training, matches, nutrition, hydration, and wellness data, and to receive schedule reminders. The app is provided as-is and may change or be discontinued at any time.
        </Section>

        <Section title="Eligibility">
          You must be at least 13 years old to use padla. By using the app you confirm you meet this requirement.
        </Section>

        <Section title="Your account">
          You are responsible for maintaining the security of your account credentials. Do not share your password. You are responsible for all activity that occurs under your account.
        </Section>

        <Section title="Your data">
          You own the data you enter into padla. We do not claim any rights over it. You can delete your account and all associated data at any time from Settings → Danger Zone.
        </Section>

        <Section title="Acceptable use">
          You agree not to misuse the service — including attempting to access other users' data, reverse-engineering the app, or using it for any unlawful purpose.
        </Section>

        <Section title="No warranties">
          padla is provided "as is" without warranties of any kind. We do not guarantee the accuracy of readiness scores, AI-generated insights, or any other content. The app is not a substitute for professional medical or sports coaching advice.
        </Section>

        <Section title="Limitation of liability">
          To the fullest extent permitted by law, padla and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.
        </Section>

        <Section title="Termination">
          We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time.
        </Section>

        <Section title="Governing law">
          These terms are governed by the laws of Italy. Any disputes shall be resolved in the courts of Italy.
        </Section>

        <Section title="Changes">
          We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms.
        </Section>

        <Section title="Contact">
          Questions? Email <a href="mailto:tiborboris@proton.me" style={link}>tiborboris@proton.me</a>.
        </Section>
      </div>
    </div>
  );
}

const link: React.CSSProperties = { color: "var(--c-blue)", textDecoration: "none" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 8px" }}>{title}</p>
      <div className="t-body-sm" style={{ color: "var(--c-text-sub)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
