import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function italyOffsetMins(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const dstStart = lastSundayOf(year, 2, 2);
  const dstEnd   = lastSundayOf(year, 9, 1);
  return now >= dstStart && now < dstEnd ? 120 : 60;
}

function lastSundayOf(year: number, month: number, hour: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function toMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Returns true if localMins falls in [target-2, target+13) — exactly one 15-min cron slot
function isDue(target: number, now: number): boolean {
  return now >= target - 2 && now < target + 13;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const offsetMins = italyOffsetMins();
  const localNow = new Date(Date.now() + offsetMins * 60000);
  const localMins = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
  const todayStr     = localNow.toISOString().slice(0, 10);
  const yesterdayStr = new Date(localNow.getTime() - 86400000).toISOString().slice(0, 10);
  const tomorrowStr  = new Date(localNow.getTime() + 86400000).toISOString().slice(0, 10);

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  let totalSent = 0;

  for (const sub of subs) {
    try {
      const [
        { data: todayMatch },
        { data: yesterdayMatch },
        { data: tomorrowMatch },
        { data: checkIn },
        { data: hydration },
        { data: schedDone },
      ] = await Promise.all([
        supabase.from("matches").select("time, location").eq("user_id", sub.user_id).eq("date", todayStr).not("time", "is", null).order("time").limit(1).maybeSingle(),
        supabase.from("matches").select("date").eq("user_id", sub.user_id).eq("date", yesterdayStr).limit(1).maybeSingle(),
        supabase.from("matches").select("time, location").eq("user_id", sub.user_id).eq("date", tomorrowStr).not("time", "is", null).order("time").limit(1).maybeSingle(),
        supabase.from("check_ins").select("date").eq("user_id", sub.user_id).eq("date", todayStr).maybeSingle(),
        supabase.from("hydration_logs").select("ml").eq("user_id", sub.user_id).eq("date", todayStr).maybeSingle(),
        supabase.from("schedule_done").select("tasks").eq("user_id", sub.user_id).eq("date", todayStr).maybeSingle(),
      ]);

      const dayType = todayMatch ? "match" : yesterdayMatch ? "recovery" : "training";
      const matchMins = todayMatch?.time ? toMins(todayMatch.time) : null;
      const isEarlyGame = matchMins !== null && matchMins < 13 * 60; // before 1pm

      // Morning: 7:15 for early match days, 11:00 for everything else
      const morningTarget = isEarlyGame ? 7 * 60 + 15 : 11 * 60;

      // Evening: skip for early match days, match-125min for afternoon matches, 18:30 otherwise
      const eveningTarget = isEarlyGame
        ? null
        : matchMins !== null
          ? matchMins - 125
          : 18 * 60 + 30;

      const checkinDone = !!checkIn;
      const tasksDone = schedDone?.tasks?.length ?? 0;
      const hydrationMl = hydration?.ml ?? 0;

      let notif: { title: string; body: string; url: string } | null = null;

      // ── Morning ───────────────────────────────────────────────────────────
      if (isDue(morningTarget, localMins)) {
        if (dayType === "match" && matchMins !== null) {
          const hoursToGame = Math.round((matchMins - localMins) / 60);
          const loc = todayMatch?.location ? ` · ${todayMatch.location}` : "";
          notif = {
            title: "padla · Match day",
            body: `${todayMatch!.time}${loc} — ${hoursToGame}h away.${!checkinDone ? " Quick check-in first." : ""}`,
            url: "/home8",
          };
        } else if (dayType === "recovery") {
          notif = {
            title: "padla · Recovery day",
            body: `Easy day — foam roll, hydrate, rest well.${!checkinDone ? " Log your morning check-in." : ""}`,
            url: "/home8",
          };
        } else {
          notif = {
            title: "padla · Good morning",
            body: !checkinDone
              ? "Start with your morning check-in — takes 20 seconds."
              : hydrationMl < 500
                ? "Check-in done. Don't forget to hydrate."
                : "Check-in done. Open the app for today's training focus.",
            url: "/home8",
          };
        }
      }

      // ── Evening ───────────────────────────────────────────────────────────
      if (!notif && eveningTarget !== null && isDue(eveningTarget, localMins)) {
        if (dayType === "match" && matchMins !== null) {
          const loc = todayMatch?.location ? ` at ${todayMatch.location}` : "";
          notif = {
            title: "padla · Match in 2 hours",
            body: `${todayMatch!.time}${loc} — warmup time. Trust your game.`,
            url: "/home8",
          };
        } else {
          const tomorrow = tomorrowMatch ? ` Match tomorrow at ${tomorrowMatch.time}.` : "";
          notif = {
            title: "padla · Evening check",
            body: tasksDone > 0
              ? `${tasksDone} task${tasksDone > 1 ? "s" : ""} done today.${!checkinDone ? " Still need your check-in." : ""}${tomorrow}`
              : `${!checkinDone ? "Log your check-in before bed." : "How did the day go?"}${tomorrow}`,
            url: "/profile",
          };
        }
      }

      if (!notif) continue;

      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: notif.title, body: notif.body, url: notif.url })
      );
      totalSent++;
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return NextResponse.json({ sent: totalSent });
}
