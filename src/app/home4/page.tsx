"use client";

import React, { useState } from "react";
import Link from "next/link";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function Home4() {
  const [done, setDone] = useState(false);

  return (
    <main style={{ padding: "32px 24px", fontFamily: "Menlo, Monaco, 'Courier New', monospace", maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f9f9f7" }}>
      <p style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>{greeting()} Eddie</p>
      <p style={{ fontSize: 15, color: "#555", marginTop: 6 }}>Match Tonight</p>

      <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #ddd" }} />

      <p style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", margin: 0 }}>Do This Now</p>
      <p style={{ fontSize: 18, fontWeight: 400, marginTop: 10, marginBottom: 16 }}>Drink 500ml water</p>
      <button
        onClick={() => setDone(d => !d)}
        style={{
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 400,
          border: "1.5px solid #ccc",
          borderRadius: 8,
          background: done ? "#f0f0f0" : "#fff",
          color: done ? "#888" : "#000",
          cursor: "pointer",
        }}
      >
        {done ? "✓ Done" : "Done"}
      </button>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid #ddd" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/insights2a" style={{ fontSize: 16, fontWeight: 400, color: "#000", textDecoration: "none" }}>View Insights →</Link>
        <Link href="/track2a" style={{ fontSize: 16, fontWeight: 400, color: "#000", textDecoration: "none" }}>Track Something →</Link>
        <Link href="/matches2a" style={{ fontSize: 16, fontWeight: 400, color: "#000", textDecoration: "none" }}>Upcoming Matches →</Link>
      </div>
    </main>
  );
}
