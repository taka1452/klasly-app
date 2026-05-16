import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { instructorTier80Alert } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Daily cron — emails instructors who've used >= 80% of their monthly
 * hour pool. Sends at most once per month (tier_80_alert_sent_at is
 * cleared the first time the cron sees a new month for the membership).
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
        job_name: "instructor-tier-80-alert",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // best-effort
  }

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    // All active memberships with an hour pool. Unlimited-hour tiers
    // (monthly_minutes = -1) and free tiers are excluded.
    const { data: memberships } = await adminDb
      .from("instructor_memberships")
      .select(
        "id, instructor_id, tier_id, tier_80_alert_sent_at, instructor_membership_tiers(name, monthly_minutes, allow_overage, overage_rate_cents)"
      )
      .eq("status", "active");

    let sent = 0;
    let skipped = 0;

    for (const m of memberships ?? []) {
      const rawTier = (m as { instructor_membership_tiers?: unknown })
        .instructor_membership_tiers;
      const tier = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
        name?: string;
        monthly_minutes?: number;
        allow_overage?: boolean | null;
        overage_rate_cents?: number | null;
      } | null;
      if (!tier || !tier.monthly_minutes || tier.monthly_minutes <= 0) {
        skipped++;
        continue;
      }

      // Reset the sent timestamp at the start of a new month so we can
      // alert again. Treat any timestamp older than the current month's
      // start as stale.
      const sentAt = (m as { tier_80_alert_sent_at?: string | null })
        .tier_80_alert_sent_at;
      if (sentAt && new Date(sentAt) >= new Date(monthStart)) {
        skipped++;
        continue;
      }

      // Sum class minutes this month for this instructor.
      const { data: monthSessions } = await adminDb
        .from("class_sessions")
        .select("duration_minutes")
        .eq("instructor_id", (m as { instructor_id: string }).instructor_id)
        .gte("session_date", monthStart)
        .lt("session_date", monthEnd)
        .eq("is_cancelled", false);
      let usedMinutes = 0;
      for (const s of monthSessions ?? []) {
        usedMinutes += s.duration_minutes ?? 0;
      }

      const pct = usedMinutes / tier.monthly_minutes;
      if (pct < 0.8) {
        skipped++;
        continue;
      }

      // Resolve who to email.
      const instructorId = (m as { instructor_id: string }).instructor_id;
      const { data: instructor } = await adminDb
        .from("instructors")
        .select("profile_id, studio_id")
        .eq("id", instructorId)
        .single();
      if (!instructor) {
        skipped++;
        continue;
      }
      const { data: profile } = await adminDb
        .from("profiles")
        .select("full_name, email")
        .eq("id", instructor.profile_id)
        .single();
      if (!profile?.email) {
        skipped++;
        continue;
      }
      const { data: studio } = await adminDb
        .from("studios")
        .select("name")
        .eq("id", instructor.studio_id)
        .single();

      const remainingMinutes = Math.max(0, tier.monthly_minutes - usedMinutes);
      const overMinutes = Math.max(0, usedMinutes - tier.monthly_minutes);
      const estimatedOverageCents =
        overMinutes > 0 && tier.allow_overage && tier.overage_rate_cents
          ? Math.round((overMinutes / 60) * tier.overage_rate_cents)
          : undefined;

      const { subject, html } = instructorTier80Alert({
        instructorName: profile.full_name || "there",
        studioName: studio?.name || "your studio",
        tierName: tier.name || "Hourly plan",
        usedMinutes,
        includedMinutes: tier.monthly_minutes,
        remainingMinutes,
        estimatedOverageCents,
        allowsOverage: !!tier.allow_overage,
      });

      try {
        await sendEmail({
          to: profile.email,
          subject,
          html,
          studioId: instructor.studio_id,
          templateName: "instructor_tier_80_alert",
        });
        await adminDb
          .from("instructor_memberships")
          .update({ tier_80_alert_sent_at: new Date().toISOString() })
          .eq("id", (m as { id: string }).id);
        sent++;
      } catch {
        skipped++;
      }
    }

    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          details: { sent, skipped, total: memberships?.length ?? 0 },
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ sent, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          details: { error: message },
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
