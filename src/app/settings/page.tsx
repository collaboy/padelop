"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { downloadSnapshot, importData } from "@/lib/storage";

export default function SettingsPage() {
  const router = useRouter();
  const importRef = useRef<HTMLInputElement>(null);
  const [importDone, setImportDone] = useState(false);

  const prefItems = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      label: "Notifications", sub: null,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
      label: "Privacy & Security", sub: null,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
      label: "Language", sub: "English (US)",
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
      label: "Support Center", sub: null,
    },
  ];

  const dataItems = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
      label: "Export my data",
      sub: "Download a backup of all your data",
      action: () => downloadSnapshot(),
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
      label: importDone ? "Data restored ✓" : "Import backup",
      sub: "Restore from a previous export",
      action: () => importRef.current?.click(),
    },
  ];

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

      {/* Preferences */}
      <section>
        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px" }}>Preferences</p>
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)" }}>
          {prefItems.map(({ icon, label, sub }, i) => (
            <button
              key={label}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: i > 0 ? "1px solid #f4f4f6" : "none", cursor: "pointer" }}
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

      {/* Data */}
      <section>
        <p className="t-label" style={{ color: "var(--c-hint)", margin: "0 4px 10px" }}>Your Data</p>
        <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)" }}>
          {dataItems.map(({ icon, label, sub, action }, i) => (
            <button
              key={label}
              onClick={action}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderTop: i > 0 ? "1px solid #f4f4f6" : "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: importDone && label.includes("Import") ? "var(--c-green)" : "var(--c-text-dim)" }}>{icon}</span>
                <div style={{ textAlign: "left" }}>
                  <span className="t-ui" style={{ color: importDone && label.includes("Import") ? "var(--c-green)" : "var(--c-text)", display: "block" }}>{label}</span>
                  {sub && <span className="t-caption" style={{ color: "var(--c-hint)" }}>{sub}</span>}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-disabled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                importData(JSON.parse(reader.result as string));
                setImportDone(true);
                window.location.reload();
              } catch {
                alert("Couldn't read that file. Make sure it's a padla backup.");
              }
            };
            reader.readAsText(file);
            e.target.value = "";
          }}
        />
      </section>

      {/* Log out */}
      <section>
        <form
          action="/auth/signout"
          method="post"
          onSubmit={() => {
            Object.keys(localStorage).filter(k => k.startsWith("padelop:")).forEach(k => localStorage.removeItem(k));
          }}
        >
          <button
            type="submit"
            className="t-ui"
            style={{ width: "100%", padding: "16px", color: "#ba1a1a", border: "1.5px solid rgba(186,26,26,0.2)", borderRadius: "var(--r-sm)", background: "#fff", cursor: "pointer", boxShadow: "var(--shadow-soft)" }}
          >
            Log Out
          </button>
        </form>
      </section>

      <p className="t-caption" style={{ textAlign: "center", color: "var(--c-disabled)" }}>
        padla Version 2.4.1
      </p>

    </div>
  );
}
