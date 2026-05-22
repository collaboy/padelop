import Link from "next/link";

export default function Nav() {
  return (
    <header className="fixed top-0 w-full z-50 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="flex justify-between items-center w-full px-5 md:px-12 max-w-7xl mx-auto h-16">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>
          {"Padelop".split("").map((char, i) => (
            <span key={i} style={{ position: "relative", top: `${-i * 1.5}px` }}>{char}</span>
          ))}
        </h1>
        <nav className="hidden md:flex gap-8">
          {["Schedule", "Training", "Recovery"].map((item, i) => (
            <Link
              key={item}
              href={i === 0 ? "/" : `/${item.toLowerCase()}`}
              className="text-xs font-bold tracking-widest uppercase transition-colors"
              style={{ color: i === 0 ? "var(--green)" : "var(--muted)", borderBottom: i === 0 ? "2px solid var(--green)" : "none", paddingBottom: i === 0 ? "2px" : "0" }}
            >
              {item}
            </Link>
          ))}
        </nav>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--border)] cursor-pointer active:scale-95 transition-transform bg-[var(--green-light)] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green-mid)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
      </div>
    </header>
  );
}
