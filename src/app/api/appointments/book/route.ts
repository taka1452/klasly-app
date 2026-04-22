import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { getRequiresCredits } from "@/lib/booking-utils";
import { sendEmail } from "@/lib/email/send";
import { appointmentConfirmation } from "@/lib/email/templates";
import { notifyStaffOfInstructorBooking } from "@/lib/email/notify-staff";

/**
 * POST: Book an appointment
 * Body: { instructor_id, appointment_type_id, date, start_time }
 */
export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();

    const { data: profile } = await adminDb
      .from("profiles")
      .select("studio_id, role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Feature flag check
    const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { instructor_id, appointment_type_id, date, start_time } = body;

    if (!instructor_id || !appointment_type_id || !date || !start_time) {
      return NextResponse.json(
        { error: "instructor_id, appointment_type_id, date, and start_time are required" },
        { status: 400 }
      );
    }

    // Get appointment type
    const { data: appointmentType } = await adminDb
      .from("appointment_types")
      .select("id, name, duration_minutes, buffer_minutes, price_cents, studio_id")
      .eq("id", appointment_type_id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!appointmentType) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }

    // Calculate end time
    const startMinutes = timeToMinutes(start_time);
    const endTime = minutesToTime(startMinutes + appointmentType.duration_minutes);

    // Verify instructor belongs to same studio
    const { data: instructor } = await adminDb
      .from("instructors")
      .select("id, studio_id, profile_id")
      .eq("id", instructor_id)
      .single();

    if (!instructor || instructor.studio_id !== profile.studio_id) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    // Get instructor name
    const { data: instructorProfile } = await adminDb
      .from("profiles")
      .select("full_name")
      .eq("id", instructor.profile_id)
      .single();

    // Re-check slot availability (race condition guard)
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const totalBlock = appointmentType.duration_minutes + (appointmentType.buffer_minutes ?? 0);
    const slotEnd = startMinutes + totalBlock;

    // Check instructor availability window
    const { data: availability } = await adminDb
      .from("instructor_availability")
      .select("start_time, end_time")
      .eq("instructor_id", instructor_id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true);

    const inWindow = availability?.some((a) => {
      const aStart = timeToMinutes(a.start_time);
      const aEnd = timeToMinutes(a.end_time);
      return startMinutes >= aStart && (startMinutes + totalBlock) <= aEnd;
    });

    if (!inWindow) {
      return NextResponse.json({ error: "Slot is not within instructor availability" }, { status: 409 });
    }

    // Check conflicts with existing appointments
    const { data: existingAppointments } = await adminDb
      .from("appointments")
      .select("start_time, end_time")
      .eq("instructor_id", instructor_id)
      .eq("appointment_date", date)
      .in("status", ["confirmed"]);

    const appointmentConflict = existingAppointments?.some((apt) => {
      const aptStart = timeToMinutes(apt.start_time);
      const aptEnd = timeToMinutes(apt.end_time);
      return startMinutes < aptEnd && slotEnd > aptStart;
    });

    if (appointmentConflict) {
      return NextResponse.json({ error: "This time slot is no longer available" }, { status: 409 });
    }

    // Check conflicts with class sessions
    const { data: existingSessions } = await adminDb
      .from("class_sessions")
      .select("start_time, end_time")
      .eq("instructor_id", instructor_id)
      .eq("session_date", date)
      .neq("status", "cancelled");

    const sessionConflict = existingSessions?.some((s) => {
      const sStart = timeToMinutes(s.start_time);
      const sEnd = timeToMinutes(s.end_time);
      return startMinutes < sEnd && slotEnd > sStart;
    });

    if (sessionConflict) {
      return NextResponse.json({ error: "This time slot conflicts with a class" }, { status: 409 });
    }

    // Get member_id
    const { data: member } = await adminDb
      .from("members")
      .select("id")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Determine payment method
    const priceCents = appointmentType.price_cents ?? 0;
    let paymentMethod = "free";
    let creditDeducted = false;

    if (priceCents > 0) {
      // Check studio's booking_requires_credits setting
      const { data: studio } = await adminDb
        .from("studios")
        .select("booking_requires_credits, stripe_connect_onboarding_complete")
        .eq("id", profile.studio_id)
        .single();

      const requiresCredits = studio ? getRequiresCredits(studio) : false;

      if (requiresCredits) {
        paymentMethod = "credit";
        // Deduct credits
        const { data: result } = await adminDb.rpc("decrement_member_credits", {
          p_member_id: member.id,
          p_amount: priceCents,
        });

        if (result === -99) {
          return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
        }
        creditDeducted = true;
      } else {
        // Non-credit studio with price > 0: owner collects payment separately
        paymentMethod = "free";
      }
    }

    // Create appointment record
    const { data: appointment, error: insertError } = await adminDb
      .from("appointments")
      .insert({
        studio_id: profile.studio_id,
        appointment_type_id,
        instructor_id,
        member_id: member.id,
        appointment_date: date,
        start_time,
        end_time: endTime,
        status: "confirmed",
        price_cents: priceCents,
        payment_method: paymentMethod,
        credit_deducted: creditDeducted,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Book Appointment] Insert error:", insertError.message);
      // If credit was deducted but insert failed, refund
      if (creditDeducted) {
        await adminDb.rpc("increment_member_credits", {
          p_member_id: member.id,
          p_amount: priceCents,
        });
      }
      return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
    }

    // Get studio name for email
    const { data: studio } = await adminDb
      .from("studios")
      .select("name")
      .eq("id", profile.studio_id)
      .single();

    // Send confirmation email (only if user has an email)
    if (user.email) {
      const email = appointmentConfirmation({
        memberName: profile.full_name || "Member",
        instructorName: instructorProfile?.full_name || "Instructor",
        appointmentType: appointmentType.name,
        date,
        startTime: start_time,
        studioName: studio?.name || "Studio",
      });

      await sendEmail({
        to: user.email,
        subject: email.subject,
        html: email.html,
        studioId: profile.studio_id,
        templateName: "appointment_confirmation",
      });
    }

    // Notify owner + managers that the instructor received a private booking
    await notifyStaffOfInstructorBooking({
      studioId: profile.studio_id,
      instructorName: instructorProfile?.full_name || "An instructor",
      activity: `received a private appointment from ${profile.full_name || "a member"}`,
      title: appointmentType.name,
      date,
      startTime: start_time,
      endTime,
      linkPath: "/appointments",
    });

    return NextResponse.json({ appointment });
  } catch (err) {
    console.error("[Book Appointment] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
