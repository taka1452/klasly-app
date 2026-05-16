import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { passRenewalReminder } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Daily cron — emails members whose pass expires in exactly 7 days OR
 * 0 days (today). Two windows so members get a heads-up AND a
 * last-chance reminder. We rely on the exact-day match plus a daily
 * schedule to avoid sending the same reminder twice; the cron_logs
 * table records each run for audit.
 *
 * Skips renewing-monthly subscriptions (status = active &
 * cancel_at_period_end = false) — those are handled by Stripe.
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
        job_name: "pass-renewal-reminder",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // logging is best-effort
  }

  try {
    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = ymd(today);
    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);
    const sevenStr = ymd(sevenDays);

    // Renewal-eligible subscriptions: status=active, not auto-renewing
    // monthly, expiring exactly today OR in 7 days.
    const { data: subs, error: subsErr } = await adminDb
      .from("pass_subscriptions")
      .select(
        "id, member_id, studio_pass_id, current_period_end, status, cancel_at_period_end, stripe_subscription_id"
      )
      .in("current_period_end", [todayStr, sevenStr])
      .eq("status", "active");

    if (subsErr || !subs?.length) {
      if (cronLogId) {
        await adminDb
          .from("cron_logs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            details: { sent: 0, candidates: 0 },
          })
          .eq("id", cronLogId);
      }
      return NextResponse.json({ sent: 0, candidates: 0 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let sent = 0;
    let skipped = 0;

    for (const sub of subs) {
      // Skip true monthly auto-renew subscriptions — Stripe handles those.
      if (sub.stripe_subscription_id && !sub.cancel_at_period_end) {
        skipped++;
        continue;
      }

      const [{ data: pass }, { data: member }] = await Promise.all([
        adminDb
          .from("studio_passes")
          .select("id, name, studio_id")
          .eq("id", sub.studio_pass_id)
          .single(),
        adminDb
          .from("members")
          .select("id, profile_id, studio_id")
          .eq("id", sub.member_id)
          .single(),
      ]);
      if (!pass || !member) {
        skipped++;
        continue;
      }

      const [{ data: profile }, { data: studio }] = await Promise.all([
        adminDb
          .from("profiles")
          .select("full_name, email")
          .eq("id", member.profile_id)
          .single(),
        adminDb
          .from("studios")
          .select("name")
          .eq("id", pass.studio_id)
          .single(),
      ]);
      if (!profile?.email) {
        skipped++;
        continue;
      }

      const daysLeft = sub.current_period_end === todayStr ? 0 : 7;

      const { subject, html } = passRenewalReminder({
        memberName: profile.full_name || "there",
        passName: pass.name,
        expiresOn: sub.current_period_end,
        daysLeft,
        studioName: studio?.name || "your studio",
        purchaseUrl: `${baseUrl}/purchase`,
      });

      try {
        await sendEmail({
          to: profile.email,
          subject,
          html,
          studioId: pass.studio_id,
          templateName: "pass_renewal_reminder",
        });
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
          details: { sent, candidates: subs.length, skipped },
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ sent, candidates: subs.length, skipped });
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
