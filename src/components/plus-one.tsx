"use client";
import { useEffect, useState } from "react";

const DELAY = 2500;
const DURATION = 950;

type Anim = { id: number };
let _id = 0;

function readPadlaScore(): number {
  try {
    const raw = JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}");
    return Object.values(raw as Record<string, string[]>).flat().length;
  } catch { return 0; }
}

export default function PlusOne() {
  const [anims, setAnims] = useState<Anim[]>([]);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    setScore(readPadlaScore());

    const onPlusOne = () => {
      const id = ++_id;
      setAnims(p => [...p, { id }]);
      setTimeout(() => {
        setAnims(p => p.filter(a => a.id !== id));
        setScore(readPadlaScore());
      }, DELAY + DURATION);
    };

    const onStorage = () => {
      const latest = readPadlaScore();
      setScore(prev => (prev !== null && latest < prev) ? latest : prev);
    };

    window.addEventListener("padelop:plus-one", onPlusOne);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("padelop:plus-one", onPlusOne);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const numStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    fontFamily: "var(--font-hanken)",
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

      {score !== null && (
        <div style={{ position: "fixed", top: 14, right: 6, zIndex: 9997, pointerEvents: "none" }}>
          <div style={{ ...numStyle, color: "rgba(0,0,0,0.10)" }}>{score}</div>
        </div>
      )}

      {anims.length > 0 && (
        <div style={{ position: "fixed", top: 14, right: 6, zIndex: 9998, pointerEvents: "none" }}>
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
