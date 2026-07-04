"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setLoading(false); }, [pathname]);

  useEffect(() => {
    const show = () => setLoading(true);
    window.addEventListener("padelop:nav-start", show);
    return () => window.removeEventListener("padelop:nav-start", show);
  }, []);

  if (!loading) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9997, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(0,212,85,0.25)", borderTopColor: "#00D455", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}
