"use client";
import { useEffect, useState } from "react";

type Anim = { id: number };
let _id = 0;

export default function PlusOne() {
  const [anims, setAnims] = useState<Anim[]>([]);

  useEffect(() => {
    const handler = () => {
      const id = ++_id;
      setAnims(p => [...p, { id }]);
      setTimeout(() => setAnims(p => p.filter(a => a.id !== id)), 950);
    };
    window.addEventListener("padelop:plus-one", handler);
    return () => window.removeEventListener("padelop:plus-one", handler);
  }, []);

  if (!anims.length) return null;

  return (
    <>
      <style>{`
        @keyframes p1-float {
          0%   { opacity: 0; transform: translateY(0) scale(0.3); }
          18%  { opacity: 1; transform: translateY(-10px) scale(1.25); }
          36%  { opacity: 1; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.95); }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingTop: 56, paddingRight: 20 }}>
        {anims.map(a => (
          <div key={a.id} style={{
            position: "absolute",
            fontSize: 40,
            fontWeight: 800,
            color: "#16a34a",
            letterSpacing: "-0.02em",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            animation: "p1-float 0.95s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            +1
          </div>
        ))}
      </div>
    </>
  );
}
