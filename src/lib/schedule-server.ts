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
      { time: "07:00", title: "Wake up",        body: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",      body: "Oats, eggs, fruit" },
      { time: "09:00", title: "Mobility Exercise",       body: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Pre-match meal", body: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warm up",        body: "Dynamic drills, 30 min" },
      { time: mt,                    title: "Match",           body: "Game time — trust your prep" },
      { time: addMins(mH, mM, 90),   title: "Cool down",      body: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",  body: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down",      body: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up",     body: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Breakfast",   body: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Short walk",  body: "20 min easy — helps flush out lactic acid" },
      { time: "10:30", title: "Stretch",     body: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Lunch",       body: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower", body: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",      body: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Wind down",   body: "Sleep is your best recovery tool tonight" },
    ],
    training: [
      { time: "07:00", title: "Wake up",         body: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",        body: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Mobility Exercise",         body: "Hip flexors, thoracic spine, ankles" },
      { time: "11:00", title: "Skill Prep",       body: "Today's drill focus — open the app for details" },
      { time: "12:30", title: "Lunch",            body: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",  body: "Walk, swim or light cycling" },
      { time: "19:00", title: "Dinner",           body: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",    body: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",        body: "No screens, consistent bedtime" },
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
