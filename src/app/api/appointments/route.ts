import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET: List appointments with filters
 * Query params: instructor_id, member_id, date_from, date_to, status
 * Auth scoping: member sees own, instructor sees own, owner sees all
 */
export async function GET(request: Request) {
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
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get("instructor_id");
    const memberId = searchParams.get("member_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const status = searchParams.get("status");

    let query = adminDb
      .from("appointments")
      .select(
        "id, studio_id, appointment_type_id, instructor_id, member_id, appointment_date, start_time, end_time, status, notes, price_cents, payment_method, credit_deducted, cancelled_at, cancellation_reason, created_at, appointment_types(id, name, duration_minutes), instructors(id, profile_id, profiles(full_name)), members(id, profile_id, profiles(full_name))"
      )
      .eq("studio_id", profile.studio_id)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false });

    // Role-based scoping
    if (profile.role === "member") {
      const { data: member } = await adminDb
        .from("members")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();

      if (!member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }
      query = query.eq("member_id", member.id);
    } else if (profile.role === "instructor") {
      const { data: instructor } = await adminDb
        .from("instructors")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();

      if (!instructor) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
      }
      query = query.eq("instructor_id", instructor.id);
    }
    // owner sees all in studio

    // Apply optional filters
    if (instructorId && profile.role === "owner") {
      query = query.eq("instructor_id", instructorId);
    }
    if (memberId && (profile.role === "owner" || profile.role === "instructor")) {
      query = query.eq("member_id", memberId);
    }
    if (dateFrom) {
      query = query.gte("appointment_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("appointment_date", dateTo);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Appointments GET]", error.message);
      return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }

    return NextResponse.json({ appointments: data ?? [] });
  } catch (err) {
    console.error("[Appointments GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
