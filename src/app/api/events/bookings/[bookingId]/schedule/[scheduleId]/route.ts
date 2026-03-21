import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookingId: string; scheduleId: string }> },
) {
  const { bookingId, scheduleId } = await params;

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  // Verify owner access
  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // マネージャーの場合、can_manage_bookings 権限を確認
  if (profile.role === "manager") {
    const { data: mgr } = await supabase
      .from("managers")
      .select("can_manage_bookings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!mgr?.can_manage_bookings) {
      return NextResponse.json(
        { error: "You don't have permission to manage event bookings" },
        { status: 403 }
      );
    }
  }

  // Verify booking belongs to studio's event
  const { data: booking } = await supabase
    .from("event_bookings")
    .select("id, event_id")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 },
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("studio_id")
    .eq("id", booking.event_id)
    .eq("studio_id", profile.studio_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify schedule exists and is pending
  const { data: schedule } = await supabase
    .from("event_payment_schedule")
    .select("id, status")
    .eq("id", scheduleId)
    .eq("event_booking_id", bookingId)
    .single();

  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 },
    );
  }

  if (schedule.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending installments can be rescheduled" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { due_date } = body;

  if (!due_date || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
    return NextResponse.json(
      { error: "Invalid date format (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("event_payment_schedule")
    .update({ due_date })
    .eq("id", scheduleId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
