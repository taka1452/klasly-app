import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";

export async function POST(request: Request) {
  try {
    // Owner または can_manage_bookings 権限を持つ Manager
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (ctx.role === "manager" && !ctx.permissions?.can_manage_bookings) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = ctx.supabase;

    const body = await request.json();
    const { booking_id, attended } = body;

    if (!booking_id || typeof attended !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: booking_id, attended" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, attended });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
