"use client";
import { useRouter } from "next/navigation";
import { startNavLoad } from "@/lib/nav-events";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => { startNavLoad(); router.back(); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="t-heading" style={{ margin: 0 }}>Privacy Policy</h1>
      </div>
      <p className="t-caption" style={{ color: "var(--c-hint)", marginBottom: 32 }}>Last updated: June 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Section title="Overview">
          padla is a personal padel performance tracker. This policy explains what data we collect, how we use it, and your rights.
        </Section>

        <Section title="What we collect">
          <ul style={ul}>
            <li><strong>Account info</strong> — your email address, used to identify your account.</li>
            <li><strong>Profile data</strong> — display name, play level, dominant hand, position, club, and goals you enter.</li>
            <li><strong>Health & performance logs</strong> — check-ins, training sessions, hydration, nutrition, sleep, and match reviews you log voluntarily.</li>
            <li><strong>Match data</strong> — upcoming match details and post-match notes.</li>
            <li><strong>Gear data</strong> — racket name and gear photos you choose to upload.</li>
            <li><strong>Push notification tokens</strong> — if you enable notifications, a subscription token is stored to deliver schedule reminders.</li>
          </ul>
        </Section>

        <Section title="What we don't collect">
          <ul style={ul}>
            <li>We do not collect location data.</li>
            <li>We do not access your camera, microphone, or contacts.</li>
            <li>We do not sell your data to third parties.</li>
            <li>We do not use your data for advertising.</li>
          </ul>
        </Section>

        <Section title="How we use your data">
          Your data is used solely to provide the app's features — personalising your schedule, calculating readiness scores, and showing your match history. Nothing else.
        </Section>

        <Section title="Data storage">
          Your data is stored securely using Supabase (PostgreSQL), hosted in the EU (Stockholm, Sweden). Data is encrypted in transit (TLS) and at rest. We retain your data for as long as your account is active.
        </Section>

        <Section title="Third-party services">
          <ul style={ul}>
            <li><strong>Supabase</strong> — database and authentication (<a href="https://supabase.com/privacy" style={link}>supabase.com/privacy</a>)</li>
            <li><strong>Vercel</strong> — hosting (<a href="https://vercel.com/legal/privacy-policy" style={link}>vercel.com/legal/privacy-policy</a>)</li>
            <li><strong>Anthropic Claude API</strong> — used to analyse uploaded images (e.g. food photos, match bookings). Images are sent to Anthropic's API and are not stored by us after processing.</li>
          </ul>
        </Section>

        <Section title="Your rights (GDPR)">
          You have the right to access, correct, or delete your personal data at any time. You can delete your account and all data from Settings → Danger Zone. For any other requests, contact us at <a href="mailto:tiborboris@proton.me" style={link}>tiborboris@proton.me</a>. We will respond within 30 days.
        </Section>

        <Section title="Children">
          padla is not intended for users under 13. We do not knowingly collect data from children.
        </Section>

        <Section title="Cookies">
          We use cookies only for authentication. See our <a href="/cookies" style={link}>Cookie Policy</a>.
        </Section>

        <Section title="Changes">
          If we make material changes to this policy, we will notify you via the app. Continued use after changes constitutes acceptance.
        </Section>

        <Section title="Contact">
          Questions? Email <a href="mailto:tiborboris@proton.me" style={link}>tiborboris@proton.me</a>.
        </Section>
      </div>
    </div>
  );
}

const ul: React.CSSProperties = { margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 };
const link: React.CSSProperties = { color: "var(--c-blue)", textDecoration: "none" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-label" style={{ color: "var(--c-label)", margin: "0 0 8px" }}>{title}</p>
      <div className="t-body-sm" style={{ color: "var(--c-text-sub)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
