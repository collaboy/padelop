import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getScheduleItems, dueItems } from "@/lib/schedule-server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Italy is UTC+2 in summer (CEST), UTC+1 in winter (CET).
// We derive the offset so the schedule times feel local even if the user's
// profile doesn't yet store a timezone.
function italyOffsetMins(): number {
  const now = new Date();
  // DST in EU: last Sunday March → last Sunday October
  const year = now.getUTCFullYear();
  const dstStart = lastSundayOf(year, 2, 2); // March, 2am UTC
  const dstEnd   = lastSundayOf(year, 9, 1); // October, 1am UTC
  return now >= dstStart && now < dstEnd ? 120 : 60;
}

function lastSundayOf(year: number, month: number, hour: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // roll back to Sunday
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const localMins = Math.floor((now.getTime() / 60000) % 1440 + italyOffsetMins()) % 1440;
  const todayLocal = new Date(now.getTime() + italyOffsetMins() * 60000).toISOString().slice(0, 10);
  const yesterdayLocal = new Date(now.getTime() + italyOffsetMins() * 60000 - 86400000).toISOString().slice(0, 10);

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  let totalSent = 0;

  for (const sub of subs) {
    // Determine day type for this user
    const { data: todayMatch } = await supabase
      .from("matches")
      .select("date, time, location")
      .eq("user_id", sub.user_id)
      .eq("date", todayLocal)
      .not("time", "is", null)
      .order("time")
      .limit(1)
      .maybeSingle();

    const { data: yesterdayMatch } = await supabase
      .from("matches")
      .select("date")
      .eq("user_id", sub.user_id)
      .eq("date", yesterdayLocal)
      .limit(1)
      .maybeSingle();

    const dayType: "match" | "recovery" | "training" = todayMatch
      ? "match"
      : yesterdayMatch
      ? "recovery"
      : "training";

    const items = getScheduleItems(dayType, todayMatch?.time ?? null);
    const due = dueItems(items, localMins);

    for (const item of due) {
      const payload = JSON.stringify({
        title: `padla · ${item.title}`,
        body: item.body,
        url: "/home8",
        tag: item.title.toLowerCase().replace(/\s+/g, "-"),
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        totalSent++;
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  return NextResponse.json({ sent: totalSent });
}
