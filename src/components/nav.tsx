import Link from "next/link";

export default function Nav() {
  const pct = 71;


  return (
    <header className="fixed top-0 w-full z-50 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="grid grid-cols-3 items-center w-full px-5 md:px-12 max-w-7xl mx-auto h-16">
        {/* Left: hamburger */}
        <div className="flex items-center">
          <button className="flex flex-col gap-1.5 p-1 active:scale-90 transition-transform" aria-label="Menu">
            <span className="block w-5 h-0.5 bg-[var(--text)]" />
            <span className="block w-5 h-0.5 bg-[var(--text)]" />
            <span className="block w-5 h-0.5 bg-[var(--text)]" />
          </button>
        </div>

        {/* Center: title */}
        <div className="flex justify-center">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>
            {"Padelop!".split("").map((char, i) => (
              <span key={i} style={{ position: "relative", top: `${-i * 1.5}px` }}>{char}</span>
            ))}
          </Link>
        </div>

        {/* Right: full-scale color circle with triangle indicator at pct */}
        <div className="flex justify-end">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <defs>
              <linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="24" y1="4" x2="44" y2="24">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
              <linearGradient id="g2" gradientUnits="userSpaceOnUse" x1="44" y1="24" x2="24" y2="44">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
              <linearGradient id="g3" gradientUnits="userSpaceOnUse" x1="24" y1="44" x2="4" y2="24">
                <stop offset="0%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#84cc16" />
              </linearGradient>
              <linearGradient id="g4" gradientUnits="userSpaceOnUse" x1="4" y1="24" x2="24" y2="4">
                <stop offset="0%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {/* Full color scale arc (360°), r=20 */}
            <path d="M 24 4 A 20 20 0 0 1 44 24" fill="none" stroke="url(#g1)" strokeWidth="2.5" strokeLinecap="butt" />
            <path d="M 44 24 A 20 20 0 0 1 24 44" fill="none" stroke="url(#g2)" strokeWidth="2.5" strokeLinecap="butt" />
            <path d="M 24 44 A 20 20 0 0 1 4 24"  fill="none" stroke="url(#g3)" strokeWidth="2.5" strokeLinecap="butt" />
            <path d="M 4 24 A 20 20 0 0 1 24 4"   fill="none" stroke="url(#g4)" strokeWidth="2.5" strokeLinecap="butt" />

            {/* Percentage label */}
            <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--text)" fontFamily="var(--font-hanken)">{pct}%</text>
          </svg>
        </div>
      </div>
    </header>
  );
}
