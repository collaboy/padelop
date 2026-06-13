import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Called by Vercel Cron — protected by CRON_SECRET
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const hour = now.getUTCHours();
  const todayDate = now.toISOString().slice(0, 10);

  // Decide which notification type to send based on UTC hour:
  // 06:00 UTC = ~8am CET  → morning check-in reminder
  // 19:00 UTC = ~9pm CET  → night check-in reminder
  // Every 30 min           → match-day reminder (2 hours before match time)
  const isMorning = hour === 6 && now.getUTCMinutes() < 30;
  const isEvening = hour === 19 && now.getUTCMinutes() < 30;

  // Fetch all push subscriptions with their user's upcoming matches today
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const sent: number[] = [];
  const failed: string[] = [];

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    let payload: { title: string; body: string; url: string; tag: string } | null = null;

    if (isMorning) {
      payload = {
        title: "padla · Good morning",
        body: "30-second check-in to track how you're feeling today.",
        url: "/home8",
        tag: "morning-checkin",
      };
    } else if (isEvening) {
      payload = {
        title: "padla · Evening check-in",
        body: "Log today's wellbeing before you wind down.",
        url: "/home8",
        tag: "night-checkin",
      };
    } else {
      // Check if this user has a match in ~2 hours
      const { data: matches } = await supabase
        .from("matches")
        .select("date, time, location")
        .eq("user_id", sub.user_id)
        .eq("date", todayDate);

      for (const m of matches ?? []) {
        if (!m.time) continue;
        const [hh, mm] = m.time.split(":").map(Number);
        const matchUTC = new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm
        ));
        // Offset: match times are stored in local time — treat as CET (UTC+1/+2)
        // Subtract 1 hour to get rough UTC equivalent
        const matchUTCApprox = new Date(matchUTC.getTime() - 60 * 60 * 1000);
        const diffMins = (matchUTCApprox.getTime() - now.getTime()) / 60000;
        if (diffMins >= 100 && diffMins <= 130) {
          payload = {
            title: "padla · Match in 2 hours",
            body: m.location ? `Get ready — ${m.time} at ${m.location}` : `Your match starts at ${m.time}. You've got this.`,
            url: "/home8",
            tag: "match-reminder",
          };
          break;
        }
      }
    }

    if (!payload) continue;

    try {
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
      sent.push(1);
    } catch (err: unknown) {
      // 410 = subscription expired/unsubscribed — clean it up
      if ((err as { statusCode?: number }).statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      failed.push(sub.endpoint.slice(-20));
    }
  }

  return NextResponse.json({ sent: sent.length, failed: failed.length });
}
