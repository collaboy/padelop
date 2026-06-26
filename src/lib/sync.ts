// Hydrate localStorage from Supabase on login/app load.
// All existing UI reads localStorage as normal — this just populates it.

import { createClient } from "@/lib/supabase/client";

export async function hydrateFromSupabase() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.dispatchEvent(new Event("padelop:sync-done")); return; }

    const today = new Date().toISOString().slice(0, 10);

    const [matchesRes, checkInsRes, hydrationRes, nutritionRes, sessionsRes, gearRes, profileRes, notesRes, schedDoneRes, scoreSnapsRes] = await Promise.all([
      supabase.from("matches").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("check_ins").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(90),
      supabase.from("hydration_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("nutrition_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("sessions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
      supabase.from("gear").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("display_name, avatar_url, dominant_hand, play_level, position, tournament_count, playing_since, overall_goal, club").eq("id", user.id).single(),
      supabase.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("schedule_done").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(30),
      supabase.from("score_snapshots").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(90),
    ]);

    // ── Profile ──────────────────────────────────────────────────────────
    const dbProfile = profileRes.data;
    if (dbProfile) {
      const existing = JSON.parse(localStorage.getItem("padelop:profile") || "{}");
      localStorage.setItem("padelop:profile", JSON.stringify({
        ...existing,
        ...(dbProfile.display_name ? { name: dbProfile.display_name } : {}),
        hand:         dbProfile.dominant_hand  ?? existing.hand         ?? "",
        level:        dbProfile.play_level     ?? existing.level        ?? "",
        position:     dbProfile.position       ?? existing.position     ?? "",
        avatar:       dbProfile.avatar_url     ?? existing.avatar       ?? "",
        playingSince: dbProfile.playing_since  ?? existing.playingSince ?? "",
        ...(dbProfile.overall_goal ? { goal: dbProfile.overall_goal } : {}),
        ...(dbProfile.club         ? { club: dbProfile.club }         : {}),
      }));
      if (dbProfile.tournament_count != null) {
        localStorage.setItem("padelop:tournaments", JSON.stringify({ count: dbProfile.tournament_count }));
      }
    }

    // ── Matches ──────────────────────────────────────────────────────────
    const matches = matchesRes.data ?? [];

    const upcoming = matches
      .filter(m => m.date >= today && m.time)
      .map(m => ({
        date:     m.date,
        time:     m.time,
        club:     m.location ?? "",
        court:    m.court    ?? "",
        player_1: m.player_1 ?? "",
        player_2: m.player_2 ?? "",
        player_3: m.player_3 ?? "",
        player_4: m.player_4 ?? "",
      }))
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
        notes:        m.notes ?? "",
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
    if (todayCI?.nutrition_ai_score != null && todayCI?.nutrition_ai_insight) {
      const cacheKey = "padelop:nutrition-ai-insight";
      try {
        const existing = JSON.parse(localStorage.getItem(cacheKey) || "null");
        // Only overwrite if we don't already have a fresher local result
        if (!existing || existing.date !== today) {
          // Count actual meal entries for today (non-quality-marker descriptions)
          const QM = new Set(["great", "ok", "bad", "good", "poor"]);
          const todayMealCount = (nutritionRes.data ?? []).filter(n =>
            n.date === today && !QM.has((n.description ?? "").toLowerCase()) && n.description
          ).length;
          localStorage.setItem(cacheKey, JSON.stringify({
            date:       today,
            mealCount:  todayMealCount,
            score:      todayCI.nutrition_ai_score,
            insight:    todayCI.nutrition_ai_insight,
          }));
        }
      } catch {}
    }

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
      // Mark morning log done so the nudge doesn't re-fire
      const existingML = JSON.parse(localStorage.getItem("padelop:morning-log") || "null");
      if (!existingML || existingML.date !== today) {
        localStorage.setItem("padelop:morning-log", JSON.stringify({ date: today }));
      }
    }

    // ── Habits (full history from all check-ins) ──────────────────────────
    if (checkIns.length) {
      const habitDates = checkIns.map(c => ({ date: c.date as string }));
      localStorage.setItem("padelop:habits", JSON.stringify(habitDates));
    }

    // ── Check-in history (for trend enrichment) ───────────────────────────
    if (checkIns.length) {
      const ciHistory = checkIns.map(c => ({
        date:      c.date      as string,
        sleep:     c.sleep     ?? 3,
        energy:    c.energy    ?? 3,
        hydration: c.hydration ?? 3,
        stress:    c.stress    ?? 3,
      }));
      localStorage.setItem("padelop:checkin-history", JSON.stringify(ciHistory));
    }

    // ── Hydration ────────────────────────────────────────────────────────
    const mlToRange = (ml: number) =>
      ml < 1000 ? "<1L" :
      ml < 1500 ? "1–1.5L" :
      ml < 2000 ? "1.5–2L" :
      ml < 2500 ? "2–2.5L" :
      ml < 3000 ? "2.5–3L" : "3L+";

    const hydrationData = hydrationRes.data ?? [];
    const hydrationLogs = hydrationData.map(h => ({
      ts:      h.date + "T12:00:00.000Z",
      litres:  mlToRange(h.ml),
      urine:   "",
      quality: h.ml >= 2500 ? "great" : h.ml >= 1500 ? "ok" : "bad",
      timing:  [],
    }));
    if (hydrationLogs.length) {
      localStorage.setItem("padelop:hydration-logs", JSON.stringify(hydrationLogs));
    }
    const todayHydration = hydrationData.find(h => h.date === today);
    if (todayHydration) {
      localStorage.setItem("padelop:hydration-quick", JSON.stringify({ date: today, ml: todayHydration.ml }));
    }

    // ── Nutrition ────────────────────────────────────────────────────────
    const nutritionData = nutritionRes.data ?? [];

    // Quality ratings saved by the checkin flow (description is "great"/"ok"/"bad")
    const QUALITY_MARKERS = new Set(["great", "ok", "bad", "good", "poor"]);
    const qualityEntries = nutritionData.filter(n => QUALITY_MARKERS.has((n.description ?? "").toLowerCase()));
    const nutritionLogs = qualityEntries.map(n => ({
      ts:            n.date + "T12:00:00.000Z",
      quality:       n.description ?? "",
      proteinRating: "",
      foods:         [],
      postMatch:     "no",
    }));
    if (nutritionLogs.length) {
      localStorage.setItem("padelop:nutrition-logs", JSON.stringify(nutritionLogs));
    }

    // Actual meal entries saved by saveMealEntry (description is food text, not a quality word)
    const mealEntries = nutritionData.filter(n => !QUALITY_MARKERS.has((n.description ?? "").toLowerCase()) && n.description);
    const mealLog = mealEntries.map(n => ({
      id:          String(n.id ?? n.created_at ?? n.date),
      date:        n.date,
      time:        n.meal_type ?? "12:00",
      description: n.description ?? "",
    }));
    if (mealLog.length) {
      localStorage.setItem("padelop:meal-log", JSON.stringify(mealLog));
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
    const shoe   = gear.find(g => g.type === "shoe");
    const kit    = gear.find(g => g.type === "kit");
    if (racket || shoe || kit) {
      const existing = JSON.parse(localStorage.getItem("padelop:gear") || "{}");
      localStorage.setItem("padelop:gear", JSON.stringify({
        ...existing,
        ...(racket?.name         ? { racketName:  racket.name }         : {}),
        ...(racket?.racket_type  ? { racketType:  racket.racket_type }  : {}),
        ...(racket?.racket_since ? { racketSince: racket.racket_since } : {}),
        ...(racket?.photo_url    ? { racketImage: racket.photo_url }    : {}),
        ...(shoe?.photo_url      ? { shoeImage:   shoe.photo_url }      : {}),
        ...(kit?.photo_url       ? { kitImage:    kit.photo_url }       : {}),
      }));
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    const notesData = notesRes.data ?? [];
    if (notesData.length) {
      const notes = notesData.map(n => ({
        id:   n.id,
        date: n.date,
        ts:   n.created_at,
        text: n.body ?? "",
      }));
      localStorage.setItem("padelop:notes", JSON.stringify(notes));
    }

    // ── Schedule done ────────────────────────────────────────────────────
    const schedDoneData = schedDoneRes.data ?? [];
    if (schedDoneData.length) {
      const schedDone: Record<string, string[]> = {};
      schedDoneData.forEach(row => { schedDone[row.date as string] = row.tasks ?? []; });
      localStorage.setItem("padelop:schedule-done", JSON.stringify(schedDone));
    }

    // ── Score snapshots ──────────────────────────────────────────────────
    const snapData = scoreSnapsRes.data ?? [];
    if (snapData.length) {
      const history = snapData.map(s => ({
        date:      s.date as string,
        overall:   s.overall   ?? 0,
        recovery:  s.recovery  ?? 0,
        nutrition: s.nutrition ?? 0,
        training:  s.training  ?? 0,
        wellbeing: s.wellbeing ?? 0,
      }));
      localStorage.setItem("padelop:score-history", JSON.stringify(history));
    }

    // ── Game days (derived from match dates) ─────────────────────────────
    const matchDates = (matchesRes.data ?? []).map(m => m.date as string).filter(Boolean);
    if (matchDates.length) {
      localStorage.setItem("padelop:game-days", JSON.stringify(matchDates));
    }

    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("padelop:sync-done"));
  } catch {
    window.dispatchEvent(new Event("padelop:sync-done"));
  }
}
