// Supabase write helpers — fire-and-forget alongside localStorage.
// These never throw; failures are silent so the app stays responsive offline.

import { createClient } from "@/lib/supabase/client";

export async function saveMatchReview(entry: {
  ts: string;
  result?: string;
  feeling?: string;
  opponentNames?: string;
  energy?: string;
  injury?: string;
  mental_before?: string;
  mental_during?: string;
  mental_after?: string;
  warmup?: string;
  wellDone?: string[];
  improved?: string[];
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("matches").insert({
      user_id:       user.id,
      date:          entry.ts.slice(0, 10),
      result:        entry.result ?? null,
      feeling:       entry.feeling ?? null,
      energy:        entry.energy ?? null,
      injury:        entry.injury ?? null,
      mental_before: entry.mental_before ?? null,
      mental_during: entry.mental_during ?? null,
      mental_after:  entry.mental_after ?? null,
      warmup:        entry.warmup ?? null,
      well_done:     entry.wellDone ?? [],
      improved:      entry.improved ?? [],
    });
  } catch {}
}

export async function saveCheckInToDb(data: {
  date: string;
  sleep?: number;
  nutrition?: number;
  hydration?: number;
  energy?: number;
  stress?: number;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("check_ins").upsert({
      user_id:   user.id,
      date:      data.date,
      sleep:     data.sleep ?? null,
      nutrition: data.nutrition ?? null,
      hydration: data.hydration ?? null,
      energy:    data.energy ?? null,
      stress:    data.stress ?? null,
    }, { onConflict: "user_id,date" });
  } catch {}
}

export async function saveNutritionToDb(entry: {
  date: string;
  meal_type?: string;
  description?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("nutrition_logs").insert({
      user_id:     user.id,
      date:        entry.date,
      meal_type:   entry.meal_type ?? null,
      description: entry.description ?? null,
    });
  } catch {}
}

export async function saveGearToDb(item: {
  type: string;
  name?: string;
  photo_url?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("gear").upsert({
      user_id:   user.id,
      type:      item.type,
      name:      item.name ?? null,
      photo_url: item.photo_url ?? null,
    }, { onConflict: "user_id,type" });
  } catch {}
}

export async function saveHydrationToDb(date: string, ml: number) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("hydration_logs").upsert({
      user_id: user.id,
      date,
      ml,
    }, { onConflict: "user_id,date" });
  } catch {}
}
