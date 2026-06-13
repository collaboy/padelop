export type MealEntry = { id: string; date: string; time: string; description: string };

const PROTEIN = ["egg", "chicken", "salmon", "tuna", "beef", "turkey", "protein", "yogurt", "legume", "lentil", "chickpea", "tofu", "fish", "whey", "cottage", "greek", "steak", "pork", "shrimp", "prawn", "ricotta", "mozzarella", "meat", "lamb"];
const VEG     = ["salad", "spinach", "broccoli", "veg", "green", "kale", "carrot", "tomato", "cucumber", "avocado", "courgette", "zucchini", "pepper", "mushroom", "celery", "onion", "asparagus", "cauliflower", "bean", "pea", "leek"];
const CARBS   = ["rice", "pasta", "oat", "bread", "potato", "banana", "granola", "noodle", "wrap", "toast", "grain", "quinoa", "couscous", "polenta", "lentil", "barley", "sweet potato", "bagel", "muffin", "cereal"];

function has(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some(w => t.includes(w));
}

export type FoodAnalysis = {
  score: number;
  protein: boolean;
  veg: boolean;
  carbs: boolean;
  mealCount: number;
};

export function analyzeMeals(meals: MealEntry[]): FoodAnalysis {
  if (!meals.length) return { score: 0, protein: false, veg: false, carbs: false, mealCount: 0 };
  const allText = meals.map(m => m.description).join(" ");
  const protein = has(allText, PROTEIN);
  const veg     = has(allText, VEG);
  const carbs   = has(allText, CARBS);
  // Base: 20pts per meal (cap 3), then quality bonuses
  const base  = Math.min(60, meals.length * 20);
  const bonus = (protein ? 20 : 0) + (veg ? 10 : 0) + (carbs ? 10 : 0);
  return { score: Math.min(100, base + bonus), protein, veg, carbs, mealCount: meals.length };
}

// Suggested meal slots per day type (title + key ingredients)
export const SUGGESTED_MEALS: Record<string, Array<{ title: string; keywords: string[] }>> = {
  match: [
    { title: "Breakfast",      keywords: ["egg", "oat", "fruit", "yogurt", "protein"] },
    { title: "Pre-game meal",  keywords: ["chicken", "rice", "salad", "pasta", "potato"] },
    { title: "Recovery meal",  keywords: ["protein", "carb", "salmon", "shake", "chicken", "rice"] },
  ],
  recovery: [
    { title: "Light breakfast",    keywords: ["egg", "fruit", "yogurt", "greek"] },
    { title: "Protein-rich lunch", keywords: ["chicken", "salmon", "legume", "lentil", "veg"] },
    { title: "Dinner",             keywords: ["fish", "green", "salad", "veg", "anti-inflammatory"] },
  ],
  training: [
    { title: "Breakfast",      keywords: ["egg", "yogurt", "protein", "oat", "fruit"] },
    { title: "Balanced lunch", keywords: ["carb", "protein", "green", "rice", "chicken", "wrap"] },
    { title: "Dinner",         keywords: ["variety", "veg", "protein", "fish", "salad"] },
  ],
};

export type SlotCoverage = { title: string; covered: boolean };

export function compareMealsToSchedule(meals: MealEntry[], dayType: string): SlotCoverage[] {
  const slots = SUGGESTED_MEALS[dayType] ?? SUGGESTED_MEALS.training;
  const allText = meals.map(m => m.description).join(" ").toLowerCase();
  return slots.map(slot => ({
    title: slot.title,
    covered: slot.keywords.some(k => allText.includes(k)),
  }));
}

export function foodGrade(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "#16a34a" };
  if (score >= 65) return { label: "Good",      color: "#22c55e" };
  if (score >= 45) return { label: "Fair",       color: "#f97316" };
  if (score > 0)   return { label: "Low",        color: "#ef4444" };
  return              { label: "Not logged",  color: "#b0b8c1" };
}

export function loadFoodHistory(days = 7): Array<{ date: string; score: number }> {
  try {
    const raw = JSON.parse(localStorage.getItem("padelop:meal-log") || "[]") as MealEntry[];
    const byDate: Record<string, MealEntry[]> = {};
    raw.forEach(m => { (byDate[m.date] ??= []).push(m); });
    const result: Array<{ date: string; score: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      result.push({ date, score: analyzeMeals(byDate[date] ?? []).score });
    }
    return result;
  } catch { return []; }
}
