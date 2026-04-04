import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { booking_id, attended } = body;

    if (!booking_id || typeof attended !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: booking_id, attended" },
        { status: 400 },
      );
    }

    // ── Path 1: Owner / Manager with can_manage_bookings ──
    const ctx = await getDashboardContext();
    if (ctx) {
      if (ctx.role === "manager" && !ctx.permissions?.can_manage_bookings) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const adminSupabase = ctx.supabase;

      const { data: booking } = await adminSupabase
        .from("bookings")
        .select("id, studio_id")
        .eq("id", booking_id)
        .single();

      if (!booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      if (booking.studio_id !== ctx.studioId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { error } = await adminSupabase
        .from("bookings")
        .update({ attended })
        .eq("id", booking_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, attended });
    }

    // ── Path 2: Instructor (own sessions only) ──
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = instrCtx.supabase;

    // Fetch the booking with its session_id
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, session_id, studio_id")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.studio_id !== instrCtx.studioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the session belongs to this instructor
    const { data: session } = await supabase
      .from("class_sessions")
      .select("instructor_id")
      .eq("id", booking.session_id)
      .single();

    if (!session || session.instructor_id !== instrCtx.instructorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("bookings")
      .update({ attended })
      .eq("id", booking_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, attended });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
