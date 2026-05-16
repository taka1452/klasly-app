import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import {
  installmentPaymentFailed,
  ownerInstallmentFailedNotification,
  eventPaymentCompleted,
} from "@/lib/email/templates";
import { createAdminClient } from "@/lib/admin/supabase";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const cronStartedAt = new Date().toISOString();
  let cronLogId: string | null = null;
  try {
    const adminDb = createAdminClient();
    const { data: logRow } = await adminDb
      .from("cron_logs")
      .insert({
        job_name: "event-installments",
        status: "success",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // log failure is non-blocking
  }

  let processed = 0;
  let failed = 0;

  try {
    const stripe = getStripe();
    const today = new Date().toISOString().slice(0, 10);

    // Get all pending installments with related data in a single join query
    const { data: dueInstallments } = await supabase
      .from("event_payment_schedule")
      .select(`
        id, event_booking_id, installment_number, amount_cents, stripe_payment_method_id, due_date,
        event_bookings(
          id, event_id, guest_name, guest_email, total_amount_cents,
          events(
            id, name, studio_id, instructor_id, start_date, end_date, location_name,
            studios(id, name, payout_model, studio_fee_percentage, stripe_connect_account_id, currency)
          )
        )
      `)
      .eq("status", "pending")
      .lte("due_date", today)
      .order("due_date");

    if (!dueInstallments || dueInstallments.length === 0) {
      await updateCronLog(cronLogId, "success", 0);
      return NextResponse.json({ processed: 0, failed: 0 });
    }

    // Fetch platform fee once (shared across all installments)
    const { data: feeRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = parseFloat(feeRow?.value ?? "0") / 100;

    // Batch fetch instructors for collective-mode events
    const instructorIds = Array.from(
      new Set<string>(
        dueInstallments
          .map((i) => (i.event_bookings as any)?.events?.instructor_id)
          .filter(Boolean),
      ),
    );
    const instructorMap = new Map<string, { stripe_account_id: string | null; stripe_onboarding_complete: boolean }>();
    if (instructorIds.length > 0) {
      const { data: instructors } = await supabase
        .from("instructors")
        .select("id, stripe_account_id, stripe_onboarding_complete")
        .in("id", instructorIds);
      for (const inst of instructors ?? []) {
        instructorMap.set(inst.id, inst);
      }
    }

    for (const installment of dueInstallments) {
      if (installment.installment_number === 1) continue;

      if (!installment.stripe_payment_method_id) {
        console.error(
          `[EventInstallments] No payment method for schedule ${installment.id}`,
        );
        failed++;
        continue;
      }

      try {
        const booking = installment.event_bookings as any;
        if (!booking) continue;
        const event = booking.events;
        if (!event) continue;
        const studio = event.studios;
        if (!studio?.stripe_connect_account_id) continue;

        let stripeAccountId = studio.stripe_connect_account_id;
        const platformFee =
          platformFeePercent > 0
            ? Math.round(installment.amount_cents * platformFeePercent)
            : 0;
        let applicationFee = platformFee;

        if (
          studio.payout_model === "instructor_direct" &&
          event.instructor_id
        ) {
          const instructor = instructorMap.get(event.instructor_id);
          if (
            instructor?.stripe_account_id &&
            instructor.stripe_onboarding_complete
          ) {
            stripeAccountId = instructor.stripe_account_id;
            const studioFee = Math.round(
              installment.amount_cents *
                (Number(studio.studio_fee_percentage) / 100),
            );
            applicationFee = platformFee + studioFee;
          }
        }

        const pi = await stripe.paymentIntents.create(
          {
            amount: installment.amount_cents,
            currency: (studio.currency ?? "usd").toLowerCase(),
            payment_method: installment.stripe_payment_method_id,
            off_session: true,
            confirm: true,
            ...(applicationFee > 0
              ? { application_fee_amount: applicationFee }
              : {}),
            metadata: {
              type: "event_installment",
              event_booking_id: booking.id,
              installment_number: String(installment.installment_number),
              studio_id: event.studio_id,
            },
          },
          { stripeAccount: stripeAccountId },
        );

        if (pi.status === "succeeded") {
          // Mark as paid
          await supabase
            .from("event_payment_schedule")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: pi.id,
            })
            .eq("id", installment.id);

          // Check if all installments are paid
          const { data: allSchedules } = await supabase
            .from("event_payment_schedule")
            .select("status")
            .eq("event_booking_id", booking.id);

          const allPaid = (allSchedules ?? []).every(
            (s) => s.status === "paid",
          );
          if (allPaid) {
            await supabase
              .from("event_bookings")
              .update({
                payment_status: "fully_paid",
                updated_at: new Date().toISOString(),
              })
              .eq("id", booking.id);

            // Send payment completed email
            try {
              const completedMail = eventPaymentCompleted({
                guestName: booking.guest_name || "Guest",
                eventName: event.name,
                startDate: event.start_date,
                endDate: event.end_date,
                locationName: event.location_name,
                totalAmountCents: booking.total_amount_cents,
              });

              if (booking.guest_email) {
                await sendEmail({
                  to: booking.guest_email,
                  subject: completedMail.subject,
                  html: completedMail.html,
                  studioId: event.studio_id,
                  templateName: "event_payment_completed",
                });
              }
            } catch (emailErr) {
              console.error("[EventInstallments] Failed to send completion email:", emailErr);
            }
          }

          processed++;
        } else {
          throw new Error(`PaymentIntent status: ${pi.status}`);
        }
      } catch (err) {
        console.error(
          `[EventInstallments] Failed for schedule ${installment.id}:`,
          err,
        );

        // Mark as failed
        await supabase
          .from("event_payment_schedule")
          .update({ status: "failed" })
          .eq("id", installment.id);

        // Count consecutive failures
        const { count: failCount } = await supabase
          .from("event_payment_schedule")
          .select("id", { count: "exact", head: true })
          .eq("event_booking_id", installment.event_booking_id)
          .eq("status", "failed");

        const totalFails = failCount ?? 1;

        // Reuse already-fetched booking/event data from the join query
        const errBooking = installment.event_bookings as any;
        const errEvent = errBooking?.events;

        if (totalFails < 3) {
          await supabase
            .from("event_payment_schedule")
            .update({ status: "pending" })
            .eq("id", installment.id);
        }

        if (totalFails >= 3 && errBooking && errEvent) {
          const studioId = errEvent.studio_id;
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("id, email")
            .eq("studio_id", studioId)
            .eq("role", "owner")
            .limit(1)
            .single();

          const emailPromises: Promise<unknown>[] = [];

          if (ownerProfile?.email) {
            const ownerEmail = ownerInstallmentFailedNotification({
              ownerName: "Studio Owner",
              guestName: errBooking.guest_name || "Guest",
              guestEmail: errBooking.guest_email,
              eventName: errEvent.name,
              amount: installment.amount_cents,
              failCount: totalFails,
            });
            emailPromises.push(
              sendEmail({
                to: ownerProfile.email,
                subject: ownerEmail.subject,
                html: ownerEmail.html,
                studioId,
                templateName: "owner_installment_failed",
              }),
            );
          }

          if (errBooking.guest_email) {
            const guestMail = installmentPaymentFailed({
              guestName: errBooking.guest_name || "Guest",
              eventName: errEvent.name,
              amount: installment.amount_cents,
            });
            emailPromises.push(
              sendEmail({
                to: errBooking.guest_email,
                subject: guestMail.subject,
                html: guestMail.html,
                studioId,
                templateName: "installment_payment_failed",
              }),
            );
          }

          await Promise.allSettled(emailPromises);
        }

        failed++;
      }
    }

    await updateCronLog(cronLogId, "success", processed);
    return NextResponse.json({ processed, failed });
  } catch (err) {
    console.error("[EventInstallments] Fatal error:", err);
    await updateCronLog(cronLogId, "error", processed);
    return NextResponse.json(
      { error: "Internal error", processed, failed },
      { status: 500 },
    );
  }
}

async function updateCronLog(
  cronLogId: string | null,
  status: string,
  affected: number,
) {
  if (!cronLogId) return;
  try {
    const adminDb = createAdminClient();
    await adminDb
      .from("cron_logs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        affected_count: affected,
      })
      .eq("id", cronLogId);
  } catch {
    // non-blocking
  }
}
