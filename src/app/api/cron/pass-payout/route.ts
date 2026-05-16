import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { insertCronLog } from "@/lib/admin/logs";
import { sendEmail } from "@/lib/email/send";
import { passDistributionPaid, passDistributionFailed } from "@/lib/email/templates";
import { createTypedAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin-typed";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Monthly pass payout cron — runs on the 1st of each month at 02:00 UTC.
 *
 * Processes all approved pass_distributions that haven't been paid yet:
 * 1. Create Stripe Transfer to instructor's connected account
 * 2. Update status to completed/failed
 * 3. Send email notifications
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: AdminSupabaseClient;
  try {
    supabase = createTypedAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const cronStartedAt = new Date().toISOString();
  let successCount = 0;
  let failCount = 0;

  try {
    // Get all approved distributions without a stripe_transfer_id
    const { data: distributions } = await supabase
      .from("pass_distributions")
      .select("id, studio_id, instructor_id, payout_amount, period_start, period_end, total_classes, total_pool_classes")
      .eq("status", "approved")
      .is("stripe_transfer_id", null);

    if (!distributions || distributions.length === 0) {
      await insertCronLog(supabase, {
        job_name: "pass-payout",
        status: "success",
        affected_count: 0,
        details: { message: "No approved distributions to process" },
        started_at: cronStartedAt,
      });
      return NextResponse.json({ ok: true, success: 0, failed: 0 });
    }

    // Batch-fetch all instructors with profiles before the loop
    const instructorIds = Array.from(new Set<string>(distributions.map((d) => d.instructor_id)));
    const { data: instructorRows } = await supabase
      .from("instructors")
      .select("id, stripe_account_id, profile_id, profiles(full_name, email)")
      .in("id", instructorIds);

    const instructorMap = new Map<string, {
      stripe_account_id: string | null;
      profile_id: string;
      profiles: { full_name: string | null; email: string | null } | null;
    }>();
    for (const inst of instructorRows ?? []) {
      const p = Array.isArray(inst.profiles) ? inst.profiles[0] : inst.profiles;
      instructorMap.set(inst.id, { stripe_account_id: inst.stripe_account_id, profile_id: inst.profile_id, profiles: p ?? null });
    }

    for (const dist of distributions) {
      try {
        const { count: claimed } = await supabase
          .from("pass_distributions")
          .update({ status: "processing" })
          .eq("id", dist.id)
          .eq("status", "approved")
          .is("stripe_transfer_id", null);

        if (!claimed || claimed === 0) {
          continue;
        }

        if (dist.payout_amount <= 0) {
          await supabase
            .from("pass_distributions")
            .update({ status: "completed", stripe_transfer_id: "skipped_zero" })
            .eq("id", dist.id);
          successCount++;
          continue;
        }

        const instructor = instructorMap.get(dist.instructor_id);
        if (!instructor?.stripe_account_id) {
          await supabase
            .from("pass_distributions")
            .update({ status: "failed" })
            .eq("id", dist.id);
          failCount++;
          await notifyOwnerOfFailure(supabase, dist, "Instructor does not have a connected Stripe account.", instructor?.profiles?.full_name ?? undefined);
          continue;
        }

        const monthLabel = new Date(dist.period_start + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        const transfer = await stripe.transfers.create(
          {
            amount: dist.payout_amount,
            currency: "usd",
            destination: instructor.stripe_account_id,
            description: `Pass distribution — ${monthLabel}`,
            metadata: {
              pass_distribution_id: dist.id,
              instructor_id: dist.instructor_id,
              period: `${dist.period_start} to ${dist.period_end}`,
            },
          },
          { idempotencyKey: `pass_dist_${dist.id}` }
        );

        await supabase
          .from("pass_distributions")
          .update({ status: "completed", stripe_transfer_id: transfer.id })
          .eq("id", dist.id);

        successCount++;

        const instructorProfile = instructor.profiles;
        if (instructorProfile?.email) {
          const sharePercent =
            dist.total_pool_classes > 0
              ? `${((dist.total_classes / dist.total_pool_classes) * 100).toFixed(1)}%`
              : "100%";
          const { subject, html } = passDistributionPaid({
            instructorName: instructorProfile.full_name ?? "Instructor",
            month: monthLabel,
            payoutAmount: dist.payout_amount,
            classCount: dist.total_classes,
            sharePercent,
          });
          await sendEmail({
            to: instructorProfile.email,
            subject,
            html,
            studioId: dist.studio_id,
            templateName: "passDistributionPaid",
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Transfer failed";
        logger.error("Pass payout transfer failed", { distributionId: dist.id, error: errMsg });

        await supabase
          .from("pass_distributions")
          .update({ status: "failed" })
          .eq("id", dist.id);
        failCount++;

        const instrName = instructorMap.get(dist.instructor_id)?.profiles?.full_name ?? undefined;
        await notifyOwnerOfFailure(supabase, dist, errMsg, instrName);
      }
    }

    await insertCronLog(supabase, {
      job_name: "pass-payout",
      status: failCount > 0 ? "partial" : "success",
      affected_count: successCount,
      details: { success: successCount, failed: failCount },
      started_at: cronStartedAt,
    });

    return NextResponse.json({ ok: true, success: successCount, failed: failCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Pass payout cron failed", { error: message });
    await insertCronLog(supabase, {
      job_name: "pass-payout",
      status: "error",
      error_message: message,
      started_at: cronStartedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function notifyOwnerOfFailure(
  supabase: AdminSupabaseClient,
  dist: { studio_id: string; instructor_id: string; payout_amount: number; period_start: string },
  errorMessage: string,
  instructorName?: string,
) {
  try {
    const monthLabel = new Date(dist.period_start + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    const { data: owner } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("studio_id", dist.studio_id)
      .eq("role", "owner")
      .single();

    if (owner?.email) {
      const { subject, html } = passDistributionFailed({
        ownerName: owner.full_name ?? "Studio Owner",
        instructorName: instructorName ?? "Instructor",
        month: monthLabel,
        payoutAmount: dist.payout_amount,
        errorMessage,
      });
      await sendEmail({
        to: owner.email,
        subject,
        html,
        studioId: dist.studio_id,
        templateName: "passDistributionFailed",
      });
    }
  } catch {
    logger.error("Failed to notify owner of payout failure", { studioId: dist.studio_id });
  }
}
