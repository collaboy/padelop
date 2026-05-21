"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12L12 3l9 9" />
        <path d="M9 21V12h6v9" />
        <path d="M5 10v11h14V10" />
      </svg>
    ),
  },
  {
    href: "/training",
    label: "Training",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="8" cy="16" rx="2.5" ry="2.5" />
        <line x1="10" y1="14" x2="19" y2="5" />
        <path d="M17 3l4 4-2 2-4-4z" />
      </svg>
    ),
  },
  {
    href: "/fitness",
    label: "Fitness",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="4" height="4" rx="1" />
        <rect x="18" y="10" width="4" height="4" rx="1" />
        <line x1="6" y1="12" x2="18" y2="12" />
        <line x1="8" y1="8" x2="8" y2="16" />
        <line x1="16" y1="8" x2="16" y2="16" />
      </svg>
    ),
  },
  {
    href: "/wellbeing",
    label: "Wellbeing",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21C12 21 3 14 3 8a4 4 0 0 1 9-1.8A4 4 0 0 1 21 8c0 6-9 13-9 13z" />
      </svg>
    ),
  },
  {
    href: "/ranking",
    label: "Ranking",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[var(--surface)] border-t border-[var(--border)]">
      <div className="max-w-2xl mx-auto h-16 flex items-center">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-2 transition-colors"
              style={{ color: active ? "var(--green)" : "var(--muted)" }}
            >
              {item.icon}
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
