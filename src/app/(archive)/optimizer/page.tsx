"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CategoryScoresCard from "@/components/category-scores-card";
import OptimizationScoreCard from "@/components/optimization-score-card";
import ReadinessWidget from "@/components/readiness-widget";
import Recommendations, { getRecommendations, RecCard } from "@/components/recommendations";
import LogSheet from "@/components/log-sheet";

const STORAGE_KEY = "padelop:game-days";
const REVIEWS_KEY = "padelop:match-reviews";

type ReviewEntry = {
  ts: string;
  feeling: string; result: string; opponent: string; energy: string; injury: string;
  wellDone: string[]; improved: string[];
  mentalBefore: string; mentalDuring: string; mentalAfter: string;
};

function ThumbsUpIcon({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

const pct = 71;
const ringR = 52;
const ringC = 2 * Math.PI * ringR;
const matchReadyHeading = pct >= 80 ? "Great Work!" : pct >= 65 ? "Looking Good!" : pct >= 50 ? "Keep Going!" : "Room to Grow";
const matchReadySubtitle = pct >= 80 ? "You're on track for a strong performance." : pct >= 65 ? "A few tweaks and you'll be match-ready." : pct >= 50 ? "Focus on recovery and nutrition today." : "Build your base — small habits compound fast.";
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

const tip = { title: "Sleep 8h tonight", gain: 7 };

export default function OptimizerPage() {
  const todayYMD = new Date().toISOString().slice(0, 10);
  const [gameDays, setGameDays] = useState<string[]>([]);
  const [lastReview, setLastReview] = useState<ReviewEntry | null>(null);
  const [doneRecs, setDoneRecs] = useState<Set<number>>(new Set());
  const [logOpen, setLogOpen] = useState(false);

  function toggleRec(i: number) {
    setDoneRecs((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  }

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setGameDays(JSON.parse(s));
    } catch {}
    try {
      const r = localStorage.getItem(REVIEWS_KEY);
      if (r) {
        const reviews: ReviewEntry[] = JSON.parse(r);
        if (reviews.length > 0) setLastReview(reviews[reviews.length - 1]);
      }
    } catch {}

    const onStorage = () => {
      try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) setGameDays(JSON.parse(s));
      } catch {}
      try {
        const r = localStorage.getItem(REVIEWS_KEY);
        if (r) {
          const reviews: ReviewEntry[] = JSON.parse(r);
          if (reviews.length > 0) setLastReview(reviews[reviews.length - 1]);
        }
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const reviewedToday = lastReview?.ts.slice(0, 10) === todayYMD;
  const recs = getRecommendations(todayYMD, gameDays);
  const doneRecsList = recs.map((rec, i) => ({ rec, i })).filter(({ i }) => doneRecs.has(i));
  const hasDone = reviewedToday || doneRecsList.length > 0;
  const allDone = reviewedToday && doneRecs.size >= recs.length;

  const reviewCard = (done: boolean) => (
    <button key="review" onClick={() => setLogOpen(true)} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-4 py-4 flex items-center gap-4 active:opacity-70 transition-opacity text-left" style={{ opacity: done ? 0.55 : 1 }}>
      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: done ? "#16a34a" : "#2653d4" }}>
        {done
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug" style={{ color: done ? "var(--muted)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>Review Your Last Match</p>
        <p className="text-xs text-[var(--muted)] leading-snug mt-0.5">{done ? "Tap to update" : "Rate performance while it's still fresh"}</p>
      </div>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="3,1 8,5 3,9" /></svg>
    </button>
  );

  return (
    <div className="pt-3 pb-24 px-5 md:px-12">

      <ReadinessWidget />

      {/* Match Ready hero card */}
      <div className="pb-4">
        <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm px-4 py-1 flex flex-col items-center text-center gap-2">
          <div className="relative w-full" style={{ maxWidth: 260, aspectRatio: "1/1", marginTop: "-20px", marginBottom: "-28px" }}>
            <svg width="100%" height="100%" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={ringR} fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle
                cx="80" cy="80" r={ringR} fill="none"
                stroke="#2653d4" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={ringC * (1 - pct / 100)}
                style={{ transform: "rotate(-90deg)", transformOrigin: "80px 80px", transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <p className="text-[8px] font-bold tracking-wide uppercase text-[var(--muted)] leading-none">MATCH READY</p>
              <p className="text-4xl font-extrabold leading-none text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>{pct}<span className="text-lg">%</span></p>
              <p className="text-[8px] font-bold tracking-wide uppercase text-[var(--muted)] leading-none">Optimizer Score</p>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-2xl font-extrabold text-[var(--text)] leading-tight mb-1" style={{ fontFamily: "var(--font-hanken)" }}>{matchReadyHeading}</p>
            <p className="text-xs text-[var(--muted)] leading-snug mb-4">{matchReadySubtitle}</p>
            <Link href="/optimizer" className="flex items-center gap-2 px-5 py-2.5 mb-6 rounded-full border border-[var(--border)] text-[12px] font-bold tracking-widest uppercase active:scale-95 transition-transform" style={{ background: "var(--bg)", color: "var(--muted)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              Improve Score
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,1 8,5 3,9" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <OptimizationScoreCard pct={pct} tip={tip} />

      {/* Action Plan */}
      <div className="mb-6">
        <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-3">Action Plan</p>
        <div className="flex flex-col gap-3">
          {allDone ? (
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-4 py-8 flex flex-col items-center justify-center gap-2">
              <ThumbsUpIcon size={40} color="var(--text)" />
              <p className="text-base font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-hanken)" }}>All done for today</p>
              <p className="text-xs text-[var(--muted)]">Great work — rest up and come back tomorrow</p>
              <button onClick={() => setDoneRecs(new Set())} className="mt-2 px-4 py-1.5 rounded-full border border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--muted)] bg-[var(--surface)] active:scale-95 transition-transform">Edit</button>
            </div>
          ) : (
            <>
              {!reviewedToday && reviewCard(false)}
              <Recommendations selectedYMD={todayYMD} gameDays={gameDays} doneItems={doneRecs} onToggle={toggleRec} cardTaps={{ "Protein Recovery": () => setLogOpen(true) }} />
            </>
          )}
          {hasDone && !allDone && (
            <div className="mt-1">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--muted)] mb-2">Done</p>
              <div className="flex flex-col gap-3">
                {doneRecsList.map(({ rec, i }) => <RecCard key={i} rec={rec} isDone onToggle={() => toggleRec(i)} />)}
                {reviewedToday && reviewCard(true)}
              </div>
            </div>
          )}
        </div>
      </div>

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

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
