import webpush from "web-push";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getScheduleItems, dueItems } from "@/lib/schedule-server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

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

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const offsetMins = italyOffsetMins();
  const localNow = new Date(Date.now() + offsetMins * 60000);
  const localMins = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
  const todayStr     = localNow.toISOString().slice(0, 10);
  const yesterdayStr = new Date(localNow.getTime() - 86400000).toISOString().slice(0, 10);

  const isTest = new URL(request.url).searchParams.get("test") === "1";

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  let totalSent = 0;

  for (const sub of subs) {
    try {
      const [{ data: todayMatch }, { data: yesterdayMatch }] = await Promise.all([
        supabase.from("matches").select("time, location").eq("user_id", sub.user_id).eq("date", todayStr).not("time", "is", null).order("time").limit(1).maybeSingle(),
        supabase.from("matches").select("date").eq("user_id", sub.user_id).eq("date", yesterdayStr).limit(1).maybeSingle(),
      ]);

      const dayType: "match" | "recovery" | "training" = todayMatch ? "match" : yesterdayMatch ? "recovery" : "training";
      const items = getScheduleItems(dayType, todayMatch?.time ?? null);
      const due = isTest ? items.slice(0, 1) : dueItems(items, localMins);

      for (const item of due) {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: item.title,
            body: item.body,
            url: "/home8",
            tag: item.title.toLowerCase().replace(/\s+/g, "-"),
          })
        );
        totalSent++;
      }
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("webpush error", status, String(err));
      }
    }
  }

  return NextResponse.json({ sent: totalSent });
}
