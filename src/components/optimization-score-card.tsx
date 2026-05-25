"use client";

interface Props {
  pct: number;
  tip?: { title: string; gain: number };
}

export default function OptimizationScoreCard({ pct, tip }: Props) {
  return (
    <div className="mb-4">
      {/* Card */}
      <div className="w-full bg-[var(--surface)] flex flex-col border border-[var(--border)] rounded-2xl shadow-sm px-5 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] text-left leading-tight">Padel<br />Optimization<br />Score</p>
          <span className="text-3xl font-extrabold leading-none" style={{ color: "var(--green)", fontFamily: "var(--font-hanken)" }}>
            {pct}<span className="text-base font-bold text-[var(--muted)]">/100</span>
          </span>
        </div>
        {tip && (
          <div className="flex items-center gap-2 mt-3">
            <p className="text-sm font-bold text-[var(--text)] leading-none">{tip.title}</p>
            <svg width="14" height="9" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="0" y1="5" x2="13" y2="5" /><polyline points="9,1 13,5 9,9" />
            </svg>
            <span className="text-sm font-bold leading-none" style={{ color: "var(--green)" }}>+{tip.gain}%</span>
          </div>
        )}
      </div>

      {/* Gauge — outside the card */}
      <div className="w-full mt-3 px-1 relative" style={{ paddingBottom: 20 }}>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)" }} />
        <div className="absolute" style={{ left: `calc(${pct}% - 5px)`, top: 14 }}>
          <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
            <polygon points="5,0 0,7 10,7" fill="#171c1f" />
          </svg>
        </div>
      </div>
    </div>
  );
}
