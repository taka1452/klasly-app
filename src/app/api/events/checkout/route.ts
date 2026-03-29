import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { eventBookingConfirmation } from "@/lib/email/templates";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    );

    // Auth check (optional — guests can checkout too)
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    const body = await request.json();
    const {
      event_id,
      event_option_id,
      guest_name,
      guest_email,
      guest_phone,
      payment_choice, // 'full' | 'installment'
      application_responses,
      group_size: rawGroupSize,
      group_members: rawGroupMembers,
    } = body;

    const groupSize = Math.max(1, parseInt(rawGroupSize || "1", 10));
    const groupMembers = Array.isArray(rawGroupMembers) ? rawGroupMembers : [];

    if (!event_id || !event_option_id || !guest_email || !guest_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 1. Fetch event
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .eq("status", "published")
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found or not published" },
        { status: 404 },
      );
    }

    // Feature flag check
    const retreatEnabled = await isFeatureEnabled(event.studio_id, FEATURE_KEYS.RETREAT_BOOKING);
    if (!retreatEnabled) {
      return NextResponse.json({ error: "Feature not available" }, { status: 404 });
    }

    // 2. Fetch option
    const { data: option } = await adminSupabase
      .from("event_options")
      .select("*")
      .eq("id", event_option_id)
      .eq("event_id", event_id)
      .eq("is_active", true)
      .single();

    if (!option) {
      return NextResponse.json(
        { error: "Option not found" },
        { status: 404 },
      );
    }

    // 3. Capacity check (accounting for group_size)
    const { data: existingBookings } = await adminSupabase
      .from("event_bookings")
      .select("group_size")
      .eq("event_option_id", event_option_id)
      .in("booking_status", ["pending_payment", "confirmed", "completed"]);

    const totalBooked = (existingBookings || []).reduce(
      (sum, b) => sum + (b.group_size || 1), 0
    );
    const remaining = option.capacity - totalBooked;
    const isWaitlist = remaining < groupSize;

    // If sold out and waitlist not enabled, reject
    if (isWaitlist && !event.waitlist_enabled) {
      return NextResponse.json(
        { error: remaining <= 0 ? "This option is sold out" : `Only ${remaining} spots left` },
        { status: 409 },
      );
    }

    // 4. Get studio + determine Stripe destination
    const { data: studio } = await adminSupabase
      .from("studios")
      .select(
        "id, name, payout_model, studio_fee_percentage, studio_fee_type, stripe_connect_account_id, stripe_connect_onboarding_complete, currency",
      )
      .eq("id", event.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json(
        { error: "Studio not found" },
        { status: 404 },
      );
    }

    // Get platform fee
    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = parseFloat(feeRow?.value ?? "0") / 100;

    // Determine unit price (early bird or regular)
    const now = new Date();
    const hasEarlyBird = option.early_bird_price_cents != null
      && option.early_bird_deadline
      && new Date(option.early_bird_deadline) > now;
    const unitPriceCents = hasEarlyBird ? option.early_bird_price_cents : option.price_cents;
    const totalAmountCents = unitPriceCents * groupSize;

    const platformFee =
      platformFeePercent > 0
        ? Math.round(totalAmountCents * platformFeePercent)
        : 0;

    // Determine destination account (Collective Mode support)
    let stripeAccountId: string | null = null;
    let applicationFee = platformFee;

    if (
      studio.payout_model === "instructor_direct" &&
      event.instructor_id
    ) {
      const { data: instructor } = await adminSupabase
        .from("instructors")
        .select("id, stripe_account_id, stripe_onboarding_complete")
        .eq("id", event.instructor_id)
        .single();

      if (
        instructor?.stripe_account_id &&
        instructor.stripe_onboarding_complete
      ) {
        stripeAccountId = instructor.stripe_account_id;

        // Calculate studio fee
        const studioFeePercent = Number(studio.studio_fee_percentage) / 100;
        const studioFee = Math.round(totalAmountCents * studioFeePercent);
        applicationFee = platformFee + studioFee;
      }
    }

    if (!stripeAccountId) {
      if (
        !studio.stripe_connect_account_id ||
        !studio.stripe_connect_onboarding_complete
      ) {
        return NextResponse.json(
          { error: "This studio has not set up payments yet." },
          { status: 400 },
        );
      }
      stripeAccountId = studio.stripe_connect_account_id;
    }

    // 5. Determine member_id if logged in
    let memberId: string | null = null;
    if (user) {
      const { data: member } = await adminSupabase
        .from("members")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", event.studio_id)
        .maybeSingle();
      memberId = member?.id ?? null;
    }

    // 6. Create booking record
    const effectivePaymentType =
      event.payment_type === "installment" && payment_choice === "installment"
        ? "installment"
        : "full";

    // --- WAITLIST PATH: no payment needed ---
    if (isWaitlist) {
      const { data: wlBooking, error: wlError } = await adminSupabase
        .from("event_bookings")
        .insert({
          event_id,
          event_option_id,
          member_id: memberId,
          guest_name,
          guest_email,
          guest_phone: guest_phone || null,
          booking_status: "waitlisted",
          total_amount_cents: totalAmountCents,
          payment_type: effectivePaymentType,
          payment_status: "unpaid",
          group_size: groupSize,
          group_members: groupMembers,
          ...(application_responses ? { application_responses } : {}),
        })
        .select("id")
        .single();

      if (wlError || !wlBooking) {
        console.error("[EventCheckout] waitlist insert error:", wlError);
        return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
      }

      // Send waitlist confirmation email
      try {
        const { eventWaitlistConfirmation } = await import("@/lib/email/templates");
        await sendEmail({
          to: guest_email,
          subject: `Waitlist Confirmed — ${event.name}`,
          html: eventWaitlistConfirmation({
            guestName: guest_name,
            eventName: event.name,
            optionName: option.name,
            startDate: event.start_date,
            endDate: event.end_date,
          }),
        });
      } catch (emailErr) {
        console.error("[EventCheckout] waitlist email error:", emailErr);
      }

      const origin =
        request.headers.get("origin") ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://app.klasly.app";

      return NextResponse.json({
        url: `${origin}/events/${event_id}/checkout/success?booking_id=${wlBooking.id}`,
        booking_id: wlBooking.id,
        waitlisted: true,
      });
    }

    // --- NORMAL PAYMENT PATH ---
    const { data: booking, error: bookingError } = await adminSupabase
      .from("event_bookings")
      .insert({
        event_id,
        event_option_id,
        member_id: memberId,
        guest_name,
        guest_email,
        guest_phone: guest_phone || null,
        booking_status: "pending_payment",
        total_amount_cents: totalAmountCents,
        payment_type: effectivePaymentType,
        payment_status: "unpaid",
        group_size: groupSize,
        group_members: groupMembers,
        ...(application_responses ? { application_responses } : {}),
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("[EventCheckout] booking insert error:", bookingError);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 },
      );
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://app.klasly.app";

    // stripeAccountId is guaranteed non-null here (otherwise we returned early)
    const destinationAccount = stripeAccountId as string;

    // 7. Create payment schedule + Stripe session
    if (effectivePaymentType === "installment") {
      // --- INSTALLMENT ---
      const installmentCount = event.installment_count || 3;
      const baseAmount = Math.floor(totalAmountCents / installmentCount);
      const remainder = totalAmountCents - baseAmount * installmentCount;

      const scheduleRows = [];
      for (let i = 1; i <= installmentCount; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (i - 1) * 30);
        scheduleRows.push({
          event_booking_id: booking.id,
          installment_number: i,
          amount_cents: i === 1 ? baseAmount + remainder : baseAmount,
          due_date: dueDate.toISOString().slice(0, 10),
          status: "pending",
        });
      }

      await adminSupabase.from("event_payment_schedule").insert(scheduleRows);

      const firstAmount = scheduleRows[0].amount_cents;
      const firstAppFee =
        applicationFee > 0
          ? Math.round(
              applicationFee * (firstAmount / totalAmountCents),
            )
          : 0;

      // Create Checkout Session for first installment with card saving
      const checkoutSession = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: (studio.currency ?? "usd").toLowerCase(),
                product_data: {
                  name: `${event.name} — ${option.name}${groupSize > 1 ? ` × ${groupSize}` : ""} (Installment 1/${installmentCount})`,
                },
                unit_amount: firstAmount,
              },
              quantity: 1,
            },
          ],
          payment_intent_data: {
            setup_future_usage: "off_session",
            ...(firstAppFee > 0
              ? { application_fee_amount: firstAppFee }
              : {}),
          },
          success_url: `${origin}/events/${event_id}/checkout/success?booking_id=${booking.id}`,
          cancel_url: `${origin}/events/${event_id}/checkout?option=${event_option_id}`,
          customer_email: guest_email,
          metadata: {
            type: "event_booking",
            event_id,
            event_booking_id: booking.id,
            payment_type: "installment",
            installment_number: "1",
            studio_id: event.studio_id,
          },
        },
        { stripeAccount: destinationAccount },
      );

      return NextResponse.json({
        url: checkoutSession.url,
        booking_id: booking.id,
      });
    } else {
      // --- FULL PAYMENT ---
      await adminSupabase.from("event_payment_schedule").insert({
        event_booking_id: booking.id,
        installment_number: 1,
        amount_cents: totalAmountCents,
        due_date: new Date().toISOString().slice(0, 10),
        status: "pending",
      });

      const checkoutSession = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: (studio.currency ?? "usd").toLowerCase(),
                product_data: {
                  name: `${event.name} — ${option.name}${groupSize > 1 ? ` × ${groupSize}` : ""}`,
                },
                unit_amount: totalAmountCents,
              },
              quantity: 1,
            },
          ],
          payment_intent_data:
            applicationFee > 0
              ? { application_fee_amount: applicationFee }
              : undefined,
          success_url: `${origin}/events/${event_id}/checkout/success?booking_id=${booking.id}`,
          cancel_url: `${origin}/events/${event_id}/checkout?option=${event_option_id}`,
          customer_email: guest_email,
          metadata: {
            type: "event_booking",
            event_id,
            event_booking_id: booking.id,
            payment_type: "full",
            studio_id: event.studio_id,
          },
        },
        { stripeAccount: destinationAccount },
      );

      return NextResponse.json({
        url: checkoutSession.url,
        booking_id: booking.id,
      });
    }
  } catch (err: unknown) {
    console.error("[EventCheckout] error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
