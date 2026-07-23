// Shared schedule data and logic — used by home8 and /schedule

export const pad = (n: number) => String(n).padStart(2, "0");
export const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
export const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export type DayType = "match" | "pre-match" | "recovery" | "maintenance" | "training" | "baseline";

export type DrillDef = { subtitle: string; focus: string; steps: { step: string; cue: string; reps: string }[] };
export const DRILL_LIBRARY: Record<string, DrillDef> = {
  "Serve": {
    subtitle: "Toss rhythm & arm swing — no racket needed",
    focus: "Toss rhythm · arm swing",
    steps: [
      { step: "Toss arm drill", cue: "Raise your toss arm slowly, release an imaginary ball at eye level, watch it rise. Consistency here eliminates most serve errors.", reps: "20 reps" },
      { step: "Shadow swing", cue: "Full serve motion in slow motion — trophy position, shoulder turn, pronation at contact. No racket needed.", reps: "15 each side" },
      { step: "Mental serves", cue: "Eyes closed. Visualise 5 perfect serves — placement, spin, bounce. Feel the rhythm.", reps: "5 mental reps" },
    ],
  },
  "Bandeja": {
    subtitle: "Shoulder prep & overhead shadow — anywhere",
    focus: "Shoulder prep · overhead control",
    steps: [
      { step: "Shoulder circles", cue: "Slow full arm circles forward and back. Activates the rotator cuff — the key joint in every overhead.", reps: "10 each direction" },
      { step: "Closed-face shadow", cue: "Elbow up, wrist firm, simulate the controlled downward snap of a bandeja. No backswing.", reps: "15 each side" },
      { step: "Placement visualisation", cue: "Picture a high lob, your footwork, contact point, and the ball landing in the back corner.", reps: "5 mental reps" },
    ],
  },
  "Smash": {
    subtitle: "Jump timing & contact point — no gear",
    focus: "Jump timing · contact point",
    steps: [
      { step: "Jump reach", cue: "Jump straight up reaching as high as possible. Land softly. Contact point precision starts here.", reps: "3 × 8 reps" },
      { step: "Trophy position hold", cue: "Shoulder back, elbow up, weight loaded. Hold 3 seconds, release. Builds the muscle memory for timing.", reps: "10 reps" },
      { step: "Mental overhead", cue: "Visualise 3 smashes — read the lob early, feet set before contact, clean follow-through.", reps: "3 mental reps" },
    ],
  },
  "Volleys": {
    subtitle: "Compact hand speed — desk or wall",
    focus: "Hand speed · compact technique",
    steps: [
      { step: "Wrist lock tap", cue: "Arm extended, wrist firm, punch your palm against a wall or desk. No swing — just the contact impulse.", reps: "3 × 20 reps" },
      { step: "Shadow punch volley", cue: "Forehand then backhand, elbow up, contact in front of your body. Slow and deliberate.", reps: "20 each hand" },
      { step: "Reaction snap", cue: "Close eyes, open and immediately snap into a volley position with compact arm. Trains hand-eye speed.", reps: "10 reps" },
    ],
  },
  "Defense": {
    subtitle: "Defensive footwork — any corridor or room",
    focus: "Defensive footwork · reading the lob",
    steps: [
      { step: "Lateral shuffle", cue: "3 steps left, 3 right, low centre of gravity. Quick light feet — avoid crossing your legs.", reps: "5 × 20 seconds" },
      { step: "Split step", cue: "Small soft jump, land feet shoulder-width apart, weight forward. This is your reset between every point.", reps: "20 reps" },
      { step: "Defensive lob visualisation", cue: "Picture yourself deep in the court, reading a smash early, lifting a high cross-court lob. Calm, not rushed.", reps: "5 mental reps" },
    ],
  },
  "Attack": {
    subtitle: "Quick hands & pattern recall — no gear",
    focus: "Pattern recall · net finishing",
    steps: [
      { step: "Pen drop", cue: "Hold a pen at shoulder height, drop it, catch before it reaches waist. Trains the hand speed you need for net exchanges.", reps: "15 reps" },
      { step: "Shadow volley finish", cue: "Simulate approach + compact volley finish — step forward, punch to the angle. Weight transfers forward.", reps: "15 reps" },
      { step: "Pattern recall", cue: "Recall 3 attacking sequences from your last match. What created the opening? What would you repeat?", reps: "3 minutes" },
    ],
  },
  "Positioning": {
    subtitle: "Court awareness — mental mapping",
    focus: "Court awareness · recovery lines",
    steps: [
      { step: "T-recovery shadow", cue: "Split step, move to the imaginary T, recover back. Automatic positioning starts with repetition.", reps: "20 reps" },
      { step: "Scenario mapping", cue: "Picture 5 common in-game situations and identify your optimal position for each — net, mid, back corner.", reps: "5 scenarios" },
      { step: "Match replay", cue: "Recall a point from your last match where positioning cost you. Replay it mentally with the correct position.", reps: "3 minutes" },
    ],
  },
  "Communication": {
    subtitle: "Call habits — build automaticity anywhere",
    focus: "Call habits · partner sync",
    steps: [
      { step: "Call out loud", cue: "Say 'mine', 'yours', 'leave' out loud 30 times. Building the habit under low pressure makes it instinctive under high pressure.", reps: "30 calls" },
      { step: "Pre-point routine", cue: "Practice your between-point reset — breathe, walk to position, make your call intention. Repeat until automatic.", reps: "10 reps" },
      { step: "Replay & rewrite", cue: "Recall 3 moments from your last match where a missing call cost a point. Rehearse what you would have said.", reps: "3 minutes" },
    ],
  },
  "Movement": {
    subtitle: "Padel footwork — any hallway works",
    focus: "Padel footwork · quick feet",
    steps: [
      { step: "Lateral shuffle + split", cue: "Side-to-side shuffle, 3 steps each way, ending with a soft split step. Core padel movement loop.", reps: "5 × 20 seconds" },
      { step: "Forward lunge", cue: "Step into a deep lunge, back knee near the floor, recover. Works the hip flexors critical for fast first steps.", reps: "3 × 10 each leg" },
      { step: "Quick feet burst", cue: "Rapid small steps on the spot for 10 seconds, then freeze in a split-step landing.", reps: "8 rounds" },
    ],
  },
  "Mental strength": {
    subtitle: "Box breathing & pressure visualisation",
    focus: "Focus · pressure management",
    steps: [
      { step: "Box breathing", cue: "4 in, 4 hold, 4 out, 4 hold. Activates your parasympathetic system — the same technique used before high-pressure points.", reps: "5 rounds" },
      { step: "Pressure point visualisation", cue: "Picture yourself at 6-6 tiebreak. Breathe, pick your target, execute. Feel calm, not anxious.", reps: "5 mental reps" },
      { step: "Between-point routine", cue: "Practice your full routine — bounce, breathe, pick target. Repeat until it is muscle memory.", reps: "10 reps" },
    ],
  },
};

export const DEFAULT_DRILL: DrillDef = {
  subtitle: "Movement & mental prep — no gear needed",
  focus: "Movement · mental focus",
  steps: [
    { step: "Lateral shuffle", cue: "Side-to-side with a split step. Core padel footwork.", reps: "5 × 20 seconds" },
    { step: "Box breathing", cue: "4 in, 4 hold, 4 out, 4 hold. Sharpen focus before your next session.", reps: "5 rounds" },
    { step: "Mental prep", cue: "Visualise your best performance. Recall the focus, the calm, the execution.", reps: "2 minutes" },
  ],
};

export function getTopNeedsWorkTag(): string | null {
  try {
    const reviews = JSON.parse(localStorage.getItem("padelop:match-reviews") || "[]");
    const counts: Record<string, number> = {};
    for (const r of reviews) for (const tag of (r.improved ?? [])) counts[tag] = (counts[tag] ?? 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  } catch { return null; }
}

export function getDayType(
  gameDays: string[],
  nextMatch: { date?: string; time?: string } | null,
  upcoming: { date?: string; time?: string }[],
): DayType {
  try {
    const now = new Date();
    const today    = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const tomorrow = (() => { const d = new Date(now); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

    if (nextMatch?.date === today    && nextMatch?.time) return "match";
    if (nextMatch?.date === tomorrow && nextMatch?.time) return "pre-match";
    if (upcoming.some(m => m.date === today    && m.time)) return "match";
    if (upcoming.some(m => m.date === tomorrow && m.time)) return "pre-match";

    const matchDates = [...new Set(gameDays)].filter(d => d <= today).sort().reverse();
    if (matchDates.length === 0) return "baseline";

    const lastMatchDate = matchDates[0];
    const daysSince = Math.round(
      (new Date(today + "T12:00").getTime() - new Date(lastMatchDate + "T12:00").getTime()) / 86400000
    );

    if (daysSince <= 0) return "recovery";
    if (daysSince === 1) return "recovery";
    return (daysSince - 2) % 2 === 0 ? "maintenance" : "training";
  } catch {
    return "baseline";
  }
}

export const ITEM_COLORS: Record<string, string> = {
  "Wake up": "#0e7490",
  "Breakfast": "#16a34a",
  "Mobility Exercise": "#64748b",
  "Light mobility": "#64748b",
  "Morning snack": "#16a34a",
  "Pre-match meal": "#16a34a",
  "Warm up": "#d97706",
  "Match": "#2653d4",
  "Cool down": "#64748b",
  "Recovery meal": "#16a34a",
  "Post-match lunch": "#16a34a",
  "Rest": "#0e7490",
  "Short walk": "#0e7490",
  "Stretch": "#64748b",
  "Lunch": "#16a34a",
  "Cold shower": "#0e7490",
  "Dinner": "#16a34a",
  "Early dinner": "#16a34a",
  "Active recovery": "#0e7490",
  "Visualisation": "#64748b",
  "Mental prep": "#7c3aed",
  "Wind down": "#64748b",
};

export type ScheduleItem = { time: string; title: string; subtitle?: string; color: string; isDrill?: boolean };

function buildMatchSchedule(mH: number, mM: number, mt: string): Array<{ time: string; title: string; subtitle?: string }> {
  const matchMins = mH * 60 + mM;

  // Cap post-midnight times to 23:45 to avoid currentIdx wrap-around issues
  const safeAdd = (delta: number) => {
    const total = mH * 60 + mM + delta;
    if (total >= 24 * 60) return `${pad(23)}:${pad(Math.min(59, total - 24 * 60))}`;
    return addMins(mH, mM, delta);
  };

  // Morning match (before 13:00)
  if (matchMins < 13 * 60) {
    const hasMobility = matchMins - 90 >= 8 * 60 + 30;
    const items: Array<{ time: string; title: string; subtitle?: string }> = [
      { time: "07:00", title: "Wake up", subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast", subtitle: "Light and easy to digest" },
    ];
    if (hasMobility) {
      items.push({ time: addMins(mH, mM, -90), title: "Light mobility", subtitle: "Brief activation — 15 min" });
    }
    items.push(
      { time: addMins(mH, mM, -60), title: "Warm up", subtitle: "Get loose — dynamic movement" },
      { time: mt, title: "Match", subtitle: "Game time" },
      { time: safeAdd(90), title: "Post-match lunch", subtitle: "Protein + carbs — recovery window" },
      { time: safeAdd(180), title: "Rest", subtitle: "Let your body recover" },
      { time: "19:00", title: "Dinner", subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "22:00", title: "Wind down", subtitle: "No screens, consistent bedtime" },
    );
    return items;
  }

  // Evening match (18:00 and later)
  if (matchMins >= 18 * 60) {
    return [
      { time: "07:00", title: "Wake up", subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast", subtitle: "Oats, eggs, fruit" },
      { time: "09:00", title: "Mobility Exercise", subtitle: "Foam roll & light stretching" },
      { time: "12:30", title: "Lunch", subtitle: "Chicken, rice, veg" },
      { time: addMins(mH, mM, -270), title: "Mental prep", subtitle: "Rest, visualise, stay off your feet" },
      { time: addMins(mH, mM, -150), title: "Pre-match meal", subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60), title: "Warm up", subtitle: "Get loose — dynamic movement" },
      { time: mt, title: "Match", subtitle: "Game time" },
      { time: safeAdd(90), title: "Cool down", subtitle: "Stretch & mobility, 15 min" },
      { time: safeAdd(120), title: "Recovery meal", subtitle: "Protein + carbs within 30 min" },
      { time: safeAdd(150), title: "Wind down", subtitle: "No screens, light reading" },
    ];
  }

  // Afternoon match (13:00–17:59)
  const showMorningSnack = matchMins >= 16 * 60 + 30;
  const items: Array<{ time: string; title: string; subtitle?: string }> = [
    { time: "07:00", title: "Wake up", subtitle: "500ml water before anything else" },
    { time: "07:30", title: "Breakfast", subtitle: "Oats, eggs, fruit" },
    { time: "09:00", title: "Mobility Exercise", subtitle: "Foam roll & light stretching" },
  ];
  if (showMorningSnack) {
    items.push({ time: "11:30", title: "Morning snack", subtitle: "Banana, oat bar or yogurt" });
  }
  items.push(
    { time: addMins(mH, mM, -150), title: "Pre-match meal", subtitle: "Chicken, rice, light salad" },
    { time: addMins(mH, mM, -60), title: "Warm up", subtitle: "Get loose — dynamic movement" },
    { time: mt, title: "Match", subtitle: "Game time" },
    { time: safeAdd(90), title: "Cool down", subtitle: "Stretch & mobility, 15 min" },
    { time: safeAdd(120), title: "Recovery meal", subtitle: "Protein + carbs — serves as dinner" },
    { time: "22:00", title: "Wind down", subtitle: "No screens, consistent bedtime" },
  );
  return items;
}

export function getScheduleData(dayType: DayType, matchTime: string | null, drillTag: string | null): { schedule: ScheduleItem[]; currentIdx: number } {
  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 20;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "20:30";
  const drill = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
  const drillTitle = drillTag ? `${drillTag} Focus` : "Skill Prep";

  type RawItem = { time: string; title: string; subtitle?: string; isDrill?: boolean };

  const staticSchedules: Record<Exclude<DayType, "match">, RawItem[]> = {
    "pre-match": [
      { time: "07:00", title: "Wake up",            subtitle: "500ml water to start the day" },
      { time: "07:30", title: "Breakfast",           subtitle: "Oats, eggs — carb focus today" },
      { time: "09:30", title: "Light mobility",      subtitle: "Gentle — no hard session the day before" },
      { time: "12:30", title: "Lunch",               subtitle: "Pasta, rice or potatoes — carb-rich" },
      { time: "15:00", title: "Mental prep", subtitle: "Visualise tomorrow — review your patterns" },
      { time: "18:30", title: "Early dinner",        subtitle: "Finish eating by 7pm — sleep quality matters" },
      { time: "21:30", title: "Wind down",           subtitle: "Prioritise sleep — it's your biggest lever tonight" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up",     subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Breakfast",   subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Short walk",  subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Stretch",     subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Lunch",       subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower", subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",      subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Wind down",   subtitle: "Sleep is your best recovery tool tonight" },
    ],
    maintenance: [
      { time: "07:00", title: "Wake up",        subtitle: "500ml water — maintenance day hydration still matters" },
      { time: "07:30", title: "Breakfast",       subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "10:00", title: "Short walk",      subtitle: "20 min — light movement keeps you loose" },
      { time: "12:30", title: "Lunch",           subtitle: "Chicken, salmon or legumes + veg" },
      { time: "19:00", title: "Dinner",          subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "22:00", title: "Wind down",       subtitle: "Consistent sleep schedule is performance" },
    ],
    training: [
      { time: "07:00", title: "Wake up",          subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",         subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Mobility Exercise", subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "11:00", title: drillTitle,          subtitle: drill.subtitle, isDrill: true },
      { time: "12:30", title: "Lunch",             subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Mental prep", subtitle: "Rest, visualise, stay off your feet" },
      { time: "16:00", title: "Active recovery",   subtitle: "Light walk or gentle movement" },
      { time: "19:00", title: "Dinner",            subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",     subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",         subtitle: "No screens, consistent bedtime" },
    ],
    baseline: [
      { time: "07:00", title: "Wake up",          subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",         subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Mobility Exercise", subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "12:30", title: "Lunch",             subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",   subtitle: "Light walk or gentle movement" },
      { time: "19:00", title: "Dinner",            subtitle: "Focus on variety and micronutrients" },
      { time: "22:00", title: "Wind down",         subtitle: "No screens, consistent bedtime" },
    ],
  };

  const rawItems: RawItem[] = dayType === "match"
    ? buildMatchSchedule(mH, mM, mt)
    : staticSchedules[dayType];

  const schedule: ScheduleItem[] = rawItems.map(item => ({
    ...item,
    color: item.isDrill ? "#2653d4" : (ITEM_COLORS[item.title] ?? "#8a9096"),
  }));

  const curMins = new Date().getHours() * 60 + new Date().getMinutes();
  let idx = 0;
  if (curMins >= toMins(schedule[schedule.length - 1].time)) {
    idx = schedule.length - 1;
  } else {
    for (let i = 0; i < schedule.length - 1; i++) {
      if (curMins >= toMins(schedule[i].time) && curMins < toMins(schedule[i + 1].time)) { idx = i; break; }
    }
  }
  return { schedule, currentIdx: idx };
}

export type MealOption     = { title: string; detail: string };
export type DetailMeal     = { type: 'meal';     focus: string; goal: string; options: [MealOption, MealOption, MealOption] };
export type DetailExercise = { type: 'exercise'; focus: string; steps: { step: string; cue: string; reps: string }[] };
export type DetailInfo     = { type: 'info';     focus: string; text: string };
export type ScheduleDetail = DetailMeal | DetailExercise | DetailInfo;

export const SCHEDULE_DETAILS: Record<string, ScheduleDetail> = {
  "Wake up": { type: 'info', focus: "Hydration · morning routine", text: "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration." },
  "Breakfast": { type: 'meal', focus: "Protein · slow carbs · fruit", goal: "Protein to curb hunger, slow carbs for steady energy, and fruit for a natural sugar hit to start the day.", options: [
    { title: "Scrambled eggs, oats & banana", detail: "3 eggs · 60g oats with water or milk · 1 banana. Slow carbs keep blood sugar stable through the morning." },
    { title: "Greek yogurt with granola & berries", detail: "200g full-fat Greek yogurt · 40g granola · handful of blueberries or strawberries. High protein, easy to digest." },
    { title: "Spinach omelette & wholegrain toast", detail: "3 eggs · large handful of spinach · 2 slices wholegrain toast. Good iron and B-vitamin hit to start the day." },
  ]},
  "Mobility Exercise": { type: 'exercise', focus: "Hip flexors · thoracic spine · ankles", steps: [
    { step: "Hip flexor lunge hold", cue: "Step into a deep lunge, front knee at 90°. Push hips gently forward and hold.", reps: "60 sec each side" },
    { step: "Thoracic rotation", cue: "Sit back on heels, hands behind head. Rotate your upper back slowly left and right.", reps: "10 reps each direction" },
    { step: "Ankle circles", cue: "Stand on one foot and draw slow controlled circles with your raised ankle.", reps: "10 each direction, each ankle" },
  ]},
  "Light mobility": { type: 'exercise', focus: "Activation · gentle prep", steps: [
    { step: "Leg swings", cue: "Hold a wall, swing each leg forward and back. Easy and controlled.", reps: "10 each leg" },
    { step: "Shoulder rolls", cue: "Slow full circles forward and back. Wake up the rotator cuff without loading it.", reps: "10 each direction" },
    { step: "Hip circles", cue: "Hands on hips, slow big circles. Loosen the hip capsule before tomorrow.", reps: "10 each direction" },
  ]},
  "Morning snack": { type: 'meal', focus: "Light energy · easy digestion", goal: "A quick hit of carbs and a little protein to bridge the gap to lunch without sitting heavy.", options: [
    { title: "Banana & nut butter", detail: "1 medium banana · 1 tbsp almond or peanut butter. Fast carbs + fat to bridge you to lunch without a spike." },
    { title: "Oat bar", detail: "1 oat-based bar, ideally under 10g sugar. Quick, portable, and won't sit heavy." },
    { title: "Greek yogurt", detail: "150g plain Greek yogurt. Light protein top-up — add honey if you need a bit more energy." },
  ]},
  "Pre-match meal": { type: 'meal', focus: "Easy to digest · sustained energy", goal: "Lean protein and simple carbs that digest fast, giving sustained energy without weighing you down on court.", options: [
    { title: "Chicken, white rice & cucumber", detail: "150g grilled chicken · 150g cooked white rice · cucumber slices. White rice digests faster than brown — ideal 2–3 hrs pre-match." },
    { title: "Pasta, lean mince & tomato sauce", detail: "150g pasta · 100g lean beef or turkey mince · light tomato sauce. Keep it simple — avoid cream or heavy fat before playing." },
    { title: "Jacket potato, tuna & salad", detail: "1 medium jacket potato · 1 tin tuna in water · green salad. Easy on the gut, steady energy release." },
  ]},
  "Warm up": { type: 'exercise', focus: "Neuromuscular activation · movement prep", steps: [
    { step: "Leg swings", cue: "Hold a wall for balance. Swing each leg forward and back, then laterally. Stay controlled.", reps: "15 reps each direction, each leg" },
    { step: "Lateral shuffle", cue: "Stay low, weight on balls of feet. Shuffle 5 metres left and right. Explode off each plant.", reps: "3 sets of 10 metres" },
    { step: "Shadow swings", cue: "20 forehand + 20 backhand shadow swings, building from 60% to 80% intensity. Focus on footwork and contact point.", reps: "20 each side" },
  ]},
  "Match": { type: 'info', focus: "Early rhythm · partner communication", text: "Match time. Focus on early rhythm — the first two games set the tone. Communicate constantly with your partner. Stay hydrated between sets." },
  "Cool down": { type: 'exercise', focus: "Heart rate reduction · static stretching", steps: [
    { step: "Standing quad stretch", cue: "Hold your ankle behind you against your glute. Keep the knee pointing straight down.", reps: "45 sec each leg" },
    { step: "Seated hamstring stretch", cue: "Legs straight out in front, hinge from the hips and reach towards your feet.", reps: "45 sec" },
    { step: "Shoulder cross-body stretch", cue: "Pull one arm across your chest. Keep your shoulder pressed down away from your ear.", reps: "30 sec each side" },
  ]},
  "Recovery meal": { type: 'meal', focus: "Protein + carbs · within 30 min", goal: "Protein to repair muscle and carbs to refill glycogen — eaten within 30 minutes for the fastest recovery.", options: [
    { title: "Salmon, sweet potato & spinach", detail: "150g salmon · 1 medium sweet potato · wilted spinach. The 30-minute window is real — muscle protein synthesis peaks when you eat soon after training." },
    { title: "Chicken stir-fry, noodles & broccoli", detail: "150g chicken breast · 100g egg noodles · broccoli · soy & ginger. Fast to cook, fast to digest." },
    { title: "Protein shake, toast & banana", detail: "30g whey protein in water · 2 slices wholegrain toast · 1 banana. The quickest route to the 3:1 carb-to-protein recovery ratio." },
  ]},
  "Post-match lunch": { type: 'meal', focus: "Recovery · protein + carbs", goal: "Protein to kickstart muscle repair and carbs to replenish the glycogen you burned during the match.", options: [
    { title: "Salmon, sweet potato & spinach", detail: "150g salmon · 1 medium sweet potato · spinach. Omega-3s reduce inflammation; sweet potato replenishes glycogen fast." },
    { title: "Chicken, rice & roasted veg", detail: "150g grilled chicken · 150g cooked rice · whatever veg you have. Simple, balanced, gets the job done." },
    { title: "Protein shake, toast & banana", detail: "30g whey in water · 2 slices toast · 1 banana. If you're short on time or appetite — hit the carb-protein window and eat properly later." },
  ]},
  "Rest": { type: 'info', focus: "Active recovery · circulation", text: "Rest is part of training. Keep movement minimal — a short walk is fine, nothing more. Your nervous system needs this window to consolidate adaptation from the sessions around it." },
  "Short walk": { type: 'info', focus: "Active recovery · circulation", text: "Walk at a pace where you can hold a full conversation. Low-intensity movement flushes metabolic waste from fatigued muscles without adding stress. 20 minutes is enough." },
  "Stretch": { type: 'exercise', focus: "Quads · IT band · hip flexors · calves", steps: [
    { step: "IT band roll", cue: "Side-lying, roll slowly from hip to knee on the outer thigh. Pause and breathe on tight spots.", reps: "60–90 sec each leg" },
    { step: "Quad roll", cue: "Face down, forearms supporting you. Roll from hip to knee on the front of the thigh.", reps: "60 sec each leg" },
    { step: "Hip flexor lunge stretch", cue: "Low lunge, back knee down, slight backward lean. Feel the stretch in the front of the back hip.", reps: "60 sec each side" },
  ]},
  "Lunch": { type: 'meal', focus: "Protein · carbs · greens", goal: "Lean protein, complex carbs, and leafy greens — a balanced plate to keep energy steady through the afternoon.", options: [
    { title: "Chicken, quinoa & roasted veg", detail: "150g grilled chicken · 100g quinoa · mixed roasted veg. Quinoa is a complete protein — it covers all essential amino acids." },
    { title: "Tuna niçoise — eggs & green beans", detail: "1 tin tuna · 2 boiled eggs · green beans · olives · light vinaigrette. High protein, anti-inflammatory fats, easy to prep ahead." },
    { title: "Salmon, brown rice & broccoli", detail: "150g salmon fillet · 100g brown rice · steamed broccoli. Omega-3s support joint health and reduce post-session inflammation." },
  ]},
  "Cold shower": { type: 'info', focus: "Inflammation reduction · DOMS relief", text: "Two minutes of cold water constricts blood vessels, reduces inflammation, and blunts delayed onset muscle soreness. Start warm, finish cold for the last 90–120 seconds." },
  "Dinner": { type: 'meal', focus: "Anti-inflammatory · micronutrient-rich", goal: "Omega-3-rich protein, colourful vegetables, and micronutrients that support overnight recovery and ease inflammation.", options: [
    { title: "Salmon, sweet potato & spinach", detail: "150g salmon · 1 sweet potato · wilted spinach with garlic. Omega-3s, beta-carotene, and iron in one plate." },
    { title: "Sea bass, brown rice & kale", detail: "150g sea bass fillet · 100g brown rice · steamed kale. Light on the gut at night, rich in minerals for overnight recovery." },
    { title: "Chicken thighs, couscous & roasted veg", detail: "2 chicken thighs (skin off) · 100g couscous · roasted peppers and courgette. Thighs have more zinc and iron than breast." },
  ]},
  "Early dinner": { type: 'meal', focus: "Carb focus · finish by 7pm", goal: "Carb-heavy with moderate protein, finished by 7pm so glycogen stores are full before match day.", options: [
    { title: "Pasta & chicken in tomato sauce", detail: "150g pasta · 120g chicken · light tomato sauce. Finish by 7pm so glycogen loads fully before sleep." },
    { title: "Salmon, rice & steamed veg", detail: "150g salmon · 150g cooked rice · broccoli or green beans. Balanced macros, easy to digest before bed." },
    { title: "Jacket potato, eggs & salad", detail: "1 large jacket potato · 2–3 eggs · mixed salad. High-carb, moderate protein — good pre-match evening fuel." },
  ]},
  "Active recovery": { type: 'info', focus: "Aerobic flush · below 130 bpm", text: "Walk, swim, or cycle at a pace where you can hold a full conversation. Keep heart rate below 130 bpm. Light aerobic activity maintains cardiovascular fitness without accumulating fatigue." },
  "Mental prep": { type: 'exercise', focus: "Mental rehearsal · focus", steps: [
    { step: "Box breathing", cue: "4 in, 4 hold, 4 out, 4 hold. Settle the nervous system before the match window.", reps: "5 rounds" },
    { step: "Pattern review", cue: "Recall 2–3 patterns that work for you. Not everything — just what you'll lean on today.", reps: "3 minutes" },
    { step: "Visualise the first game", cue: "Picture your first serve, first volley, first exchange. Arrive mentally before you arrive physically.", reps: "2 minutes" },
  ]},
  "Visualisation": { type: 'exercise', focus: "Mental rehearsal · pattern reinforcement", steps: [
    { step: "Replay a key moment", cue: "Pick one point from your last match that you lost. Replay it slowly in your mind — what would you change?", reps: "2 min" },
    { step: "Strongest pattern", cue: "Visualise your best attacking sequence in full detail: footwork → position → shot → result. Make it vivid.", reps: "2 min" },
    { step: "Next session intent", cue: "Walk through your next session mentally and set one specific technical focus before you begin.", reps: "1 min" },
  ]},
  "Wind down": { type: 'info', focus: "Sleep quality · screen-free wind-down", text: "Blue light from screens suppresses melatonin by up to 50%. In the 60 minutes before bed: dim lights, avoid screens, and keep the room cool for deeper sleep." },
};
