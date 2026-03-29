import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

async function getInstructorContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const adminDb = createAdminClient();

  const { data: profile } = await adminDb
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return null;

  const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
  if (!enabled) return null;

  // Must be an instructor
  if (profile.role !== "instructor" && profile.role !== "owner") return null;

  const { data: instructor } = await adminDb
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("studio_id", profile.studio_id)
    .single();

  if (!instructor) return null;

  return { adminDb, instructorId: instructor.id, studioId: profile.studio_id, userId: user.id };
}

/**
 * GET: Return availability slots for the authenticated instructor
 */
export async function GET() {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { adminDb, instructorId } = ctx;

    const { data, error } = await adminDb
      .from("instructor_availability")
      .select("id, instructor_id, day_of_week, start_time, end_time, is_active")
      .eq("instructor_id", instructorId)
      .order("day_of_week")
      .order("start_time");

    if (error) {
      console.error("[Availability GET]", error.message);
      return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });
    }

    return NextResponse.json({ availability: data ?? [] });
  } catch (err) {
    console.error("[Availability GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT: Bulk update availability (delete old, insert new)
 * Body: { slots: Array<{ day_of_week: number, start_time: string, end_time: string, is_active?: boolean }> }
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { adminDb, instructorId } = ctx;
    const body = await request.json();
    const slots: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active?: boolean;
    }> = body.slots;

    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: "slots must be an array" }, { status: 400 });
    }

    // Validate each slot
    for (const slot of slots) {
      if (
        typeof slot.day_of_week !== "number" ||
        slot.day_of_week < 0 ||
        slot.day_of_week > 6
      ) {
        return NextResponse.json(
          { error: "day_of_week must be 0-6" },
          { status: 400 }
        );
      }
      if (!slot.start_time || !slot.end_time) {
        return NextResponse.json(
          { error: "start_time and end_time are required" },
          { status: 400 }
        );
      }
      if (slot.start_time >= slot.end_time) {
        return NextResponse.json(
          { error: "start_time must be before end_time" },
          { status: 400 }
        );
      }
    }

    // Delete existing availability
    const { error: deleteError } = await adminDb
      .from("instructor_availability")
      .delete()
      .eq("instructor_id", instructorId);

    if (deleteError) {
      console.error("[Availability PUT] Delete error:", deleteError.message);
      return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
    }

    // Insert new slots
    if (slots.length > 0) {
      const rows = slots.map((s) => ({
        instructor_id: instructorId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active !== false,
      }));

      const { error: insertError } = await adminDb
        .from("instructor_availability")
        .insert(rows);

      if (insertError) {
        console.error("[Availability PUT] Insert error:", insertError.message);
        return NextResponse.json({ error: "Failed to save availability" }, { status: 500 });
      }
    }

    // Return the updated availability
    const { data } = await adminDb
      .from("instructor_availability")
      .select("id, instructor_id, day_of_week, start_time, end_time, is_active")
      .eq("instructor_id", instructorId)
      .order("day_of_week")
      .order("start_time");

    return NextResponse.json({ availability: data ?? [] });
  } catch (err) {
    console.error("[Availability PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
