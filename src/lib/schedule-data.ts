// Shared schedule data and logic — used by home8 and /schedule

export const pad = (n: number) => String(n).padStart(2, "0");
export const addMins = (h: number, m: number, delta: number) => {
  const total = h * 60 + m + delta;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
export const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export type DrillDef = { subtitle: string; steps: { step: string; cue: string; reps: string }[] };
export const DRILL_LIBRARY: Record<string, DrillDef> = {
  "Serve": {
    subtitle: "Toss rhythm & arm swing — no racket needed",
    steps: [
      { step: "Toss arm drill", cue: "Raise your toss arm slowly, release an imaginary ball at eye level, watch it rise. Consistency here eliminates most serve errors.", reps: "20 reps" },
      { step: "Shadow swing", cue: "Full serve motion in slow motion — trophy position, shoulder turn, pronation at contact. No racket needed.", reps: "15 each side" },
      { step: "Mental serves", cue: "Eyes closed. Visualise 5 perfect serves — placement, spin, bounce. Feel the rhythm.", reps: "5 mental reps" },
    ],
  },
  "Bandeja": {
    subtitle: "Shoulder prep & overhead shadow — anywhere",
    steps: [
      { step: "Shoulder circles", cue: "Slow full arm circles forward and back. Activates the rotator cuff — the key joint in every overhead.", reps: "10 each direction" },
      { step: "Closed-face shadow", cue: "Elbow up, wrist firm, simulate the controlled downward snap of a bandeja. No backswing.", reps: "15 each side" },
      { step: "Placement visualisation", cue: "Picture a high lob, your footwork, contact point, and the ball landing in the back corner.", reps: "5 mental reps" },
    ],
  },
  "Smash": {
    subtitle: "Jump timing & contact point — no gear",
    steps: [
      { step: "Jump reach", cue: "Jump straight up reaching as high as possible. Land softly. Contact point precision starts here.", reps: "3 × 8 reps" },
      { step: "Trophy position hold", cue: "Shoulder back, elbow up, weight loaded. Hold 3 seconds, release. Builds the muscle memory for timing.", reps: "10 reps" },
      { step: "Mental overhead", cue: "Visualise 3 smashes — read the lob early, feet set before contact, clean follow-through.", reps: "3 mental reps" },
    ],
  },
  "Volleys": {
    subtitle: "Compact hand speed — desk or wall",
    steps: [
      { step: "Wrist lock tap", cue: "Arm extended, wrist firm, punch your palm against a wall or desk. No swing — just the contact impulse.", reps: "3 × 20 reps" },
      { step: "Shadow punch volley", cue: "Forehand then backhand, elbow up, contact in front of your body. Slow and deliberate.", reps: "20 each hand" },
      { step: "Reaction snap", cue: "Close eyes, open and immediately snap into a volley position with compact arm. Trains hand-eye speed.", reps: "10 reps" },
    ],
  },
  "Defense": {
    subtitle: "Defensive footwork — any corridor or room",
    steps: [
      { step: "Lateral shuffle", cue: "3 steps left, 3 right, low centre of gravity. Quick light feet — avoid crossing your legs.", reps: "5 × 20 seconds" },
      { step: "Split step", cue: "Small soft jump, land feet shoulder-width apart, weight forward. This is your reset between every point.", reps: "20 reps" },
      { step: "Defensive lob visualisation", cue: "Picture yourself deep in the court, reading a smash early, lifting a high cross-court lob. Calm, not rushed.", reps: "5 mental reps" },
    ],
  },
  "Attack": {
    subtitle: "Quick hands & pattern recall — no gear",
    steps: [
      { step: "Pen drop", cue: "Hold a pen at shoulder height, drop it, catch before it reaches waist. Trains the hand speed you need for net exchanges.", reps: "15 reps" },
      { step: "Shadow volley finish", cue: "Simulate approach + compact volley finish — step forward, punch to the angle. Weight transfers forward.", reps: "15 reps" },
      { step: "Pattern recall", cue: "Recall 3 attacking sequences from your last match. What created the opening? What would you repeat?", reps: "3 minutes" },
    ],
  },
  "Positioning": {
    subtitle: "Court awareness — mental mapping",
    steps: [
      { step: "T-recovery shadow", cue: "Split step, move to the imaginary T, recover back. Automatic positioning starts with repetition.", reps: "20 reps" },
      { step: "Scenario mapping", cue: "Picture 5 common in-game situations and identify your optimal position for each — net, mid, back corner.", reps: "5 scenarios" },
      { step: "Match replay", cue: "Recall a point from your last match where positioning cost you. Replay it mentally with the correct position.", reps: "3 minutes" },
    ],
  },
  "Communication": {
    subtitle: "Call habits — build automaticity anywhere",
    steps: [
      { step: "Call out loud", cue: "Say 'mine', 'yours', 'leave' out loud 30 times. Building the habit under low pressure makes it instinctive under high pressure.", reps: "30 calls" },
      { step: "Pre-point routine", cue: "Practice your between-point reset — breathe, walk to position, make your call intention. Repeat until automatic.", reps: "10 reps" },
      { step: "Replay & rewrite", cue: "Recall 3 moments from your last match where a missing call cost a point. Rehearse what you would have said.", reps: "3 minutes" },
    ],
  },
  "Movement": {
    subtitle: "Padel footwork — any hallway works",
    steps: [
      { step: "Lateral shuffle + split", cue: "Side-to-side shuffle, 3 steps each way, ending with a soft split step. Core padel movement loop.", reps: "5 × 20 seconds" },
      { step: "Forward lunge", cue: "Step into a deep lunge, back knee near the floor, recover. Works the hip flexors critical for fast first steps.", reps: "3 × 10 each leg" },
      { step: "Quick feet burst", cue: "Rapid small steps on the spot for 10 seconds, then freeze in a split-step landing.", reps: "8 rounds" },
    ],
  },
  "Mental strength": {
    subtitle: "Box breathing & pressure visualisation",
    steps: [
      { step: "Box breathing", cue: "4 in, 4 hold, 4 out, 4 hold. Activates your parasympathetic system — the same technique used before high-pressure points.", reps: "5 rounds" },
      { step: "Pressure point visualisation", cue: "Picture yourself at 6-6 tiebreak. Breathe, pick your target, execute. Feel calm, not anxious.", reps: "5 mental reps" },
      { step: "Between-point routine", cue: "Practice your full routine — bounce, breathe, pick target. Repeat until it is muscle memory.", reps: "10 reps" },
    ],
  },
};

export const DEFAULT_DRILL: DrillDef = {
  subtitle: "Movement & mental prep — no gear needed",
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

export const ITEM_COLORS: Record<string, string> = {
  "Wake up & hydrate": "#0e7490", "Light breakfast": "#16a34a", "Breakfast": "#16a34a",
  "Morning mobility": "#64748b", "Light mobility": "#64748b",
  "Pre-game meal": "#16a34a", "Warmup & activation": "#d97706",
  "Match": "#2653d4", "Post-match cool down": "#64748b",
  "Recovery meal": "#16a34a", "Recovery walk": "#0e7490",
  "Foam roll & stretch": "#64748b", "Protein-rich lunch": "#16a34a",
  "Cold shower": "#0e7490", "Dinner": "#16a34a",
  "Early wind down": "#64748b", "Balanced lunch": "#16a34a",
  "Active recovery": "#0e7490", "Visualisation": "#64748b",
  "Wind down": "#64748b",
};

export type ScheduleItem = { time: string; title: string; subtitle?: string; color: string; isDrill?: boolean };

export function getScheduleData(dayType: "match" | "recovery" | "training", matchTime: string | null, drillTag: string | null): { schedule: ScheduleItem[]; currentIdx: number } {
  const mH = matchTime ? parseInt(matchTime.split(":")[0]) : 18;
  const mM = matchTime ? parseInt(matchTime.split(":")[1]) : 30;
  const mt = matchTime ?? "18:30";
  const drill = DRILL_LIBRARY[drillTag ?? ""] ?? DEFAULT_DRILL;
  const drillTitle = drillTag ? `${drillTag} Focus` : "Skill Prep";
  const rawSchedules: Record<string, Array<{ time: string; title: string; subtitle?: string; isDrill?: boolean }>> = {
    match: [
      { time: "07:00", title: "Wake up & hydrate",   subtitle: "500ml water before anything else" },
      { time: "07:30", title: "Breakfast",            subtitle: "Oats, eggs, fruit" },
      { time: "09:00", title: "Morning mobility",     subtitle: "Foam roll & light stretching" },
      { time: addMins(mH, mM, -360), title: "Pre-game meal",       subtitle: "Chicken, rice, light salad" },
      { time: addMins(mH, mM, -60),  title: "Warmup & activation", subtitle: "Get loose — dynamic movement" },
      { time: mt,                    title: "Match",                subtitle: "Game time" },
      { time: addMins(mH, mM, 90),   title: "Post-match cool down", subtitle: "Stretch & mobility, 15 min" },
      { time: addMins(mH, mM, 120),  title: "Recovery meal",       subtitle: "Protein + carbs within 30 min" },
      { time: "22:30", title: "Wind down", subtitle: "No screens, light reading" },
    ],
    recovery: [
      { time: "07:30", title: "Wake up & hydrate",  subtitle: "500ml water — rehydrate after yesterday" },
      { time: "08:00", title: "Light breakfast",     subtitle: "Eggs, fruit, Greek yogurt" },
      { time: "09:30", title: "Recovery walk",       subtitle: "20 min easy — flush out lactic acid" },
      { time: "10:30", title: "Foam roll & stretch", subtitle: "Quads, hip flexors, calves, shoulders" },
      { time: "13:00", title: "Protein-rich lunch",  subtitle: "Chicken, salmon or legumes + veg" },
      { time: "15:30", title: "Cold shower",         subtitle: "2 min cold — reduces inflammation" },
      { time: "19:00", title: "Dinner",              subtitle: "Anti-inflammatory focus — fish, greens" },
      { time: "21:30", title: "Early wind down",     subtitle: "Sleep is your best recovery tool tonight" },
    ],
    training: [
      { time: "07:00", title: "Wake up & hydrate", subtitle: "500ml water before coffee" },
      { time: "07:30", title: "Breakfast",          subtitle: "High protein — eggs, yogurt, fruit" },
      { time: "09:30", title: "Light mobility",     subtitle: "Hip flexors, thoracic spine, ankles" },
      { time: "11:00", title: drillTitle,           subtitle: drill.subtitle, isDrill: true },
      { time: "12:30", title: "Balanced lunch",     subtitle: "Carbs + protein + greens" },
      { time: "15:00", title: "Active recovery",    subtitle: "Light walk or gentle movement" },
      { time: "19:00", title: "Dinner",             subtitle: "Focus on variety and micronutrients" },
      { time: "21:00", title: "Visualisation",      subtitle: "5 min mental rehearsal of key patterns" },
      { time: "22:30", title: "Wind down",          subtitle: "No screens, consistent bedtime" },
    ],
  };
  const schedule: ScheduleItem[] = rawSchedules[dayType].map(item => ({
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

export type DetailMeal     = { type: 'meal';     focus: string; options: [string, string, string] };
export type DetailExercise = { type: 'exercise'; focus: string; steps: { step: string; cue: string; reps: string }[] };
export type DetailInfo     = { type: 'info';     text: string };
export type ScheduleDetail = DetailMeal | DetailExercise | DetailInfo;

export const SCHEDULE_DETAILS: Record<string, ScheduleDetail> = {
  "Wake up & hydrate": { type: 'info', text: "Starting your day with 500 ml of water re-hydrates you after 7–8 hours without fluids. Do this before coffee — caffeine is a mild diuretic and amplifies morning dehydration." },
  "Breakfast": { type: 'meal', focus: "High protein · slow-release carbs", options: [
    "Scrambled eggs + oats with banana and almond butter",
    "Greek yogurt bowl with granola, mixed berries and honey",
    "Whole grain toast + 3-egg omelette with spinach and feta",
  ]},
  "Light breakfast": { type: 'meal', focus: "Light · easily digestible", options: [
    "2 poached eggs on sourdough with sliced avocado",
    "Greek yogurt with a small handful of granola and fruit",
    "Banana with almond butter and a boiled egg",
  ]},
  "Morning mobility": { type: 'exercise', focus: "Hip flexors · thoracic spine · ankles", steps: [
    { step: "Hip flexor lunge hold", cue: "Step into a deep lunge, front knee at 90°. Push hips gently forward and hold.", reps: "60 sec each side" },
    { step: "Thoracic rotation", cue: "Sit back on heels, hands behind head. Rotate your upper back slowly left and right.", reps: "10 reps each direction" },
    { step: "Ankle circles", cue: "Stand on one foot and draw slow controlled circles with your raised ankle.", reps: "10 each direction, each ankle" },
  ]},
  "Light mobility": { type: 'exercise', focus: "Joints · hip flexors · thoracic rotation", steps: [
    { step: "Cat-cow", cue: "On hands and knees, alternate arching and rounding your back. Breathe with each rep.", reps: "10 slow reps" },
    { step: "Hip flexor lunge hold", cue: "Low lunge — hold gently, no bouncing. Let the hip ease open.", reps: "45 sec each side" },
    { step: "Thoracic opener", cue: "Arms crossed on chest, rotate torso slowly side to side keeping hips still.", reps: "8 reps each direction" },
  ]},
  "Pre-game meal": { type: 'meal', focus: "Easily digestible · energy without heaviness", options: [
    "Grilled chicken breast + white rice + cucumber salad",
    "Pasta with light tomato sauce and lean mince",
    "Jacket potato + tuna + a small mixed salad",
  ]},
  "Warmup & activation": { type: 'exercise', focus: "Neuromuscular activation · movement prep", steps: [
    { step: "Leg swings", cue: "Hold a wall for balance. Swing each leg forward and back, then laterally. Stay controlled.", reps: "15 reps each direction, each leg" },
    { step: "Lateral shuffle", cue: "Stay low, weight on balls of feet. Shuffle 5 metres left and right. Explode off each plant.", reps: "3 sets of 10 metres" },
    { step: "Shadow swings", cue: "20 forehand + 20 backhand shadow swings, building from 60% to 80% intensity. Focus on footwork and contact point.", reps: "20 each side" },
  ]},
  "Match": { type: 'info', text: "Match time. Focus on early rhythm — the first two games set the tone. Communicate constantly with your partner. Stay hydrated between sets." },
  "Post-match cool down": { type: 'exercise', focus: "Heart rate reduction · static stretching", steps: [
    { step: "Standing quad stretch", cue: "Hold your ankle behind you against your glute. Keep the knee pointing straight down.", reps: "45 sec each leg" },
    { step: "Seated hamstring stretch", cue: "Legs straight out in front, hinge from the hips and reach towards your feet.", reps: "45 sec" },
    { step: "Shoulder cross-body stretch", cue: "Pull one arm across your chest. Keep your shoulder pressed down away from your ear.", reps: "30 sec each side" },
  ]},
  "Recovery meal": { type: 'meal', focus: "Protein + carbs · 30-min window", options: [
    "Grilled salmon + sweet potato mash + wilted spinach",
    "Chicken stir-fry with rice noodles and broccoli",
    "Protein shake + banana + peanut butter on whole grain toast",
  ]},
  "Recovery walk": { type: 'info', text: "Walk at a pace where you can hold a full conversation. Low-intensity movement flushes metabolic waste from fatigued muscles without adding stress. 20 minutes is enough." },
  "Foam roll & stretch": { type: 'exercise', focus: "Quads · IT band · hip flexors · calves", steps: [
    { step: "IT band roll", cue: "Side-lying, roll slowly from hip to knee on the outer thigh. Pause and breathe on tight spots.", reps: "60–90 sec each leg" },
    { step: "Quad roll", cue: "Face down, forearms supporting you. Roll from hip to knee on the front of the thigh.", reps: "60 sec each leg" },
    { step: "Hip flexor lunge stretch", cue: "Low lunge, back knee down, slight backward lean. Feel the stretch in the front of the back hip.", reps: "60 sec each side" },
  ]},
  "Protein-rich lunch": { type: 'meal', focus: "30–40g protein · muscle repair", options: [
    "Grilled chicken breast + quinoa + roasted courgette and peppers",
    "Tuna nicoise salad with boiled eggs, green beans and olives",
    "Salmon fillet + brown rice + steamed broccoli with olive oil",
  ]},
  "Cold shower": { type: 'info', text: "Two minutes of cold water constricts blood vessels, reduces inflammation, and blunts delayed onset muscle soreness. Start warm, finish cold for the last 90–120 seconds." },
  "Dinner": { type: 'meal', focus: "Anti-inflammatory · high micronutrient", options: [
    "Baked salmon + roasted sweet potato + wilted spinach with garlic",
    "Grilled sea bass + brown rice + stir-fried kale and broccoli",
    "Chicken thighs + roasted Mediterranean veg + a small portion of couscous",
  ]},
  "Early wind down": { type: 'info', text: "Dim lights by 9pm and avoid screens. Sleep is the highest-impact recovery tool available — aim for 8 hours tonight. A consistent bedtime rhythm compounds over weeks." },
  "Balanced lunch": { type: 'meal', focus: "Variety · antioxidants · sustained energy", options: [
    "Buddha bowl: brown rice, roasted veg, chickpeas and tahini dressing",
    "Chicken wrap with avocado, spinach, cucumber and hummus",
    "Lentil soup with whole grain bread and a large side salad",
  ]},
  "Active recovery": { type: 'info', text: "Walk, swim, or cycle at a pace where you can hold a full conversation. Keep heart rate below 130 bpm. Light aerobic activity maintains cardiovascular fitness without accumulating fatigue." },
  "Visualisation": { type: 'exercise', focus: "Mental rehearsal · pattern reinforcement", steps: [
    { step: "Replay a key moment", cue: "Pick one point from your last match that you lost. Replay it slowly in your mind — what would you change?", reps: "2 min" },
    { step: "Strongest pattern", cue: "Visualise your best attacking sequence in full detail: footwork → position → shot → result. Make it vivid.", reps: "2 min" },
    { step: "Next session intent", cue: "Walk through your next session mentally and set one specific technical focus before you begin.", reps: "1 min" },
  ]},
  "Wind down": { type: 'info', text: "Blue light from screens suppresses melatonin by up to 50%. In the 60 minutes before bed: dim lights, avoid screens, and keep the room cool for deeper sleep." },
};
