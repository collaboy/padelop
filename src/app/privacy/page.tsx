export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px 80px", fontFamily: "Inter, sans-serif", color: "#1a1c1c" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: "#8a9096", margin: "0 0 40px" }}>Last updated: June 2026</p>

      <Section title="Overview">
        padla ("we", "our", or "the app") is a personal padel performance tracker. We take your privacy seriously. This policy explains what data we collect, how we use it, and your rights.
      </Section>

      <Section title="What we collect">
        <ul style={ul}>
          <li><strong>Account info</strong> — your name and email address, used to identify your account.</li>
          <li><strong>Profile data</strong> — play level, dominant hand, and goals you enter during onboarding.</li>
          <li><strong>Health & performance logs</strong> — check-ins, training sessions, hydration, nutrition, sleep, and match reviews you log voluntarily.</li>
          <li><strong>Match data</strong> — upcoming match details and post-match notes you enter.</li>
          <li><strong>Device data</strong> — basic usage analytics (via Vercel Analytics) to understand how the app is used. No personally identifiable information is included.</li>
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
        Your data is stored securely using Supabase (PostgreSQL), hosted in the EU. Data is encrypted in transit (TLS) and at rest. We retain your data for as long as your account is active. You can request deletion at any time.
      </Section>

      <Section title="Third-party services">
        <ul style={ul}>
          <li><strong>Supabase</strong> — database and authentication (<a href="https://supabase.com/privacy" style={link}>supabase.com/privacy</a>)</li>
          <li><strong>Vercel</strong> — hosting and anonymous analytics (<a href="https://vercel.com/legal/privacy-policy" style={link}>vercel.com/legal/privacy-policy</a>)</li>
          <li><strong>Anthropic Claude API</strong> — used to analyse uploaded images (e.g. match bookings, food photos). Images are sent to Anthropic's API and are not stored by us after processing.</li>
        </ul>
      </Section>

      <Section title="Your rights">
        You have the right to access, correct, or delete your personal data at any time. To exercise these rights, contact us at the email below. We will respond within 30 days.
      </Section>

      <Section title="Children">
        padla is not intended for users under 13. We do not knowingly collect data from children.
      </Section>

      <Section title="Changes to this policy">
        We may update this policy from time to time. If we make material changes, we will notify you via the app. Continued use after changes constitutes acceptance.
      </Section>

      <Section title="Contact">
        Questions or requests? Email us at{" "}
        <a href="mailto:eddievd@outlook.com" style={link}>eddievd@outlook.com</a>.
      </Section>
    </div>
  );
}

const ul: React.CSSProperties = { margin: "0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 };
const link: React.CSSProperties = { color: "#2653d4", textDecoration: "none" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a9096", margin: "0 0 10px" }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "#2c3235" }}>{children}</div>
    </div>
  );
}
