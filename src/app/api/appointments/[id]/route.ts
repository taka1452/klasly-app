import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { sendEmail } from "@/lib/email/send";
import { appointmentCancelled } from "@/lib/email/templates";

type RouteParams = { params: Promise<{ id: string }> };

async function getAuthContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const adminDb = createAdminClient();

  const { data: profile } = await adminDb
    .from("profiles")
    .select("studio_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return null;

  const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
  if (!enabled) return null;

  return { adminDb, profile, userId: user.id };
}

/**
 * PUT: Update appointment notes
 * Body: { notes: string }
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { adminDb, profile, userId } = ctx;
    const body = await request.json();

    // Get the appointment
    const { data: appointment } = await adminDb
      .from("appointments")
      .select("id, studio_id, instructor_id, member_id")
      .eq("id", id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Check authorization: owner can update any, instructor their own, member their own
    if (profile.role === "member") {
      const { data: member } = await adminDb
        .from("members")
        .select("id")
        .eq("profile_id", userId)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!member || member.id !== appointment.member_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else if (profile.role === "instructor") {
      const { data: instructor } = await adminDb
        .from("instructors")
        .select("id")
        .eq("profile_id", userId)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!instructor || instructor.id !== appointment.instructor_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    // owner can update any appointment in their studio

    const { data: updated, error } = await adminDb
      .from("appointments")
      .update({ notes: body.notes })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Appointment PUT] Update error:", error.message);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    console.error("[Appointment PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE: Cancel appointment
 * - Set status = "cancelled", cancelled_at = now
 * - If credit_deducted → increment_member_credits
 * - Send cancellation email
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { adminDb, profile, userId } = ctx;

    // Parse optional cancellation reason from body
    let cancellationReason: string | null = null;
    try {
      const body = await request.json();
      cancellationReason = body.cancellation_reason ?? null;
    } catch {
      // No body is fine
    }

    // Get the appointment with related data
    const { data: appointment } = await adminDb
      .from("appointments")
      .select(
        "id, studio_id, instructor_id, member_id, appointment_date, start_time, end_time, status, price_cents, credit_deducted, appointment_type_id"
      )
      .eq("id", id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (appointment.status === "cancelled") {
      return NextResponse.json({ error: "Appointment is already cancelled" }, { status: 400 });
    }

    // Check authorization
    let cancelledBy = "studio";
    if (profile.role === "member") {
      const { data: member } = await adminDb
        .from("members")
        .select("id")
        .eq("profile_id", userId)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!member || member.id !== appointment.member_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      cancelledBy = "member";
    } else if (profile.role === "instructor") {
      const { data: instructor } = await adminDb
        .from("instructors")
        .select("id")
        .eq("profile_id", userId)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!instructor || instructor.id !== appointment.instructor_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      cancelledBy = "instructor";
    }

    // Refund credits if they were deducted
    if (appointment.credit_deducted && appointment.price_cents > 0) {
      await adminDb.rpc("increment_member_credits", {
        p_member_id: appointment.member_id,
        p_amount: appointment.price_cents,
      });
    }

    // Update appointment status
    const { data: cancelled, error: updateError } = await adminDb
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[Appointment DELETE] Update error:", updateError.message);
      return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
    }

    // Get data for cancellation email
    const { data: memberData } = await adminDb
      .from("members")
      .select("profile_id")
      .eq("id", appointment.member_id)
      .single();

    const { data: memberProfile } = memberData
      ? await adminDb
          .from("profiles")
          .select("full_name")
          .eq("id", memberData.profile_id)
          .single()
      : { data: null };

    const { data: instructorData } = await adminDb
      .from("instructors")
      .select("profile_id")
      .eq("id", appointment.instructor_id)
      .single();

    const { data: instructorProfile } = instructorData
      ? await adminDb
          .from("profiles")
          .select("full_name")
          .eq("id", instructorData.profile_id)
          .single()
      : { data: null };

    const { data: appointmentType } = await adminDb
      .from("appointment_types")
      .select("name")
      .eq("id", appointment.appointment_type_id)
      .single();

    const { data: studio } = await adminDb
      .from("studios")
      .select("name")
      .eq("id", profile.studio_id)
      .single();

    // Get member email
    const memberEmail = memberData
      ? (
          await adminDb.auth.admin.getUserById(memberData.profile_id)
        ).data?.user?.email
      : null;

    if (memberEmail) {
      const email = appointmentCancelled({
        memberName: memberProfile?.full_name || "Member",
        instructorName: instructorProfile?.full_name || "Instructor",
        appointmentType: appointmentType?.name || "Appointment",
        date: appointment.appointment_date,
        startTime: appointment.start_time,
        studioName: studio?.name || "Studio",
        cancelledBy,
      });

      await sendEmail({
        to: memberEmail,
        subject: email.subject,
        html: email.html,
        studioId: profile.studio_id,
        templateName: "appointment_cancelled",
      });
    }

    return NextResponse.json({ appointment: cancelled });
  } catch (err) {
    console.error("[Appointment DELETE] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
