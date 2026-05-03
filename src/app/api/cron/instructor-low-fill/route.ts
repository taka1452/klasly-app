import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";
import { pushInstructorLowFillWarning } from "@/lib/push/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const LOW_FILL_THRESHOLD = 0.5;

/**
 * Evening cron — warns instructors about poorly filled classes
 * happening tomorrow so they have time to promote on socials.
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
        job_name: "instructor-low-fill",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    /* ignore */
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    const { data: sessions } = await adminDb
      .from("class_sessions")
      .select(
        "id, capacity, start_time, instructor_id, studio_id, class_templates(name)"
      )
      .eq("session_date", tomorrowIso)
      .eq("is_cancelled", false)
      .eq("session_type", "class")
      .not("instructor_id", "is", null);

    const rows = (sessions ?? []) as Array<{
      id: string;
      capacity: number;
      start_time: string;
      instructor_id: string;
      studio_id: string;
      class_templates?: { name?: string | null } | null;
    }>;
    if (rows.length === 0) return NextResponse.json({ sent: 0 });

    const sessionIds = rows.map((s) => s.id);
    const { data: bks } = await adminDb
      .from("bookings")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("status", "confirmed");
    const counts = new Map<string, number>();
    for (const b of bks ?? []) {
      const id = (b as { session_id: string }).session_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    let totalSent = 0;
    const instructorProfileCache = new Map<string, string | null>();

    for (const s of rows) {
      const booked = counts.get(s.id) ?? 0;
      if (s.capacity <= 0) continue;
      if (booked / s.capacity >= LOW_FILL_THRESHOLD) continue;
      if (booked >= s.capacity) continue;

      let profileId = instructorProfileCache.get(s.instructor_id);
      if (profileId === undefined) {
        const { data: inst } = await adminDb
          .from("instructors")
          .select("profile_id")
          .eq("id", s.instructor_id)
          .maybeSingle();
        profileId = (inst?.profile_id ?? null) as string | null;
        instructorProfileCache.set(s.instructor_id, profileId);
      }
      if (!profileId) continue;

      const className = s.class_templates?.name ?? "Class";
      const startTime = s.start_time?.substring(0, 5) ?? "";

      try {
        const r = await sendPushNotification({
          profileId,
          studioId: s.studio_id,
          type: "instructor_low_fill_warning",
          payload: pushInstructorLowFillWarning({
            className,
            sessionDate: tomorrowIso,
            startTime,
            bookedCount: booked,
            capacity: s.capacity,
          }),
        });
        totalSent += r.sent;
      } catch (err) {
        console.error("low-fill push failed:", err);
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
