"use client";

import CategoryScoresCard from "@/components/category-scores-card";

const pct = 71;

const sections = [
  {
    title: "Performance",
    items: [
      {
        label: "Match Results",
        sub: "Score, opponent level, duration",
        value: "W 6-4 6-3",
        pct: 80,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="8" cy="16" rx="2.5" ry="2.5" /><line x1="10" y1="14" x2="19" y2="5" /><path d="M17 3l4 4-2 2-4-4z" />
          </svg>
        ),
      },
      {
        label: "Shot Quality",
        sub: "Consistency notes",
        value: "Good",
        pct: 72,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" />
          </svg>
        ),
      },
      {
        label: "Match Feel",
        sub: "Energy rating",
        value: "7 / 10",
        pct: 70,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Recovery",
    items: [
      {
        label: "Sleep",
        sub: "Hours + quality",
        value: "7h 20m",
        pct: 92,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ),
      },
      {
        label: "HRV",
        sub: "Resting heart rate",
        value: "62 bpm",
        pct: 78,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 12 6 8 9 14 12 10 15 12 18 9 21 12" />
          </svg>
        ),
      },
      {
        label: "Soreness",
        sub: "Fatigue level",
        value: "Moderate",
        pct: 55,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="2" /><path d="M9 22V12l3-3 3 3v10" /><path d="M6 17l3-3" /><path d="M18 17l-3-3" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Physical Health",
    items: [
      {
        label: "Hydration",
        sub: "Litres today",
        value: "1.8L / 3.5L",
        pct: 51,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" />
          </svg>
        ),
      },
      {
        label: "Nutrition",
        sub: "Meal quality, pre/post match",
        value: "Good",
        pct: 70,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 17c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9H4v8z" />
            <path d="M4 9c0-2 1.5-3.5 4-4 1-.2 2-.3 4-.3s3 .1 4 .3c2.5.5 4 2 4 4" />
            <path d="M8 9V7" /><path d="M12 9V6" /><path d="M16 9V7" />
          </svg>
        ),
      },
      {
        label: "Body Weight",
        sub: "Optional",
        value: "78 kg",
        pct: 85,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="12" rx="2" /><path d="M8 8V6a4 4 0 0 1 8 0v2" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Training",
    items: [
      {
        label: "Sessions",
        sub: "Completed vs planned",
        value: "2 / 3",
        pct: 66,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="10" width="4" height="4" rx="1" /><rect x="18" y="10" width="4" height="4" rx="1" />
            <line x1="6" y1="12" x2="18" y2="12" /><line x1="8" y1="8" x2="8" y2="16" /><line x1="16" y1="8" x2="16" y2="16" />
          </svg>
        ),
      },
      {
        label: "Drill Focus",
        sub: "Focus areas this week",
        value: "Bandeja",
        pct: 60,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="#fff" />
          </svg>
        ),
      },
      {
        label: "Strength & Cardio",
        sub: "Sessions this week",
        value: "1 session",
        pct: 50,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Wellbeing",
    items: [
      {
        label: "Stress",
        sub: "Mental readiness",
        value: "Low",
        pct: 80,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        ),
      },
      {
        label: "Motivation",
        sub: "Level today",
        value: "High",
        pct: 88,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21C12 21 3 14 3 8a4 4 0 0 1 9-1.8A4 4 0 0 1 21 8c0 6-9 13-9 13z" />
          </svg>
        ),
      },
      {
        label: "Injury Flags",
        sub: "Active concerns",
        value: "None",
        pct: 100,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      },
    ],
  },
];

export default function OptimizerPage() {
  return (
    <div className="pt-[80px] pb-24 px-5 md:px-12">

      <CategoryScoresCard />

      {/* Currently tracking card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-4 shadow-sm mb-6">
        <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Currently Tracking</p>
        <p className="text-sm text-[var(--text)] font-medium">
          {sections.map((s, i) => (
            <span key={s.title}>{s.title}{i < sections.length - 1 ? ", " : ""}</span>
          ))}
        </p>
        <button className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-white text-xs font-bold text-[var(--text)] shadow-sm active:scale-95 transition-transform">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
          </svg>
          Add new
        </button>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">{section.title}</p>
          <div className="flex flex-col gap-3">
            {section.items.map((item) => (
              <div key={item.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-4 flex items-center gap-4 shadow-sm">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#2653d4" }}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-[var(--text)]">{item.label}</p>
                    <p className="text-xs text-[var(--muted)]">{item.value}</p>
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-1.5">{item.sub}</p>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: "#2653d4" }} />
                  </div>
                </div>
                <span className="text-sm font-bold text-[var(--muted)] w-8 text-right">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
