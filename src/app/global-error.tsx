"use client";

import { useEffect } from "react";

// Root-layout replacement: only fires if the error happens above/inside
// RootLayout itself (e.g. a crash in layout.tsx), so it must render its
// own <html>/<body> and can't lean on globals.css or fonts being intact.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f6", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 28, padding: "40px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0px 4px 24px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: 40, margin: "0 0 16px" }}>😵</p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "#1a1c1c" }}>Something went wrong</p>
            <p style={{ fontSize: 15, color: "#4a5050", margin: "0 0 24px", lineHeight: 1.55 }}>
              Give it another shot — if it keeps happening, come back later and we&apos;ll have it sorted.
            </p>
            <button
              onClick={() => reset()}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 28,
                background: "#2653d4",
                color: "#fff",
                border: "none",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
