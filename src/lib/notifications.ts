import { computeScores, loadScoringData } from "@/lib/scoring";

export type Notif = {
  time: string;
  message: string;
  link?: string;
  featured?: boolean;
};

export function computeNotifications(): Notif[] {
  const now = new Date();
  const todayYMD = now.toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  let ciDone = false;
  try { const ci = JSON.parse(localStorage.getItem("padelop:daily-checkin") || "null"); ciDone = ci?.date === todayYMD; } catch {}

  let hydroDone = false;
  try { const h = JSON.parse(localStorage.getItem("padelop:hydration-logs") || "[]")[0]; hydroDone = h?.ts?.slice(0, 10) === todayYMD; } catch {}

  let reviewDone = false;
  try { const r = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]")[0]; reviewDone = r?.ts?.slice(0, 10) === todayYMD; } catch {}

  let matchDateStr = "";
  let matchTimeStr = "";
  try {
    const m = JSON.parse(localStorage.getItem("padelop:next-match") || "null");
    if (m) { matchDateStr = m.date ?? ""; matchTimeStr = m.time ?? ""; }
  } catch {}

  let overallScore = 65;
  try {
    const data = loadScoringData();
    overallScore = computeScores(data.checkIn, data.hydration, data.review, data.nutrition, data.gameDaysThisWeek).overall;
  } catch {}

  const notifs: Notif[] = [];

  let matchMins: number | null = null;
  let matchTimeDate: Date | null = null;
  if (matchDateStr && matchTimeStr) {
    matchTimeDate = new Date(`${matchDateStr}T${matchTimeStr}:00`);
    if (!isNaN(matchTimeDate.getTime())) {
      matchMins = Math.floor((matchTimeDate.getTime() - now.getTime()) / 60000);
    }
  }

  if (matchMins !== null && matchTimeDate) {
    if (matchMins > 0 && matchMins <= 120) {
      notifs.push({ time: "Now", featured: true, message: `Match in ${matchMins < 60 ? `${matchMins}m` : `${Math.floor(matchMins / 60)}h ${matchMins % 60}m`} — start your box breathing and dynamic warm-up now.`, link: "Box Breathing (4x4)" });
    } else if (matchMins > 120 && matchMins <= 180) {
      const mealTime = new Date(matchTimeDate.getTime() - 2.5 * 3600000);
      notifs.push({ time: fmt(mealTime), featured: true, message: "Pre-match meal window is open. Aim for carbs + lean protein." });
    } else if (matchMins > 180 && matchMins <= 360) {
      notifs.push({ time: fmt(new Date(matchTimeDate.getTime() - 3 * 3600000)), message: `Match at ${matchTimeStr} — pre-match meal in ${(Math.round((matchMins - 150) / 6) / 10).toFixed(1)}h.` });
    } else if (matchMins < 0 && matchMins > -45) {
      notifs.push({ time: "Now", featured: true, message: "Match underway — stay focused, communicate, and trust your preparation." });
    } else if (matchMins <= -45 && matchMins > -90) {
      notifs.push({ time: "Now", featured: true, message: "Recovery meal window is open. Hit 20–40g protein + carbs within 30 min." });
    } else if (matchMins <= -90 && !reviewDone) {
      notifs.push({ time: fmt(new Date(matchTimeDate.getTime() + 90 * 60000)), featured: true, message: "How did it go? Log your match review while it's fresh.", link: "Review a match" });
    }
  }

  if (!ciDone) notifs.push({ time: "Daily", message: "Log your check-in to update your readiness score." });
  if (!hydroDone) notifs.push({ time: "Daily", message: "Log your hydration — staying on top of water intake improves your score." });
  if (overallScore < 60) notifs.push({ time: "Today", message: "Readiness is low — prioritise sleep and hydration before the next session." });

  return notifs;
}
