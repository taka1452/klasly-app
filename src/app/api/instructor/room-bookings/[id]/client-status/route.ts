import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_STATUSES = new Set([null, "no_show", "late_cancel"]);

/**
 * POST /api/instructor/room-bookings/[id]/client-status
 * Body: { status: 'no_show' | 'late_cancel' | null }
 *
 * Mark a room booking's linked client as no-show or late cancel.
 * Mirrors /api/attendance/status for class-session bookings.
 */
async function getActor() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase: SupabaseClient = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;
  if (!["owner", "manager", "instructor"].includes(profile.role)) return null;

  const { data: instructorRow } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    studioId: profile.studio_id,
    role: profile.role as "owner" | "manager" | "instructor",
    ownInstructorId: instructorRow?.id ?? null,
  };
}

async function canAct(
  actor: NonNullable<Awaited<ReturnType<typeof getActor>>>,
  booking: { instructor_id: string; studio_id: string }
): Promise<boolean> {
  if (booking.studio_id !== actor.studioId) return false;
  if (actor.ownInstructorId && booking.instructor_id === actor.ownInstructorId) {
    return true;
  }
  if (actor.role === "owner") return true;
  if (actor.role === "manager") {
    const { data: mgr } = await actor.supabase
      .from("managers")
      .select("can_manage_rooms")
      .eq("profile_id", actor.userId)
      .eq("studio_id", actor.studioId)
      .maybeSingle();
    return mgr?.can_manage_rooms === true;
  }
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const status = body.status as string | null | undefined;
    const normalized = status ?? null;
    if (!VALID_STATUSES.has(normalized)) {
      return NextResponse.json(
        { error: "Invalid status. Must be no_show, late_cancel or null." },
        { status: 400 }
      );
    }

    const { data: booking } = await actor.supabase
      .from("class_sessions")
      .select("id, instructor_id, studio_id, session_type, client_member_id")
      .eq("id", id)
      .single();
    if (!booking || booking.session_type !== "room_only") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await canAct(actor, booking))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!booking.client_member_id) {
      return NextResponse.json(
        { error: "This booking has no linked client." },
        { status: 400 }
      );
    }

    const { error } = await actor.supabase
      .from("class_sessions")
      .update({ client_attendance_status: normalized })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client_attendance_status: normalized,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
