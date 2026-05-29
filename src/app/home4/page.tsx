"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function matchLabel(date: string, time: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const day = date === today ? "Today" : date === tomorrow ? "Tomorrow" : date;
  return `Match ${day} at ${time}`;
}

const S: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 16,
  fontWeight: 300,
  color: "#111",
  lineHeight: 1.5,
};

export default function Home4() {
  const [done, setDone] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) setMatch({ date: m.date, time: m.time });
      }
    } catch {}
  }, []);

  return (
    <main style={{ ...S, padding: "40px 28px", minHeight: "100vh", background: "#f9f9f9", fontWeight: 300 }}>

      <p style={{ margin: "0 0 24px" }}>{greeting()} Eddie</p>
      {match && <p style={{ margin: "0 0 32px" }}>{matchLabel(match.date, match.time)}</p>}

      <hr style={{ width: 160, margin: "0 0 32px", border: "none", borderTop: "1.5px solid #111" }} />

      <p style={{ margin: "0 0 24px" }}>DO THIS NOW</p>
      <p style={{ margin: "0 0 24px" }}>Drink 500ml water</p>
      <button
        onClick={() => setDone(d => !d)}
        style={{ ...S, background: "none", border: "none", padding: 0, cursor: "pointer", margin: "0 0 32px", display: "block" }}
      >
        {done ? "[✓ Done]" : "[Done]"}
      </button>

      <hr style={{ width: 160, margin: "0 0 32px", border: "none", borderTop: "1.5px solid #111" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <Link href="/insights2a" style={{ ...S, textDecoration: "none", display: "block", marginBottom: 4 }}>View Insights</Link>
        <Link href="/track2a" style={{ ...S, textDecoration: "none", display: "block", marginBottom: 4 }}>Track Something</Link>
        <Link href="/matches2a" style={{ ...S, textDecoration: "none", display: "block" }}>Upcoming Matches</Link>
      </div>

    </main>
  );
}
