// @ts-nocheck - Supabase generic type mismatch between createClient overloads
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { insertCronLog } from "@/lib/admin/logs";
import { sendEmail } from "@/lib/email/send";
import { passDistributionPaid, passDistributionFailed } from "@/lib/email/templates";

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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
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

    for (const dist of distributions) {
      try {
        // Optimistic lock: claim this record by setting status to 'processing'.
        // If another cron run already claimed it, the update won't match and we skip.
        const { count: claimed } = await supabase
          .from("pass_distributions")
          .update({ status: "processing" })
          .eq("id", dist.id)
          .eq("status", "approved")
          .is("stripe_transfer_id", null);

        if (!claimed || claimed === 0) {
          // Already being processed by another run — skip
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

        // Get instructor's Stripe account
        const { data: instructor } = await supabase
          .from("instructors")
          .select("id, stripe_account_id, profile_id")
          .eq("id", dist.instructor_id)
          .single();

        if (!instructor?.stripe_account_id) {
          await supabase
            .from("pass_distributions")
            .update({ status: "failed" })
            .eq("id", dist.id);
          failCount++;

          // Notify owner
          await notifyOwnerOfFailure(supabase, dist, "Instructor does not have a connected Stripe account.");
          continue;
        }

        // Create Stripe Transfer with idempotency key
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

        // Update status
        await supabase
          .from("pass_distributions")
          .update({ status: "completed", stripe_transfer_id: transfer.id })
          .eq("id", dist.id);

        successCount++;

        // Send payout notification to instructor
        const { data: instructorProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", instructor.profile_id)
          .single();

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
        console.error(`[pass-payout] Transfer error for dist ${dist.id}:`, errMsg);

        await supabase
          .from("pass_distributions")
          .update({ status: "failed" })
          .eq("id", dist.id);
        failCount++;

        await notifyOwnerOfFailure(supabase, dist, errMsg);
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
    console.error("[pass-payout] Error:", message);
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
  supabase: ReturnType<typeof createClient>,
  dist: { studio_id: string; instructor_id: string; payout_amount: number; period_start: string },
  errorMessage: string
) {
  try {
    const monthLabel = new Date(dist.period_start + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    const { data: owner } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("studio_id", dist.studio_id)
      .eq("role", "owner")
      .single();

    let instructorName = "Instructor";
    const { data: inst } = await supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", dist.instructor_id)
      .single();

    if (inst?.profile_id) {
      const { data: instProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", inst.profile_id)
        .single();
      if (instProfile?.full_name) instructorName = instProfile.full_name;
    }

    if (owner?.email) {
      const { subject, html } = passDistributionFailed({
        ownerName: owner.full_name ?? "Studio Owner",
        instructorName,
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
    console.error("[pass-payout] Failed to notify owner of payout failure");
  }
}
