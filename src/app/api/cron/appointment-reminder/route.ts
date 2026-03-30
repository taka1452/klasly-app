import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";
import { pushAppointmentReminder } from "@/lib/push/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * 1時間後に開始するアポイントメントの予約者に Push リマインダーを送信
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
        job_name: "appointment-reminder",
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

    const { data: appointments } = await adminDb
      .from("appointments")
      .select(
        `
        id,
        appointment_date,
        start_time,
        studio_id,
        member_id,
        instructor_id,
        appointment_type_id,
        appointment_types (name),
        instructors (profile_id, profiles (full_name)),
        members (profile_id)
      `
      )
      .eq("appointment_date", todayStr)
      .gte("start_time", minBound)
      .lte("start_time", maxBound)
      .eq("status", "confirmed");

    if (!appointments?.length) {
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

    for (const appointment of appointments) {
      const profileId = (
        appointment as { members?: { profile_id?: string } }
      ).members?.profile_id;
      if (!profileId) continue;

      const appointmentType =
        (appointment as { appointment_types?: { name?: string } })
          .appointment_types?.name ?? "Appointment";
      const instructorName =
        (
          appointment as {
            instructors?: { profiles?: { full_name?: string } };
          }
        ).instructors?.profiles?.full_name ?? "Instructor";
      const startTime = appointment.start_time?.substring(0, 5) || "";

      const pushPayload = pushAppointmentReminder({
        appointmentType,
        instructorName,
        startTime,
      });

      try {
        const result = await sendPushNotification({
          profileId,
          studioId: appointment.studio_id,
          type: "appointment_reminder",
          payload: pushPayload,
        });
        totalSent += result.sent;
      } catch (err) {
        console.error("Appointment reminder push failed:", err);
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
