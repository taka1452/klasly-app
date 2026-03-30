import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST: Mark appointment as completed
 * Auth: instructor who owns the appointment OR owner/manager
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();
    const { id } = await params;

    const { data: profile } = await adminDb
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(
      profile.studio_id,
      FEATURE_KEYS.APPOINTMENTS
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    // Get the appointment
    const { data: appointment } = await adminDb
      .from("appointments")
      .select("id, studio_id, instructor_id, status")
      .eq("id", id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (appointment.status !== "confirmed") {
      return NextResponse.json(
        { error: "Only confirmed appointments can be completed" },
        { status: 400 }
      );
    }

    // Check authorization: instructor who owns it, or owner/manager
    if (profile.role === "instructor") {
      const { data: instructor } = await adminDb
        .from("instructors")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();

      if (!instructor || instructor.id !== appointment.instructor_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else if (profile.role === "member") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    // owner and manager can complete any appointment in their studio

    const { data: updated, error: updateError } = await adminDb
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[Appointment Complete]", updateError.message);
      return NextResponse.json(
        { error: "Failed to complete appointment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    console.error("[Appointment Complete] Unexpected:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
