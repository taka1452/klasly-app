import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { eventBookingCancelled } from "@/lib/email/templates";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const stripe = getStripe();

    // Auth check
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Owner/Manager check
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (
      !profile?.studio_id ||
      (profile.role !== "owner" && profile.role !== "manager")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get booking
    const { data: booking } = await supabase
      .from("event_bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Verify event belongs to studio
    const { data: event } = await supabase
      .from("events")
      .select("id, name, studio_id, start_date, end_date, location_name")
      .eq("id", booking.event_id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (booking.booking_status === "cancelled") {
      return NextResponse.json(
        { error: "Booking is already cancelled" },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { refund_amount_cents } = body;
    const refundAmount = Math.max(0, Math.floor(refund_amount_cents ?? 0));

    // Get Stripe account for this studio
    const { data: studio } = await supabase
      .from("studios")
      .select("stripe_connect_account_id, payout_model")
      .eq("id", event.studio_id)
      .single();

    // Process refund if amount > 0
    if (refundAmount > 0 && studio?.stripe_connect_account_id) {
      // Get paid schedules ordered by installment_number DESC (refund newest first)
      const { data: paidSchedules } = await supabase
        .from("event_payment_schedule")
        .select("id, stripe_payment_intent_id, amount_cents, installment_number")
        .eq("event_booking_id", bookingId)
        .eq("status", "paid")
        .order("installment_number", { ascending: false });

      if (paidSchedules && paidSchedules.length > 0) {
        let remainingRefund = refundAmount;

        // Determine stripe account
        let stripeAccountId = studio.stripe_connect_account_id;
        if (studio.payout_model === "instructor_direct" && event.studio_id) {
          const { data: eventFull } = await supabase
            .from("events")
            .select("instructor_id")
            .eq("id", event.id)
            .single();
          if (eventFull?.instructor_id) {
            const { data: instructor } = await supabase
              .from("instructors")
              .select("stripe_account_id, stripe_onboarding_complete")
              .eq("id", eventFull.instructor_id)
              .single();
            if (instructor?.stripe_account_id && instructor.stripe_onboarding_complete) {
              stripeAccountId = instructor.stripe_account_id;
            }
          }
        }

        for (const schedule of paidSchedules) {
          if (remainingRefund <= 0) break;
          if (!schedule.stripe_payment_intent_id) continue;

          const refundForThis = Math.min(remainingRefund, schedule.amount_cents);

          try {
            await stripe.refunds.create(
              {
                payment_intent: schedule.stripe_payment_intent_id,
                amount: refundForThis,
              },
              { stripeAccount: stripeAccountId }
            );

            // Mark schedule as refunded
            await supabase
              .from("event_payment_schedule")
              .update({ status: "refunded" })
              .eq("id", schedule.id);

            remainingRefund -= refundForThis;
          } catch (err) {
            console.error(
              `[EventCancel] Refund failed for schedule ${schedule.id}:`,
              err
            );
          }
        }
      }
    }

    // Cancel all pending installments
    await supabase
      .from("event_payment_schedule")
      .update({ status: "cancelled" })
      .eq("event_booking_id", bookingId)
      .eq("status", "pending");

    // Update booking status
    await supabase
      .from("event_bookings")
      .update({
        booking_status: "cancelled",
        payment_status: refundAmount > 0 ? "refunded" : booking.payment_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    // Send cancellation email
    try {
      const email = eventBookingCancelled({
        guestName: booking.guest_name || "Guest",
        eventName: event.name,
        startDate: event.start_date,
        endDate: event.end_date,
        locationName: event.location_name,
        refundAmountCents: refundAmount,
      });

      await sendEmail({
        to: booking.guest_email,
        subject: email.subject,
        html: email.html,
        studioId: event.studio_id,
        templateName: "event_booking_cancelled",
      });
    } catch (e) {
      console.error("[EventCancel] Failed to send cancellation email:", e);
    }

    return NextResponse.json({ success: true, refunded: refundAmount });
  } catch (err: unknown) {
    console.error("[EventCancel] error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
