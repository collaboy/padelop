// Hydrate localStorage from Supabase on login/app load.
// All existing UI reads localStorage as normal — this just populates it.

import { createClient } from "@/lib/supabase/client";

export async function hydrateFromSupabase() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().slice(0, 10);

    const [matchesRes, checkInsRes, hydrationRes, nutritionRes, sessionsRes, gearRes] = await Promise.all([
      supabase.from("matches").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("check_ins").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(30),
      supabase.from("hydration_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("nutrition_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("sessions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("gear").select("*").eq("user_id", user.id),
    ]);

    // ── Matches ──────────────────────────────────────────────────────────
    const matches = matchesRes.data ?? [];

    const upcoming = matches
      .filter(m => m.date >= today && m.time)
      .map(m => ({ date: m.date, time: m.time, club: m.location ?? "", player_1: "", player_2: "", player_3: "", player_4: "" }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const reviews = matches
      .filter(m => m.result || m.well_done?.length || m.improved?.length)
      .map(m => ({
        ts:           m.date + "T12:00:00.000Z",
        result:       m.result ?? "",
        feeling:      m.feeling ?? "",
        opponentNames: "",
        energy:       m.energy ?? "",
        injury:       m.injury ?? "",
        wellDone:     m.well_done ?? [],
        improved:     m.improved ?? [],
        mentalBefore: m.mental_before ?? "",
        mentalDuring: m.mental_during ?? "",
        mentalAfter:  m.mental_after ?? "",
        warmup:       m.warmup ?? "",
      }));

    if (upcoming.length) {
      localStorage.setItem("padelop:upcoming-matches", JSON.stringify(upcoming));
      localStorage.setItem("padelop:next-match", JSON.stringify(upcoming[0]));
    }
    if (reviews.length) {
      localStorage.setItem("padelop:match-reviews", JSON.stringify(reviews));
    }

    // ── Check-ins ────────────────────────────────────────────────────────
    const checkIns = checkInsRes.data ?? [];
    const todayCI = checkIns.find(c => c.date === today);
    if (todayCI) {
      localStorage.setItem("padelop:daily-checkin", JSON.stringify({
        date:       todayCI.date,
        sleep:      todayCI.sleep ?? 3,
        energy:     todayCI.energy ?? 3,
        soreness:   3,
        hydration:  todayCI.hydration ?? 3,
        stress:     todayCI.stress ?? 3,
        motivation: 3,
      }));
    }

    // ── Hydration ────────────────────────────────────────────────────────
    const hydrationLogs = (hydrationRes.data ?? []).map(h => ({
      ts:      h.date + "T12:00:00.000Z",
      litres:  h.ml / 1000,
      urine:   "",
      quality: "ok",
      timing:  [],
    }));
    if (hydrationLogs.length) {
      localStorage.setItem("padelop:hydration-logs", JSON.stringify(hydrationLogs));
    }

    // ── Nutrition ────────────────────────────────────────────────────────
    const nutritionLogs = (nutritionRes.data ?? []).map(n => ({
      ts:            n.date + "T12:00:00.000Z",
      quality:       n.description ?? "",
      proteinRating: "",
      foods:         [],
      postMatch:     "no",
    }));
    if (nutritionLogs.length) {
      localStorage.setItem("padelop:nutrition-logs", JSON.stringify(nutritionLogs));
    }

    // ── Training sessions ────────────────────────────────────────────────
    const trainingLogs = (sessionsRes.data ?? []).map(s => ({
      ts:          s.date + "T12:00:00.000Z",
      sessionType: [],
      drillFocus:  s.drill_focus ? [s.drill_focus] : [],
      duration:    s.duration_mins ? String(s.duration_mins) : "",
      intensity:   "",
    }));
    if (trainingLogs.length) {
      localStorage.setItem("padelop:training-logs", JSON.stringify(trainingLogs));
    }

    // ── Gear ─────────────────────────────────────────────────────────────
    const gear = gearRes.data ?? [];
    const racket = gear.find(g => g.type === "racket");
    const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
    const merged = {
      ...existing,
      ...(racket ? { racketName: racket.name ?? "" } : {}),
    };
    if (gear.length) {
      localStorage.setItem("padelop:gear", JSON.stringify(merged));
    }

    window.dispatchEvent(new Event("storage"));
  } catch {}
}
