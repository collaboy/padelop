import Link from "next/link";

function CourtMark() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="26" height="18" rx="1.5" stroke="#3a7a3a" strokeWidth="1.5" />
      <line x1="14" y1="1" x2="14" y2="19" stroke="#3a7a3a" strokeWidth="1.5" />
      <line x1="1" y1="10" x2="27" y2="10" stroke="#3a7a3a" strokeWidth="2" />
      <rect x="5" y="6" width="4" height="8" rx="2" fill="#3a7a3a" opacity="0.15" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 bg-[var(--bg)] border-b border-[var(--border)]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--text)]">
          Padelop
        </span>
        <Link href="/" aria-label="Home">
          <CourtMark />
        </Link>
        <Link href="/profile" className="text-[var(--muted)] hover:text-[var(--text)] transition-colors">
          <UserIcon />
        </Link>
      </div>
    </header>
  );
}
