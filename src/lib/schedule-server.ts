export type ScheduleItem = { time: string; title: string; body: string };

function addMins(h: number, m: number, delta: number): string {
  const total = h * 60 + m + delta;
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function getScheduleItems(
  dayType: "match" | "recovery" | "training",
  matchTime: string | null
): ScheduleItem[] {
  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 18;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "18:30";

  const items: Record<string, Array<{ time: string; title: string; body: string }>> = {
    match: [
      { time: "07:00", title: "Padla says: Wake up! Drink water!", body: "500ml before anything else" },
      { time: "07:30", title: "Padla says: Time for breakfast",    body: "Oats, eggs, fruit" },
      { time: "09:00", title: "Padla says: Get moving — mobility time [15 min]", body: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Padla says: Fuel up before the match", body: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Padla says: Time to warm up [30 min]", body: "Dynamic movement — get loose" },
      { time: mt,                    title: "Padla says: It's match time",           body: "Trust your prep" },
      { time: addMins(mH, mM, 90),   title: "Padla says: Cool it down [15 min]",    body: "Stretch & mobility" },
      { time: addMins(mH, mM, 120),  title: "Padla says: Recovery window — eat now [30 min]", body: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Padla says: Start winding down", body: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Padla says: Wake up! Drink water!", body: "Rehydrate after yesterday" },
      { time: "08:00", title: "Padla says: Time for breakfast",    body: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Padla says: Get outside for a walk [20 min]", body: "Easy pace — flush out lactic acid" },
      { time: "10:30", title: "Padla says: Time to stretch [15 min]", body: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Padla says: Time for lunch",        body: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Padla says: Cold shower time [2 min]", body: "Reduces inflammation" },
      { time: "19:00", title: "Padla says: Dinner time",           body: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Padla says: Start winding down",    body: "Sleep is your best recovery tool tonight" },
    ],
    training: [
      { time: "07:00", title: "Padla says: Wake up! Drink water!", body: "500ml before coffee" },
      { time: "07:30", title: "Padla says: Time for breakfast",    body: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Padla says: Get moving — mobility time [15 min]", body: "Hip flexors, thoracic spine, ankles" },
      { time: "11:00", title: "Padla says: Time to drill [6 min]", body: "Open the app — today's focus is ready" },
      { time: "12:30", title: "Padla says: Time for lunch",        body: "Carbs + protein + greens" },
      { time: "15:00", title: "Padla says: Light movement time [20 min]", body: "Walk, swim or light cycling" },
      { time: "19:00", title: "Padla says: Dinner time",           body: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Padla says: Eyes closed — visualisation [5 min]", body: "Mental rehearsal of key patterns" },
      { time: "22:30", title: "Padla says: Start winding down",    body: "No screens, consistent bedtime" },
    ],
  };

  return items[dayType];
}

// Returns items whose scheduled time falls within [nowMins - 5, nowMins + 15)
// to account for cron firing up to 15 min after the scheduled time
export function dueItems(items: ScheduleItem[], localMinutes: number): ScheduleItem[] {
  return items.filter(item => {
    const [h, m] = item.time.split(":").map(Number);
    const t = h * 60 + m;
    return t >= localMinutes - 5 && t < localMinutes + 15;
  });
}
