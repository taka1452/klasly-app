import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { insertCronLog } from "@/lib/admin/logs";
import { sendEmail } from "@/lib/email/send";
import { passDistributionReview } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Monthly pass distribution cron — runs on the 1st of each month at 00:00 UTC.
 *
 * For each active studio pass with feature flag ON:
 * 1. Aggregate previous month's pass_class_usage by instructor
 * 2. Calculate distributable amount (revenue - fees)
 * 3. Split among instructors by class count ratio
 * 4. Insert pass_distributions records
 * 5. Send review email to owner if auto_distribute is OFF
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
  let totalDistributions = 0;

  try {
    // Calculate previous month period using UTC to avoid timezone drift
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth(); // 0-indexed, this is current month
    // Previous month: utcMonth - 1 (handles Jan → Dec of prev year via Date)
    const prevMonthStart = new Date(Date.UTC(utcYear, utcMonth - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(utcYear, utcMonth, 0)); // last day of prev month
    const periodStart = prevMonthStart.toISOString().slice(0, 10);
    const periodEnd = prevMonthEnd.toISOString().slice(0, 10);
    const monthLabel = prevMonthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    // Get all active passes where studio has feature flag enabled
    const { data: featureRows } = await supabase
      .from("studio_features")
      .select("studio_id")
      .eq("feature_key", "extension.studio_pass")
      .eq("enabled", true);

    const enabledStudioIds = (featureRows ?? []).map((r) => r.studio_id);
    if (enabledStudioIds.length === 0) {
      await insertCronLog(supabase, {
        job_name: "pass-distribution",
        status: "success",
        affected_count: 0,
        details: { message: "No studios with studio_pass enabled" },
        started_at: cronStartedAt,
      });
      return NextResponse.json({ ok: true, distributions: 0 });
    }

    const { data: passes } = await supabase
      .from("studio_passes")
      .select("id, studio_id, price_cents, auto_distribute")
      .eq("is_active", true)
      .in("studio_id", enabledStudioIds);

    if (!passes || passes.length === 0) {
      await insertCronLog(supabase, {
        job_name: "pass-distribution",
        status: "success",
        affected_count: 0,
        details: { message: "No active passes" },
        started_at: cronStartedAt,
      });
      return NextResponse.json({ ok: true, distributions: 0 });
    }

    // Get platform fee percent
    const { data: feeRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = parseFloat(feeRow?.value ?? "0.5");

    for (const pass of passes) {
      // Count active subscriptions for this pass during the prev month
      const { data: activeSubs } = await supabase
        .from("pass_subscriptions")
        .select("id")
        .eq("studio_pass_id", pass.id)
        .in("status", ["active", "cancelled"])
        .lte("current_period_start", periodEnd)
        .gte("current_period_end", periodStart);

      const subCount = activeSubs?.length ?? 0;
      if (subCount === 0) continue;

      // Aggregate usage by instructor
      const subIds = (activeSubs ?? []).map((s) => s.id);
      const { data: usageRows } = await supabase
        .from("pass_class_usage")
        .select("instructor_id")
        .in("pass_subscription_id", subIds)
        .gte("used_at", `${periodStart}T00:00:00Z`)
        .lte("used_at", `${periodEnd}T23:59:59Z`);

      if (!usageRows || usageRows.length === 0) continue;

      // Count per instructor
      const instructorCounts = new Map<string, number>();
      for (const row of usageRows) {
        instructorCounts.set(row.instructor_id, (instructorCounts.get(row.instructor_id) ?? 0) + 1);
      }

      const totalPoolClasses = usageRows.length;
      const grossRevenue = subCount * pass.price_cents;

      // Fee calculations
      const stripeFee = Math.round(grossRevenue * 0.029 + subCount * 30);
      const klaslyFee = Math.round(grossRevenue * (platformFeePercent / 100));

      // Get studio fee
      const { data: studio } = await supabase
        .from("studios")
        .select("studio_fee_percentage, studio_fee_type")
        .eq("id", pass.studio_id)
        .single();

      const studioFeePercent = studio?.studio_fee_percentage ?? 0;
      const studioFee = Math.round(grossRevenue * (studioFeePercent / 100));

      const distributableAmount = Math.max(0, grossRevenue - stripeFee - klaslyFee - studioFee);
      if (distributableAmount === 0) continue;

      // Distribute by ratio
      const entries = Array.from(instructorCounts.entries());
      let distributed = 0;

      const distributions = entries.map(([instructorId, count], index) => {
        let payout: number;
        if (index === entries.length - 1) {
          // Last instructor gets remainder to avoid rounding issues
          payout = distributableAmount - distributed;
        } else {
          payout = Math.floor(distributableAmount * (count / totalPoolClasses));
        }
        distributed += payout;

        return {
          studio_id: pass.studio_id,
          studio_pass_id: pass.id,
          instructor_id: instructorId,
          period_start: periodStart,
          period_end: periodEnd,
          total_classes: count,
          total_pool_classes: totalPoolClasses,
          gross_pool_amount: distributableAmount,
          payout_amount: payout,
          status: pass.auto_distribute ? "approved" : "pending",
        };
      });

      const { error } = await supabase.from("pass_distributions").insert(distributions);
      if (error) {
        console.error(`[pass-distribution] Insert error for pass ${pass.id}:`, error.message);
        continue;
      }

      totalDistributions += distributions.length;

      // Send review email if auto_distribute is OFF
      if (!pass.auto_distribute) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("studio_id", pass.studio_id)
          .eq("role", "owner")
          .single();

        if (ownerProfile?.email) {
          const { subject, html } = passDistributionReview({
            ownerName: ownerProfile.full_name ?? "Studio Owner",
            month: monthLabel,
            totalRevenue: grossRevenue,
            instructorCount: entries.length,
            distributableAmount,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.klasly.app"}/passes/distributions`,
          });
          await sendEmail({
            to: ownerProfile.email,
            subject,
            html,
            studioId: pass.studio_id,
            templateName: "passDistributionReview",
          });
        }
      }
    }

    await insertCronLog(supabase, {
      job_name: "pass-distribution",
      status: "success",
      affected_count: totalDistributions,
      details: { periodStart, periodEnd },
      started_at: cronStartedAt,
    });

    return NextResponse.json({ ok: true, distributions: totalDistributions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[pass-distribution] Error:", message);
    await insertCronLog(supabase, {
      job_name: "pass-distribution",
      status: "error",
      error_message: message,
      started_at: cronStartedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
