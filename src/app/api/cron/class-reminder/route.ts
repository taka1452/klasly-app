import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";
import { pushClassReminder } from "@/lib/push/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * 1時間後に開始するクラスの予約者に Push リマインダーを送信
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();

  const cronStartedAt = new Date().toISOString();
  let cronLogId: string | null = null;
  try {
    const { data: logRow } = await adminDb
      .from("cron_logs")
      .insert({
        job_name: "class-reminder",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // ログ記録失敗はスキップ
  }

  try {
    // 1時間後の時間帯を計算
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];

    // ±5分の幅で取得
    const minBound = new Date(oneHourLater.getTime() - 5 * 60 * 1000)
      .toISOString()
      .split("T")[1]
      .substring(0, 5);
    const maxBound = new Date(oneHourLater.getTime() + 5 * 60 * 1000)
      .toISOString()
      .split("T")[1]
      .substring(0, 5);

    const { data: sessions } = await adminDb
      .from("class_sessions")
      .select(
        `
        id,
        session_date,
        start_time,
        studio_id,
        classes (name)
      `
      )
      .eq("session_date", todayStr)
      .gte("start_time", minBound)
      .lte("start_time", maxBound)
      .eq("is_cancelled", false);

    if (!sessions?.length) {
      if (cronLogId) {
        await adminDb
          .from("cron_logs")
          .update({
            status: "success",
            affected_count: 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
      return NextResponse.json({ sent: 0 });
    }

    let totalSent = 0;

    for (const session of sessions) {
      // このセッションの予約者を取得
      const { data: bookings } = await adminDb
        .from("bookings")
        .select("member_id, members(profile_id)")
        .eq("session_id", session.id)
        .eq("status", "confirmed");

      if (!bookings?.length) continue;

      const className =
        (session as { classes?: { name?: string } }).classes?.name ?? "Class";
      const startTime = session.start_time?.substring(0, 5) || "";

      for (const booking of bookings) {
        const profileId = (booking as { members?: { profile_id?: string } })
          .members?.profile_id;
        if (!profileId) continue;

        const pushPayload = pushClassReminder({
          className,
          sessionDate: session.session_date,
          startTime,
        });

        try {
          const result = await sendPushNotification({
            profileId,
            studioId: session.studio_id,
            type: "class_reminder",
            payload: pushPayload,
          });
          totalSent += result.sent;
        } catch (err) {
          console.error("Reminder push failed:", err);
        }
      }
    }

    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "success",
          affected_count: totalSent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", cronLogId);
    }

    return NextResponse.json({ sent: totalSent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "error",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
