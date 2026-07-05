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

function PadlaSheet({ onClose }: { onClose: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const sd: Record<string, string[]> = (() => { try { return JSON.parse(localStorage.getItem("padelop:schedule-done") || "{}"); } catch { return {}; } })();
  const allCompletions = Object.values(sd).flat();
  const breakdown: Record<string, number> = {};
  allCompletions.forEach(t => { breakdown[t] = (breakdown[t] ?? 0) + 1; });
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const visible = showAll ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5;
  const score = allCompletions.length;
  const MILESTONES = [10, 25, 50, 75, 100, 250, 500, 1000];
  const nextMilestone = MILESTONES.find(m => m > score) ?? null;
  const toNext = nextMilestone !== null ? nextMilestone - score : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9990, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <style>{`@keyframes padla-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, background: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: "12px 20px 48px", animation: "padla-sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", maxHeight: "70dvh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        {/* Hero block */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e2e2", margin: "0 auto 24px" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#00D455", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1 }}>{allCompletions.length}</span>
          </div>
          <p className="t-label" style={{ color: "#d97706", margin: "0 0 4px" }}>Lifetime Padla Points</p>
          <p style={{ margin: 0, fontSize: 12, color: "#9aa0a6", lineHeight: 1.4 }}>Every Padla Point represents one completed positive action.</p>
        </div>
        {nextMilestone !== null && (
          <div style={{ margin: "0 0 20px", padding: "12px 14px", borderRadius: 14, background: "#fef3c7", display: "flex", flexDirection: "column", gap: 2 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#92400e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>
              <span style={{ fontWeight: 700 }}>Next milestone: {nextMilestone}</span>
              <span style={{ fontWeight: 400, opacity: 0.75 }}> &middot; {toNext} action{toNext === 1 ? "" : "s"} to go</span>
            </p>
          </div>
        )}
        <p className="t-label" style={{ color: "#8a9096", margin: "0 0 14px" }}>Activity breakdown</p>
        {entries.length === 0 ? (
          <p style={{ fontSize: 15, color: "#9aa0a6", margin: 0 }}>No activities yet. Start completing tasks on the home screen.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map(([title, count]) => (
              <div key={title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: "#1a1c1c" }}>{title}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#d97706", background: "#fef3c7", borderRadius: 999, padding: "2px 10px" }}>×{count}</span>
              </div>
            ))}
            {hasMore && (
              <button
                onClick={e => { e.stopPropagation(); setShowAll(p => !p); }}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "#8a9096", fontSize: 13, fontWeight: 600 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: showAll ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
                {showAll ? "Show less" : `Show all ${entries.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlusOne() {
  const [anims, setAnims] = useState<Anim[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setScore(readPadlaScore());

    const onPlusOne = (e: Event) => {
      const delay = (e as CustomEvent).detail?.delay ?? 2500;
      const id = ++_id;
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

    const onOpenPanel = () => setSheetOpen(p => !p);

    window.addEventListener("padelop:plus-one", onPlusOne);
    window.addEventListener("storage", onStorage);
    window.addEventListener("padelop:open-padla-panel", onOpenPanel);
    return () => {
      window.removeEventListener("padelop:plus-one", onPlusOne);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("padelop:open-padla-panel", onOpenPanel);
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
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9997, pointerEvents: "auto" }}>
          <div
            onClick={() => setSheetOpen(p => !p)}
            style={{ ...numStyle, color: "rgba(0,0,0,0.10)", cursor: "pointer" }}
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

      {sheetOpen && <PadlaSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
