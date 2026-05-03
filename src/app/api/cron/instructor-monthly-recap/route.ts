import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { instructorMonthlyRecap } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type EarningRow = { instructor_id: string; instructor_payout: number };

/**
 * Monthly recap email for every instructor — earnings, classes,
 * unique students, average rating, and personal-best detection.
 * Should run on the 1st of every month covering the prior month.
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
        job_name: "instructor-monthly-recap",
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
    const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const priorMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)
    );
    const monthLabel = lastMonthStart.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    });

    // Pull all earnings for [priorMonthStart, lastMonthEnd) so we can
    // compute current and prior totals in one pass.
    const { data: earnings } = await adminDb
      .from("instructor_earnings")
      .select("instructor_id, instructor_payout, status, created_at")
      .eq("status", "completed")
      .gte("created_at", priorMonthStart.toISOString())
      .lt("created_at", lastMonthEnd.toISOString());

    const lastByInstructor = new Map<string, number>();
    const priorByInstructor = new Map<string, number>();
    for (const row of (earnings ?? []) as Array<
      EarningRow & { created_at: string }
    >) {
      const created = new Date(row.created_at);
      const target =
        created >= lastMonthStart ? lastByInstructor : priorByInstructor;
      target.set(
        row.instructor_id,
        (target.get(row.instructor_id) ?? 0) + (row.instructor_payout ?? 0)
      );
    }

    // Personal best detection — find max month earnings ever (excluding current)
    const { data: allTimeEarnings } = await adminDb
      .from("instructor_earnings")
      .select("instructor_id, instructor_payout, created_at")
      .eq("status", "completed")
      .lt("created_at", lastMonthStart.toISOString());

    const monthlyMaxByInstructor = new Map<string, number>();
    {
      const monthSums = new Map<string, number>();
      for (const row of (allTimeEarnings ?? []) as Array<
        EarningRow & { created_at: string }
      >) {
        const d = new Date(row.created_at);
        const key = `${row.instructor_id}|${d.getUTCFullYear()}-${d.getUTCMonth()}`;
        monthSums.set(
          key,
          (monthSums.get(key) ?? 0) + (row.instructor_payout ?? 0)
        );
      }
      for (const [key, sum] of Array.from(monthSums.entries())) {
        const instructorId = key.split("|")[0];
        const cur = monthlyMaxByInstructor.get(instructorId) ?? 0;
        if (sum > cur) monthlyMaxByInstructor.set(instructorId, sum);
      }
    }

    const instructorIds = Array.from(lastByInstructor.keys());
    if (instructorIds.length === 0) return NextResponse.json({ sent: 0 });

    let sent = 0;
    const failures: string[] = [];

    for (const instructorId of instructorIds) {
      try {
        const { data: inst } = await adminDb
          .from("instructors")
          .select(
            "profile_id, studio_id, studios(currency), profiles(full_name, email)"
          )
          .eq("id", instructorId)
          .maybeSingle();
        const i = inst as
          | {
              profile_id?: string;
              studio_id?: string;
              studios?: { currency?: string | null } | null;
              profiles?: { full_name?: string | null; email?: string | null } | null;
            }
          | null;
        if (!i?.profiles?.email) continue;

        const earningsCents = lastByInstructor.get(instructorId) ?? 0;
        const priorCents = priorByInstructor.get(instructorId) ?? 0;
        const earningsDeltaPct =
          priorCents > 0 ? ((earningsCents - priorCents) / priorCents) * 100 : null;

        // Sessions taught in last month
        const { data: lastSessions } = await adminDb
          .from("class_sessions")
          .select("id")
          .eq("instructor_id", instructorId)
          .gte("session_date", lastMonthStart.toISOString().slice(0, 10))
          .lt("session_date", lastMonthEnd.toISOString().slice(0, 10))
          .eq("is_cancelled", false);
        const sessionIds = (lastSessions ?? []).map(
          (s) => (s as { id: string }).id
        );
        const classesTaught = sessionIds.length;

        let uniqueStudents = 0;
        if (sessionIds.length > 0) {
          const { data: bks } = await adminDb
            .from("bookings")
            .select("member_id")
            .in("session_id", sessionIds)
            .eq("status", "confirmed");
          uniqueStudents = new Set(
            (bks ?? []).map((b) => (b as { member_id: string }).member_id)
          ).size;
        }

        const { data: reviews } = await adminDb
          .from("class_reviews")
          .select("rating")
          .eq("instructor_id", instructorId)
          .gte("created_at", lastMonthStart.toISOString())
          .lt("created_at", lastMonthEnd.toISOString());
        const reviewCount = reviews?.length ?? 0;
        const averageRating =
          reviewCount > 0
            ? (reviews!.reduce(
                (a, r) => a + (r as { rating: number }).rating,
                0
              ) / reviewCount)
            : null;

        const allTimeMax = monthlyMaxByInstructor.get(instructorId) ?? 0;
        const isPersonalBest = earningsCents > allTimeMax && earningsCents > 0;

        const tpl = instructorMonthlyRecap({
          instructorName: i.profiles.full_name ?? "there",
          monthLabel,
          currency: i.studios?.currency ?? "USD",
          earningsCents,
          earningsDeltaPct,
          classesTaught,
          uniqueStudents,
          averageRating,
          reviewCount,
          isPersonalBest,
        });

        const ok = await sendEmail({
          to: i.profiles.email,
          subject: tpl.subject,
          html: tpl.html,
          studioId: i.studio_id ?? null,
          templateName: "instructor_monthly_recap",
        });
        if (ok) sent += 1;
      } catch (err) {
        failures.push(
          `${instructorId}:${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "success",
          affected_count: sent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", cronLogId);
    }

    return NextResponse.json({ sent, failures: failures.length });
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
