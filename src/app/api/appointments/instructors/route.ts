import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET /api/appointments/instructors
 * Returns instructors who have at least one active availability slot.
 * Auth: any authenticated member of the studio.
 */
export async function GET() {
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
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    // Get instructors who have at least one active availability slot
    const { data: availabilityRows } = await adminDb
      .from("instructor_availability")
      .select("instructor_id")
      .eq("is_active", true);

    if (!availabilityRows || availabilityRows.length === 0) {
      return NextResponse.json({ instructors: [] });
    }

    const instructorIdsWithAvailability = Array.from(
      new Set(availabilityRows.map((r) => r.instructor_id))
    );

    // Get instructors in this studio who have availability
    const { data: instructors } = await adminDb
      .from("instructors")
      .select("id, profile_id, bio, specialties")
      .eq("studio_id", profile.studio_id)
      .in("id", instructorIdsWithAvailability);

    if (!instructors || instructors.length === 0) {
      return NextResponse.json({ instructors: [] });
    }

    // Get profile info for each instructor
    const profileIds = instructors.map((i) => i.profile_id);
    const { data: profiles } = await adminDb
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", profileIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

    const result = instructors.map((inst) => {
      const p = profileMap.get(inst.profile_id);
      return {
        id: inst.id,
        name: p?.full_name ?? "Instructor",
        avatar_url: p?.avatar_url ?? null,
        bio: inst.bio ?? null,
        specialties: inst.specialties ?? null,
      };
    });

    return NextResponse.json({ instructors: result });
  } catch (err) {
    console.error("[Appointments Instructors GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
