"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { computeNotifications } from "@/lib/notifications";

export default function Nav() {
  const pathname = usePathname();

  useEffect(() => {
    const id = setInterval(() => computeNotifications(), 60_000);
    return () => clearInterval(id);
  }, []);

  if (pathname === "/my-game") return null;

  return (
    <div className="fixed top-4 left-4 z-[70]">
      <Link href="/" style={{ textDecoration: "none" }}>
        <div style={{ background: "#fff", borderRadius: "50%", width: 56, height: 56, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <span className="font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "Inter, sans-serif", fontSize: 15 }}>
            {(["p","a","d","l","a"] as const).map((ch, i) => (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${2 - i}px)` }}>{ch}</span>
            ))}
            <span style={{ display: "inline-block", width: "0.55em", height: "0.55em", borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", margin: "0 0.02em 0.05em", transform: "translateY(-1px)" }} />
          </span>
        </div>
      </Link>
    </div>
  );
}
