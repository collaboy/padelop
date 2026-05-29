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

const inputS: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 15,
  fontWeight: 300,
  color: "#111",
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: "8px 12px",
  width: "100%",
  background: "#fff",
  boxSizing: "border-box",
};

export default function Home4() {
  const [done, setDone] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ date: "", time: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) {
          const matchMs = new Date(`${m.date}T${m.time}`).getTime();
          if (matchMs > Date.now()) setMatch({ date: m.date, time: m.time });
        }
      }
    } catch {}
  }, []);

  function saveMatch() {
    if (!form.date || !form.time) return;
    const data = { date: form.date, time: form.time };
    localStorage.setItem("padelop:next-match", JSON.stringify(data));
    setMatch(data);
    setAddOpen(false);
    setForm({ date: "", time: "" });
  }

  return (
    <main style={{ ...S, padding: "40px 28px", minHeight: "100vh", background: "#f9f9f9", fontWeight: 300 }}>

      <p style={{ margin: "0 0 24px" }}>{greeting()} Eddie</p>

      {match ? (
        <p style={{ margin: "0 0 32px" }}>{matchLabel(match.date, match.time)}</p>
      ) : (
        <button
          onClick={() => setAddOpen(true)}
          style={{ ...S, background: "none", border: "none", padding: 0, cursor: "pointer", margin: "0 0 32px", display: "block", textDecoration: "underline" }}
        >
          + Add a match
        </button>
      )}

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

      {/* Add Match modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setAddOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ ...S, fontSize: 18, marginBottom: 24 }}>Add a match</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ ...S, fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={inputS}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ ...S, fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Time</label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={inputS}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setAddOpen(false)}
                style={{ ...S, flex: 1, padding: "10px 0", border: "1px solid #ccc", borderRadius: 10, cursor: "pointer", background: "#fff" }}
              >
                Cancel
              </button>
              <button
                onClick={saveMatch}
                style={{ ...S, flex: 1, padding: "10px 0", border: "none", borderRadius: 10, cursor: "pointer", background: "#111", color: "#fff" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
