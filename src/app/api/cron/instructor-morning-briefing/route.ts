import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";
import { pushInstructorMorningBriefing } from "@/lib/push/templates";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const LOYALTY_STREAK_THRESHOLD = 3;

/**
 * Daily morning push briefing for each instructor:
 *   - today's class count + total student count
 *   - "new face" count (members who never attended this instructor before)
 *   - loyalty highlight ("◯◯ has booked 3+ weeks straight")
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
        job_name: "instructor-morning-briefing",
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
    const todayIso = now.toISOString().slice(0, 10);

    const { data: todaySessions } = await adminDb
      .from("class_sessions")
      .select("id, instructor_id, studio_id")
      .eq("session_date", todayIso)
      .eq("is_cancelled", false)
      .not("instructor_id", "is", null);

    const sessions = (todaySessions ?? []) as Array<{
      id: string;
      instructor_id: string;
      studio_id: string;
    }>;
    if (sessions.length === 0) return NextResponse.json({ sent: 0 });

    // Group sessions by instructor
    const byInstructor = new Map<
      string,
      { studioId: string; sessionIds: string[] }
    >();
    for (const s of sessions) {
      const existing = byInstructor.get(s.instructor_id);
      if (existing) {
        existing.sessionIds.push(s.id);
      } else {
        byInstructor.set(s.instructor_id, {
          studioId: s.studio_id,
          sessionIds: [s.id],
        });
      }
    }

    let totalSent = 0;

    for (const [instructorId, info] of Array.from(byInstructor.entries())) {
      // Profile id for this instructor
      const { data: inst } = await adminDb
        .from("instructors")
        .select("profile_id")
        .eq("id", instructorId)
        .maybeSingle();
      if (!inst?.profile_id) continue;

      // Today's confirmed bookings → student set
      const { data: todayBookings } = await adminDb
        .from("bookings")
        .select("member_id, members(current_streak_weeks, profiles(full_name))")
        .in("session_id", info.sessionIds)
        .eq("status", "confirmed");

      const memberIds = new Set<string>();
      const loyaltyCandidates: Array<{ name: string; streak: number }> = [];
      for (const b of (todayBookings ?? []) as Array<{
        member_id: string;
        members?: {
          current_streak_weeks?: number | null;
          profiles?: { full_name?: string | null } | null;
        } | null;
      }>) {
        memberIds.add(b.member_id);
        const streak = b.members?.current_streak_weeks ?? 0;
        const name = b.members?.profiles?.full_name;
        if (streak >= LOYALTY_STREAK_THRESHOLD && name) {
          loyaltyCandidates.push({ name, streak });
        }
      }

      // Detect "new faces": members who have never attended a session
      // taught by this instructor before today (no past pass_class_usage
      // and no prior bookings on this instructor's sessions)
      let newStudentCount = 0;
      if (memberIds.size > 0) {
        const memberIdList = Array.from(memberIds);
        const { data: priorSessions } = await adminDb
          .from("class_sessions")
          .select("id")
          .eq("instructor_id", instructorId)
          .lt("session_date", todayIso);
        const priorSessionIds = (priorSessions ?? []).map(
          (s) => (s as { id: string }).id
        );

        if (priorSessionIds.length === 0) {
          newStudentCount = memberIdList.length;
        } else {
          const { data: priorBookings } = await adminDb
            .from("bookings")
            .select("member_id")
            .in("session_id", priorSessionIds)
            .eq("attended", true)
            .in("member_id", memberIdList);
          const veteranIds = new Set(
            (priorBookings ?? []).map(
              (r) => (r as { member_id: string }).member_id
            )
          );
          newStudentCount = memberIdList.filter(
            (id) => !veteranIds.has(id)
          ).length;
        }
      }

      let loyaltyHighlight: string | null = null;
      if (loyaltyCandidates.length > 0) {
        const top = loyaltyCandidates.sort((a, b) => b.streak - a.streak)[0];
        loyaltyHighlight = `${top.name} on ${top.streak}-week streak`;
      }

      const payload = pushInstructorMorningBriefing({
        classCount: info.sessionIds.length,
        studentCount: memberIds.size,
        newStudentCount,
        loyaltyHighlight,
      });

      try {
        const r = await sendPushNotification({
          profileId: inst.profile_id,
          studioId: info.studioId,
          type: "instructor_morning_briefing",
          payload,
        });
        totalSent += r.sent;
      } catch (err) {
        console.error("morning-briefing push failed:", err);
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
