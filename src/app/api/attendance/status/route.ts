import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";

const VALID_STATUSES = new Set([null, "no_show", "late_cancel"]);

/**
 * POST /api/attendance/status
 * Body: { booking_id: string, status: 'no_show' | 'late_cancel' | null }
 *
 * Sarah Haroldsen feedback (2026-05): mark a booked member as no-show or late
 * cancel directly from the session attendance page. Setting a status also
 * clears `attended` (a no-show/late-cancel did not attend). Setting back to
 * null clears the flag without touching the attended toggle further.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { booking_id, status } = body as {
      booking_id?: string;
      status?: string | null;
    };

    if (!booking_id) {
      return NextResponse.json(
        { error: "Missing booking_id" },
        { status: 400 },
      );
    }
    if (!VALID_STATUSES.has(status === undefined ? null : status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be no_show, late_cancel or null." },
        { status: 400 },
      );
    }
    const normalized = status ?? null;
    const update: Record<string, unknown> = { attendance_status: normalized };
    if (normalized !== null) {
      update.attended = false;
    }

    const ctx = await getDashboardContext();
    if (ctx) {
      if (ctx.role === "manager" && !ctx.permissions?.can_manage_bookings) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: booking } = await ctx.supabase
        .from("bookings")
        .select("id, studio_id")
        .eq("id", booking_id)
        .single();
      if (!booking || booking.studio_id !== ctx.studioId) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      const { error } = await ctx.supabase
        .from("bookings")
        .update(update)
        .eq("id", booking_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, attendance_status: normalized });
    }

    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data: booking } = await instrCtx.supabase
      .from("bookings")
      .select("id, session_id, studio_id")
      .eq("id", booking_id)
      .single();
    if (!booking || booking.studio_id !== instrCtx.studioId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const { data: session } = await instrCtx.supabase
      .from("class_sessions")
      .select("instructor_id")
      .eq("id", booking.session_id)
      .single();
    if (!session || session.instructor_id !== instrCtx.instructorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { error } = await instrCtx.supabase
      .from("bookings")
      .update(update)
      .eq("id", booking_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, attendance_status: normalized });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
