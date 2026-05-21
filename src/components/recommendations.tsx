import type { Recommendation } from "@/lib/types";

function getRecommendations(
  todayYMD: string,
  gameDays: string[]
): Recommendation[] {
  const today = new Date(todayYMD);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const tomorrowYMD = tomorrow.toISOString().slice(0, 10);
  const yesterdayYMD = yesterday.toISOString().slice(0, 10);

  const isGameToday = gameDays.includes(todayYMD);
  const isGameTomorrow = gameDays.includes(tomorrowYMD);
  const isGameYesterday = gameDays.includes(yesterdayYMD);

  if (isGameToday) {
    return [
      { category: "exercise", text: "10-minute dynamic warmup: lateral shuffles, arm circles, split steps. Keep it light — save your legs for the match." },
      { category: "nutrition", text: "Easy on the fiber today. A light meal 2–3 hours before: rice, chicken, banana. Hydrate steadily from now." },
      { category: "recovery", text: "Game day. Focus on activation, not fatigue. Sleep 7–8h tonight for post-match recovery." },
    ];
  }

  if (isGameTomorrow) {
    return [
      { category: "exercise", text: "Moderate intensity today — footwork drills or light resistance work. No heavy legs the day before a match." },
      { category: "nutrition", text: "Start carb-loading: pasta, potatoes, or rice at dinner. Lay off alcohol and heavy fats." },
      { category: "tip", text: "Get 8h of sleep tonight. Courts won't wait — your reaction time will." },
    ];
  }

  if (isGameYesterday) {
    return [
      { category: "recovery", text: "Active recovery day. A 20-min walk or light swim helps clear lactate without adding stress." },
      { category: "nutrition", text: "Protein-forward meals today: eggs, lean meat, legumes. Repair the muscle damage from yesterday." },
      { category: "tip", text: "Rate your match performance while it's fresh — what would you do differently?" },
    ];
  }

  return [
    { category: "exercise", text: "No match this week yet? Good time for strength work: lateral lunges, single-leg RDLs, rotator cuff exercises." },
    { category: "nutrition", text: "Balanced baseline: aim for 2L of water, one piece of fruit, vegetables with every meal." },
    { category: "tip", text: "Book your next session. Consistency beats intensity — two padel sessions a week is where improvement compounds." },
  ];
}

const categoryConfig: Record<
  Recommendation["category"],
  { label: string; color: string }
> = {
  exercise: { label: "Exercise", color: "#3a7a3a" },
  nutrition: { label: "Nutrition", color: "#2563eb" },
  recovery: { label: "Recovery", color: "#7c3aed" },
  tip: { label: "Tip", color: "#b45309" },
};

type Props = {
  todayYMD: string;
  gameDays: string[];
};

export default function Recommendations({ todayYMD, gameDays }: Props) {
  const recs = getRecommendations(todayYMD, gameDays);

  return (
    <div className="mt-6 flex flex-col gap-3">
      {recs.map((rec, i) => {
        const cfg = categoryConfig[rec.category];
        return (
          <div
            key={i}
            className="bg-[var(--surface)] rounded-xl px-4 py-4"
            style={{ borderLeft: `3px solid ${cfg.color}` }}
          >
            <p
              className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5"
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </p>
            <p className="text-sm leading-relaxed text-[var(--text)]">{rec.text}</p>
          </div>
        );
      })}
    </div>
  );
}
