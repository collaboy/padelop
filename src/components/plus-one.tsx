"use client";
import { useEffect, useState } from "react";

const SCORE_KEY = "padelop:pad-score";
const DELAY = 2500;
const DURATION = 950;

type Anim = { id: number };
let _id = 0;

export default function PlusOne() {
  const [anims, setAnims] = useState<Anim[]>([]);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    try { setScore(parseInt(localStorage.getItem(SCORE_KEY) ?? "0", 10) || 0); } catch { setScore(0); }

    const handler = () => {
      const id = ++_id;
      setAnims(p => [...p, { id }]);
      setTimeout(() => {
        setAnims(p => p.filter(a => a.id !== id));
        setScore(prev => {
          const next = (prev ?? 0) + 1;
          try { localStorage.setItem(SCORE_KEY, String(next)); } catch {}
          return next;
        });
      }, DELAY + DURATION);
    };
    window.addEventListener("padelop:plus-one", handler);
    return () => window.removeEventListener("padelop:plus-one", handler);
  }, []);

  const numStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    fontFamily: "var(--font-geist-sans)",
    lineHeight: 1,
  };

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

      {/* Persistent score — always visible */}
      {score !== null && (
        <div style={{ position: "fixed", top: 56, right: 20, zIndex: 9997, pointerEvents: "none" }}>
          <div style={{ ...numStyle, color: "rgba(0,0,0,0.18)" }}>{score}</div>
        </div>
      )}

      {/* +1 animations — same anchor point, floats upward */}
      {anims.length > 0 && (
        <div style={{ position: "fixed", top: 56, right: 20, zIndex: 9998, pointerEvents: "none" }}>
          {anims.map(a => (
            <div key={a.id} style={{
              ...numStyle,
              color: "#16a34a",
              animation: `p1-float ${DURATION}ms cubic-bezier(0.16,1,0.3,1) ${DELAY}ms both`,
            }}>
              +1
            </div>
          ))}
        </div>
      )}
    </>
  );
}
