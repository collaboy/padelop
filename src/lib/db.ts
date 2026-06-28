// Supabase write helpers — fire-and-forget alongside localStorage.
// These never throw; failures are silent so the app stays responsive offline.

import { createClient } from "@/lib/supabase/client";
import { resizeImageToBlob } from "@/lib/image";

export async function saveTrainingToDb(entry: {
  date: string;
  drill_focus?: string;
  duration_mins?: number;
  notes?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("sessions").insert({
      user_id:      user.id,
      date:         entry.date,
      drill_focus:  entry.drill_focus ?? null,
      duration_mins: entry.duration_mins ?? null,
      notes:        entry.notes ?? null,
    });
  } catch {}
}

export async function saveProfileToDb(profile: {
  display_name?: string;
  avatar_url?: string;
  dominant_hand?: string;
  play_level?: string;
  position?: string;
  overall_goal?: string;
  club?: string;
  tournament_count?: number;
  playing_since?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fields: Record<string, unknown> = { id: user.id };
    if (profile.display_name     !== undefined) fields.display_name     = profile.display_name;
    if (profile.avatar_url       !== undefined) fields.avatar_url       = profile.avatar_url;
    if (profile.dominant_hand    !== undefined) fields.dominant_hand    = profile.dominant_hand;
    if (profile.play_level       !== undefined) fields.play_level       = profile.play_level;
    if (profile.position         !== undefined) fields.position         = profile.position;
    if (profile.overall_goal     !== undefined) fields.overall_goal     = profile.overall_goal;
    if (profile.club             !== undefined) fields.club             = profile.club;
    if (profile.tournament_count !== undefined) fields.tournament_count = profile.tournament_count;
    if (profile.playing_since    !== undefined) fields.playing_since    = profile.playing_since;
    await supabase.from("profiles").upsert(fields);
  } catch {}
}

export async function saveUpcomingMatch(match: {
  date: string;
  time: string;
  club?: string;
  court?: string;
  player_1?: string;
  player_2?: string;
  player_3?: string;
  player_4?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("matches").upsert({
      user_id:  user.id,
      date:     match.date,
      time:     match.time,
      location: match.club ?? null,
      court:    match.court    ?? null,
      player_1: match.player_1 ?? null,
      player_2: match.player_2 ?? null,
      player_3: match.player_3 ?? null,
      player_4: match.player_4 ?? null,
    }, { onConflict: "user_id,date,time" });
  } catch {}
}

export async function deleteUpcomingMatchFromDb(date: string, time: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("matches").delete()
      .eq("user_id", user.id)
      .eq("date", date)
      .eq("time", time);
  } catch {}
}

export async function saveMatchReview(entry: {
  ts: string;
  matchDate?: string;
  matchTime?: string;
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
  notes?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const resultFields = {
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
      notes:         entry.notes ?? null,
    };

    if (entry.matchDate && entry.matchTime) {
      // Link to existing scheduled match — update it with result data
      await supabase.from("matches")
        .update(resultFields)
        .eq("user_id", user.id)
        .eq("date", entry.matchDate)
        .eq("time", entry.matchTime);
    } else {
      await supabase.from("matches").insert({
        user_id: user.id,
        date:    entry.matchDate ?? entry.ts.slice(0, 10),
        ...resultFields,
      });
    }
  } catch {}
}

export async function saveScheduleDoneToDb(date: string, tasks: string[]) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("schedule_done").upsert(
      { user_id: user.id, date, tasks },
      { onConflict: "user_id,date" }
    );
  } catch {}
}

export async function saveScoreSnapshotToDb(date: string, scores: { overall: number; recovery: number; nutrition: number; training: number; wellbeing: number }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("score_snapshots").upsert(
      { user_id: user.id, date, ...scores },
      { onConflict: "user_id,date" }
    );
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
  racket_type?: string;
  racket_since?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fields: Record<string, unknown> = { user_id: user.id, type: item.type };
    if (item.name        !== undefined) fields.name         = item.name        ?? null;
    if (item.photo_url   !== undefined) fields.photo_url    = item.photo_url;
    if (item.racket_type !== undefined) fields.racket_type  = item.racket_type ?? null;
    if (item.racket_since !== undefined) fields.racket_since = item.racket_since ?? null;
    await supabase.from("gear").upsert(fields, { onConflict: "user_id,type" });
  } catch {}
}

export async function saveNutritionInsightToDb(date: string, score: number, insight: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("check_ins").upsert({
      user_id:               user.id,
      date,
      nutrition_ai_score:    score,
      nutrition_ai_insight:  insight,
    }, { onConflict: "user_id,date" });
  } catch {}
}

export async function saveNoteToDb(entry: { date: string; body: string }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("notes").insert({
      user_id: user.id,
      date:    entry.date,
      body:    entry.body,
    });
  } catch {}
}

export async function uploadGearImageToStorage(gearType: string, dataUrl: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const blob = await resizeImageToBlob(dataUrl, 800, 0.82);
    const path = `${user.id}/${gearType}.jpg`;
    const { error } = await supabase.storage.from("gear-images").upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (error) return null;
    const { data } = supabase.storage.from("gear-images").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
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

// Inserts a baseline ml value only if no row exists for that date — never overwrites a real measurement
export async function deleteGearImageFromStorage(gearType: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.storage.from("gear-images").remove([`${user.id}/${gearType}.jpg`]);
    await supabase.from("gear").update({ photo_url: null }).eq("user_id", user.id).eq("type", gearType);
  } catch {}
}

export async function seedHydrationToDb(date: string, ml: number) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("hydration_logs").upsert({
      user_id: user.id,
      date,
      ml,
    }, { onConflict: "user_id,date", ignoreDuplicates: true });
  } catch {}
}
