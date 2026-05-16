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

    // Batch fetch all data before the loop to avoid N+1 queries
    const instructorIds = Array.from(byInstructor.keys());
    const allSessionIds = sessions.map(s => s.id);

    const [{ data: instructorRows }, { data: allTodayBookings }, { data: allPriorSessions }] = await Promise.all([
      adminDb.from("instructors").select("id, profile_id").in("id", instructorIds),
      adminDb.from("bookings").select("session_id, member_id, members(current_streak_weeks, profiles(full_name))").in("session_id", allSessionIds).eq("status", "confirmed"),
      adminDb.from("class_sessions").select("id, instructor_id").in("instructor_id", instructorIds).lt("session_date", todayIso),
    ]);

    const profileIdMap = new Map<string, string>();
    for (const inst of instructorRows ?? []) profileIdMap.set(inst.id, inst.profile_id);

    type BookingRow = { session_id: string; member_id: string; members?: { current_streak_weeks?: number | null; profiles?: { full_name?: string | null } | null } | null };
    const bookingsBySessionId = new Map<string, BookingRow[]>();
    for (const b of (allTodayBookings ?? []) as BookingRow[]) {
      if (!bookingsBySessionId.has(b.session_id)) bookingsBySessionId.set(b.session_id, []);
      bookingsBySessionId.get(b.session_id)!.push(b);
    }

    const sessionInstructorMap = new Map<string, string>();
    for (const s of (allPriorSessions ?? []) as Array<{ id: string; instructor_id: string }>) {
      sessionInstructorMap.set(s.id, s.instructor_id);
    }

    // Batch fetch prior attended bookings (depends on prior session IDs)
    const allPriorSessionIds = (allPriorSessions ?? []).map((s: { id: string }) => s.id);
    const { data: allPriorBookings } = allPriorSessionIds.length > 0
      ? await adminDb.from("bookings").select("session_id, member_id").in("session_id", allPriorSessionIds).eq("attended", true)
      : { data: [] };

    const veteransByInstructor = new Map<string, Set<string>>();
    for (const b of (allPriorBookings ?? []) as Array<{ session_id: string; member_id: string }>) {
      const instrId = sessionInstructorMap.get(b.session_id);
      if (instrId) {
        if (!veteransByInstructor.has(instrId)) veteransByInstructor.set(instrId, new Set());
        veteransByInstructor.get(instrId)!.add(b.member_id);
      }
    }

    let totalSent = 0;

    for (const [instructorId, info] of Array.from(byInstructor.entries())) {
      const profileId = profileIdMap.get(instructorId);
      if (!profileId) continue;

      // Gather today's bookings from the batch Map
      const todayBookings: BookingRow[] = [];
      for (const sid of info.sessionIds) {
        const bs = bookingsBySessionId.get(sid);
        if (bs) todayBookings.push(...bs);
      }

      const memberIds = new Set<string>();
      const loyaltyCandidates: Array<{ name: string; streak: number }> = [];
      for (const b of todayBookings) {
        memberIds.add(b.member_id);
        const streak = b.members?.current_streak_weeks ?? 0;
        const name = b.members?.profiles?.full_name;
        if (streak >= LOYALTY_STREAK_THRESHOLD && name) {
          loyaltyCandidates.push({ name, streak });
        }
      }

      let newStudentCount = 0;
      if (memberIds.size > 0) {
        const veteranIds = veteransByInstructor.get(instructorId) ?? new Set();
        newStudentCount = Array.from(memberIds).filter(id => !veteranIds.has(id)).length;
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
          profileId,
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
