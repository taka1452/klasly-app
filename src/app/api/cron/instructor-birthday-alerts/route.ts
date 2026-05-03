import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";
import { pushInstructorBirthdayAlert } from "@/lib/push/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const RECENT_WINDOW_DAYS = 60;

/**
 * Daily cron — finds members whose birthday is today and notifies
 * the instructors who taught them in the last 60 days, so the
 * instructor can give them a personal hello.
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
        job_name: "instructor-birthday-alerts",
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
    const todayMonth = now.getUTCMonth() + 1;
    const todayDay = now.getUTCDate();
    const mmdd = `${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;
    const recentSince = new Date(now);
    recentSince.setUTCDate(now.getUTCDate() - RECENT_WINDOW_DAYS);
    const recentSinceIso = recentSince.toISOString().slice(0, 10);

    // Members with birthday today (active only)
    const { data: members } = await adminDb
      .from("members")
      .select("id, studio_id, date_of_birth, profiles(full_name)")
      .eq("status", "active")
      .not("date_of_birth", "is", null)
      .like("date_of_birth", `%-${mmdd}`);

    const todayBirthdayMembers = (members ?? []) as Array<{
      id: string;
      studio_id: string;
      date_of_birth: string;
      profiles?: { full_name?: string | null } | null;
    }>;
    if (todayBirthdayMembers.length === 0) return NextResponse.json({ sent: 0 });

    let totalSent = 0;

    for (const member of todayBirthdayMembers) {
      const memberName = member.profiles?.full_name ?? "A student";
      // Compute age (only if year is well-formed)
      let ageOrYearsLabel: string | null = null;
      const birthYear = parseInt(member.date_of_birth.slice(0, 4), 10);
      if (!Number.isNaN(birthYear) && birthYear > 1900) {
        const age = now.getUTCFullYear() - birthYear;
        if (age > 0 && age < 130) ageOrYearsLabel = `turning ${age}`;
      }

      // Recent instructors for this member
      const { data: recentSessions } = await adminDb
        .from("bookings")
        .select(
          "class_sessions!inner(instructor_id, session_date, is_cancelled)"
        )
        .eq("member_id", member.id)
        .eq("attended", true);

      const instructorIds = new Set<string>();
      for (const row of (recentSessions ?? []) as Array<{
        class_sessions?: {
          instructor_id?: string | null;
          session_date?: string;
          is_cancelled?: boolean;
        } | null;
      }>) {
        const cs = row.class_sessions;
        if (
          cs?.instructor_id &&
          !cs.is_cancelled &&
          cs.session_date &&
          cs.session_date >= recentSinceIso
        ) {
          instructorIds.add(cs.instructor_id);
        }
      }
      if (instructorIds.size === 0) continue;

      const { data: instructors } = await adminDb
        .from("instructors")
        .select("profile_id")
        .in("id", Array.from(instructorIds));

      for (const inst of (instructors ?? []) as Array<{ profile_id: string }>) {
        if (!inst.profile_id) continue;
        try {
          const r = await sendPushNotification({
            profileId: inst.profile_id,
            studioId: member.studio_id,
            type: "instructor_birthday_alert",
            payload: pushInstructorBirthdayAlert({ memberName, ageOrYearsLabel }),
          });
          totalSent += r.sent;
        } catch (err) {
          console.error("birthday push failed:", err);
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
