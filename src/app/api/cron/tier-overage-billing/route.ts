import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { insertCronLog } from "@/lib/admin/logs";
import { sendEmail } from "@/lib/email/send";
import { tierOverageCharged, tierOverageChargeFailed } from "@/lib/email/templates";
import { createTypedAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin-typed";
import { unwrapRelation } from "@/lib/supabase/relation";
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
 * Monthly tier overage billing cron — runs on the 1st of each month at 01:00 UTC.
 *
 * For each collective-mode studio:
 * 1. Calculate each instructor's hours used last month
 * 2. Compare against tier limits
 * 3. Create overage charge records
 * 4. Charge via Stripe (off-session PaymentIntent on studio's Connect account)
 * 5. Send notification emails
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
  let chargedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  try {
    // Calculate previous month's date range
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = prevMonth.getMonth() + 1;
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const monthName = prevMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

    // Get all collective-mode studios with Stripe Connect
    const { data: studios } = await supabase
      .from("studios")
      .select("id, name, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("payout_model", "instructor_direct")
      .eq("stripe_connect_onboarding_complete", true)
      .not("stripe_connect_account_id", "is", null);

    if (!studios || studios.length === 0) {
      await insertCronLog(supabase, {
        job_name: "tier-overage-billing",
        status: "success",
        affected_count: 0,
        details: { message: "No collective-mode studios found" },
        started_at: cronStartedAt,
      });
      return NextResponse.json({ ok: true, charged: 0, failed: 0, skipped: 0 });
    }

    for (const studio of studios) {
      // Get all active memberships with tiers that have overage billing enabled
      const { data: memberships } = await supabase
        .from("instructor_memberships")
        .select(`
          id,
          instructor_id,
          tier_id,
          stripe_customer_id,
          instructor_membership_tiers(name, monthly_minutes, overage_rate_cents, allow_overage)
        `)
        .eq("studio_id", studio.id)
        .eq("status", "active");

      if (!memberships || memberships.length === 0) continue;

      for (const membership of memberships) {
        const tier = unwrapRelation<{
          name: string;
          monthly_minutes: number;
          overage_rate_cents: number | null;
          allow_overage: boolean;
        }>(membership.instructor_membership_tiers);

        if (!tier) continue;

        // Skip unlimited tiers or tiers without overage billing
        if (tier.monthly_minutes === -1) { skippedCount++; continue; }
        if (!tier.allow_overage || !tier.overage_rate_cents) { skippedCount++; continue; }

        // Get used minutes for the previous month
        const { data: usedData } = await supabase.rpc("get_instructor_used_minutes", {
          p_instructor_id: membership.instructor_id,
          p_year: year,
          p_month: month,
        });

        const usedMinutes = typeof usedData === "number" ? usedData : 0;

        if (usedMinutes <= tier.monthly_minutes) {
          skippedCount++;
          continue;
        }

        // Calculate overage
        const overageMinutes = usedMinutes - tier.monthly_minutes;
        // Pro-rate by minute (15-min granularity comes from booking system naturally)
        const totalChargeCents = Math.ceil((overageMinutes / 60) * tier.overage_rate_cents);

        // Check if charge record already exists for this period
        const { data: existingCharge } = await supabase
          .from("instructor_overage_charges")
          .select("id")
          .eq("instructor_id", membership.instructor_id)
          .eq("period_start", periodStart)
          .maybeSingle();

        if (existingCharge) {
          skippedCount++;
          continue;
        }

        // Create overage charge record
        const { data: chargeRecord, error: insertErr } = await supabase
          .from("instructor_overage_charges")
          .insert({
            studio_id: studio.id,
            instructor_id: membership.instructor_id,
            period_start: periodStart,
            period_end: periodEnd,
            tier_name: tier.name,
            included_minutes: tier.monthly_minutes,
            used_minutes: usedMinutes,
            overage_minutes: overageMinutes,
            overage_rate_cents: tier.overage_rate_cents,
            total_charge_cents: totalChargeCents,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertErr || !chargeRecord) {
          failedCount++;
          continue;
        }

        // Get instructor profile info
        const { data: instructorProfile } = await supabase
          .from("instructors")
          .select("profile_id, profiles(email, full_name)")
          .eq("id", membership.instructor_id)
          .single();

        const profile = unwrapRelation<{
          email: string;
          full_name: string;
        }>(instructorProfile?.profiles);

        // Attempt Stripe charge
        const customerId = membership.stripe_customer_id;
        if (!customerId) {
          // No payment method on file — mark as failed
          await supabase
            .from("instructor_overage_charges")
            .update({ status: "failed" })
            .eq("id", chargeRecord.id);

          failedCount++;
          await sendChargeFailedEmail(supabase, studio, profile, monthName, totalChargeCents, "No payment method on file");
          continue;
        }

        try {
          // Get default payment method for the customer
          const customer = await stripe.customers.retrieve(customerId, {
            stripeAccount: studio.stripe_connect_account_id,
          });

          if (!customer || customer.deleted) {
            throw new Error("Customer not found or deleted");
          }

          const defaultPaymentMethod =
            typeof customer.invoice_settings?.default_payment_method === "string"
              ? customer.invoice_settings.default_payment_method
              : null;

          if (!defaultPaymentMethod) {
            // Try to get any payment method
            const paymentMethods = await stripe.paymentMethods.list(
              { customer: customerId, type: "card", limit: 1 },
              { stripeAccount: studio.stripe_connect_account_id }
            );

            if (paymentMethods.data.length === 0) {
              throw new Error("No payment method found for customer");
            }

            var pmId = paymentMethods.data[0].id;
          } else {
            var pmId = defaultPaymentMethod;
          }

          // Create off-session PaymentIntent
          const paymentIntent = await stripe.paymentIntents.create(
            {
              amount: totalChargeCents,
              currency: "usd",
              customer: customerId,
              payment_method: pmId,
              off_session: true,
              confirm: true,
              description: `Overage charge — ${monthName} (${tier.name})`,
              metadata: {
                type: "instructor_overage",
                studio_id: studio.id,
                instructor_id: membership.instructor_id,
                overage_charge_id: chargeRecord.id,
                period: periodStart,
              },
            },
            { stripeAccount: studio.stripe_connect_account_id }
          );

          // Update charge record
          await supabase
            .from("instructor_overage_charges")
            .update({
              status: "charged",
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq("id", chargeRecord.id);

          chargedCount++;

          // Send success email to instructor
          if (profile?.email) {
            const fmtH = (m: number) => {
              const h = Math.floor(m / 60);
              const r = m % 60;
              return h > 0 && r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${r}m`;
            };

            const template = tierOverageCharged({
              instructorName: profile.full_name || "Instructor",
              studioName: studio.name,
              month: monthName,
              overageTime: fmtH(overageMinutes),
              rate: `$${(tier.overage_rate_cents / 100).toFixed(2)}`,
              totalCharge: `$${(totalChargeCents / 100).toFixed(2)}`,
            });

            await sendEmail({
              to: profile.email,
              subject: template.subject,
              html: template.html,
              studioId: studio.id,
              templateName: "tierOverageCharged",
            });
          }
        } catch (stripeErr: unknown) {
          const errMsg = stripeErr instanceof Error ? stripeErr.message : "Unknown Stripe error";

          await supabase
            .from("instructor_overage_charges")
            .update({ status: "failed" })
            .eq("id", chargeRecord.id);

          failedCount++;
          await sendChargeFailedEmail(supabase, studio, profile, monthName, totalChargeCents, errMsg);
        }
      }
    }

    await insertCronLog(supabase, {
      job_name: "tier-overage-billing",
      status: failedCount > 0 ? "partial" : "success",
      affected_count: chargedCount,
      details: { charged: chargedCount, failed: failedCount, skipped: skippedCount, period: periodStart },
      started_at: cronStartedAt,
    });

    return NextResponse.json({ ok: true, charged: chargedCount, failed: failedCount, skipped: skippedCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await insertCronLog(supabase, {
      job_name: "tier-overage-billing",
      status: "error",
      affected_count: 0,
      error_message: message,
      started_at: cronStartedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper: send charge-failed email to studio owner
async function sendChargeFailedEmail(
  supabase: AdminSupabaseClient,
  studio: { id: string; name: string },
  instructorProfile: { email: string; full_name: string } | null,
  monthName: string,
  totalChargeCents: number,
  failureReason: string,
) {
  try {
    // Get studio owner
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("studio_id", studio.id)
      .eq("role", "owner")
      .limit(1)
      .single();

    if (!ownerProfile?.email) return;

    const template = tierOverageChargeFailed({
      ownerName: ownerProfile.full_name || "Studio Owner",
      instructorName: instructorProfile?.full_name || "Unknown Instructor",
      month: monthName,
      totalCharge: `$${(totalChargeCents / 100).toFixed(2)}`,
      failureReason,
    });

    await sendEmail({
      to: ownerProfile.email,
      subject: template.subject,
      html: template.html,
      studioId: studio.id,
      templateName: "tierOverageChargeFailed",
    });
  } catch {
    logger.error("Failed to send overage charge-failed email", { studioId: studio.id });
  }
}
