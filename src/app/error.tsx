"use client";

import { useEffect } from "react";

export default function Error({
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
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: "var(--r-xl)", padding: "40px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "var(--shadow-card)" }}>
        <p style={{ fontSize: 40, margin: "0 0 16px" }}>😵</p>
        <p className="t-title" style={{ margin: "0 0 8px" }}>Something went wrong</p>
        <p className="t-body-sm" style={{ color: "var(--c-text-sub)", margin: "0 0 24px" }}>
          Give it another shot — if it keeps happening, come back later and we&apos;ll have it sorted.
        </p>
        <button
          onClick={() => reset()}
          className="t-ui"
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: "var(--r-xl)",
            background: "var(--c-blue)",
            color: "#fff",
            border: "none",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
