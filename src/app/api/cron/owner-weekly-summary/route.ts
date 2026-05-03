import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { ownerWeeklySummary } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type StudioRow = {
  id: string;
  name: string;
  currency: string | null;
};

type PaymentRow = { amount: number };

/**
 * Monday morning weekly summary email for studio owners.
 * Covers the prior 7 days vs the 7 days before that for delta.
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
        job_name: "owner-weekly-summary",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    /* ignore log failure */
  }

  try {
    const now = new Date();
    const endThis = new Date(now);
    endThis.setUTCHours(0, 0, 0, 0);
    const startThis = new Date(endThis);
    startThis.setUTCDate(startThis.getUTCDate() - 7);
    const startPrior = new Date(startThis);
    startPrior.setUTCDate(startPrior.getUTCDate() - 7);

    const startThisIso = startThis.toISOString();
    const endThisIso = endThis.toISOString();
    const startPriorIso = startPrior.toISOString();

    const { data: studios } = await adminDb
      .from("studios")
      .select("id, name, currency");

    if (!studios?.length) {
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

    let sent = 0;
    const failures: string[] = [];

    for (const s of studios as StudioRow[]) {
      try {
        // Owner profile + email
        const { data: owner } = await adminDb
          .from("profiles")
          .select("id, full_name, email")
          .eq("studio_id", s.id)
          .eq("role", "owner")
          .maybeSingle();
        if (!owner?.email) continue;

        // Revenue this week / prior week
        const [{ data: thisPays }, { data: priorPays }] = await Promise.all([
          adminDb
            .from("payments")
            .select("amount")
            .eq("studio_id", s.id)
            .eq("status", "paid")
            .gte("paid_at", startThisIso)
            .lt("paid_at", endThisIso),
          adminDb
            .from("payments")
            .select("amount")
            .eq("studio_id", s.id)
            .eq("status", "paid")
            .gte("paid_at", startPriorIso)
            .lt("paid_at", startThisIso),
        ]);

        const sum = (rows: PaymentRow[] | null | undefined) =>
          (rows ?? []).reduce((a, r) => a + (r.amount ?? 0), 0);
        const revenueCents = sum(thisPays);
        const priorCents = sum(priorPays);
        const revenueDeltaPct = priorCents > 0
          ? ((revenueCents - priorCents) / priorCents) * 100
          : null;

        // New / cancelled members
        const [{ count: newMembers }, { count: cancelledMembers }] =
          await Promise.all([
            adminDb
              .from("members")
              .select("id", { count: "exact", head: true })
              .eq("studio_id", s.id)
              .gte("joined_at", startThisIso)
              .lt("joined_at", endThisIso),
            adminDb
              .from("members")
              .select("id", { count: "exact", head: true })
              .eq("studio_id", s.id)
              .eq("status", "cancelled")
              .gte("created_at", startThisIso)
              .lt("created_at", endThisIso),
          ]);

        // Top classes by booking count this week
        const { data: weekBookings } = await adminDb
          .from("bookings")
          .select(
            "id, session_id, class_sessions(template_id, instructor_id, class_templates(name))"
          )
          .eq("studio_id", s.id)
          .eq("status", "confirmed")
          .gte("created_at", startThisIso)
          .lt("created_at", endThisIso);

        const classTally = new Map<string, number>();
        const instructorTally = new Map<string, number>();
        for (const b of (weekBookings ?? []) as Array<{
          class_sessions?: {
            instructor_id?: string | null;
            class_templates?: { name?: string | null } | null;
          } | null;
        }>) {
          const name = b.class_sessions?.class_templates?.name;
          if (name) classTally.set(name, (classTally.get(name) ?? 0) + 1);
          const instId = b.class_sessions?.instructor_id;
          if (instId)
            instructorTally.set(instId, (instructorTally.get(instId) ?? 0) + 1);
        }

        const topClasses = Array.from(classTally.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, bookings]) => ({ name, bookings }));

        let topInstructor: { name: string; bookings: number } | null = null;
        const topInstructorEntry = Array.from(instructorTally.entries())
          .sort((a, b) => b[1] - a[1])[0];
        if (topInstructorEntry) {
          const [instId, bookings] = topInstructorEntry;
          const { data: inst } = await adminDb
            .from("instructors")
            .select("profiles(full_name)")
            .eq("id", instId)
            .maybeSingle();
          const name =
            (inst as { profiles?: { full_name?: string } } | null)?.profiles
              ?.full_name ?? "Instructor";
          topInstructor = { name, bookings };
        }

        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const tpl = ownerWeeklySummary({
          ownerName: owner.full_name ?? "there",
          studioName: s.name,
          currency: s.currency ?? "USD",
          weekStart: fmt(startThis),
          weekEnd: fmt(new Date(endThis.getTime() - 86_400_000)),
          revenueCents,
          revenueDeltaPct,
          newMembers: newMembers ?? 0,
          cancelledMembers: cancelledMembers ?? 0,
          topClasses,
          topInstructor,
        });

        const ok = await sendEmail({
          to: owner.email,
          subject: tpl.subject,
          html: tpl.html,
          studioId: s.id,
          templateName: "owner_weekly_summary",
        });
        if (ok) sent += 1;
      } catch (err) {
        failures.push(`${s.id}:${err instanceof Error ? err.message : String(err)}`);
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
