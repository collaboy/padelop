"use client";
import { useRouter } from "next/navigation";

export default function CookiesPage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-6 pb-24 max-w-lg mx-auto" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="t-heading" style={{ margin: 0 }}>Cookie Policy</h1>
      </div>
      <p className="t-caption" style={{ color: "var(--c-hint)", marginBottom: 32 }}>Last updated: June 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Section title="What are cookies">
          Cookies are small text files stored on your device by your browser. padla uses cookies only for authentication — to keep you signed in between sessions.
        </Section>

        <Section title="Cookies we use">
          padla sets the following cookies, all provided by Supabase for authentication:
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--c-line)" }}>
                <th style={{ textAlign: "left", padding: "6px 0", color: "var(--c-label)", fontWeight: 600 }}>Cookie</th>
                <th style={{ textAlign: "left", padding: "6px 0", color: "var(--c-label)", fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: "left", padding: "6px 0", color: "var(--c-label)", fontWeight: 600 }}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "sb-access-token", purpose: "Authenticates your session", expires: "1 hour" },
                { name: "sb-refresh-token", purpose: "Refreshes your session automatically", expires: "60 days" },
              ].map(row => (
                <tr key={row.name} style={{ borderBottom: "1px solid var(--c-line-dim)" }}>
                  <td style={{ padding: "10px 0", color: "var(--c-text)", fontFamily: "monospace", fontSize: 12 }}>{row.name}</td>
                  <td style={{ padding: "10px 0", color: "var(--c-text-sub)" }}>{row.purpose}</td>
                  <td style={{ padding: "10px 0", color: "var(--c-hint)" }}>{row.expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="No tracking cookies">
          We do not use any analytics, advertising, or tracking cookies. No third-party cookies are set by padla.
        </Section>

        <Section title="Strictly necessary">
          The cookies listed above are strictly necessary for the app to function — without them you cannot stay signed in. Under GDPR, strictly necessary cookies do not require your consent.
        </Section>

        <Section title="Managing cookies">
          You can clear cookies at any time through your browser or device settings. Clearing authentication cookies will sign you out of padla.
        </Section>

        <Section title="Contact">
          Questions? Email <a href="mailto:eddievd@outlook.com" style={link}>eddievd@outlook.com</a>.
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
