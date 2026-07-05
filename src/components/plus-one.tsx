"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { openPadlaPanel } from "@/lib/nav-events";

const DURATION = 950;

type Anim = { id: number; delay: number };
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
  const pathname = usePathname();
  const onMyGame = pathname === "/my-game";

  useEffect(() => {
    setScore(readPadlaScore());

    const onPlusOne = (e: Event) => {
      const delay = (e as CustomEvent).detail?.delay ?? 2500;
      const id = ++_id;
      // Mount immediately but invisible; CSS delay handles the wait
      setAnims(p => [...p, { id, delay }]);
      setTimeout(() => {
        setAnims(p => p.filter(a => a.id !== id));
        setScore(readPadlaScore());
      }, delay + DURATION + 100);
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
          0%   { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.85); }
          20%  { opacity: 1; transform: translate3d(0, -6px, 0) scale(1.05); }
          100% { opacity: 0; transform: translate3d(0, -60px, 0) scale(1); }
        }
      `}</style>

      {score !== null && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9997, pointerEvents: onMyGame ? "auto" : "none" }}>
          <div
            onClick={onMyGame ? openPadlaPanel : undefined}
            style={{ ...numStyle, color: "rgba(0,0,0,0.10)", cursor: onMyGame ? "pointer" : "default" }}
          >
            {score}
          </div>
        </div>
      )}

      {anims.length > 0 && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9998, pointerEvents: "none" }}>
          {anims.map(a => (
            <div key={a.id} style={{
              ...numStyle,
              color: "#16a34a",
              opacity: 0,
              willChange: "transform, opacity",
              animation: `p1-float ${DURATION}ms ease-out ${a.delay}ms forwards`,
            }}>
              +1
            </div>
          ))}
        </div>
      )}
    </>
  );
}
