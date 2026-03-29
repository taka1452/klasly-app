import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json({ error: "booking_id required" }, { status: 400 });
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

  const { data: booking } = await supabase
    .from("event_bookings")
    .select("id, event_id, event_option_id, total_amount_cents, payment_type, booking_status, guest_email")
    .eq("id", bookingId)
    .eq("event_id", eventId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("name, start_date, end_date, location_name")
    .eq("id", eventId)
    .single();

  const { data: option } = booking.event_option_id
    ? await supabase
        .from("event_options")
        .select("name")
        .eq("id", booking.event_option_id)
        .single()
    : { data: null };

  const { data: schedule } = await supabase
    .from("event_payment_schedule")
    .select("installment_number, amount_cents, due_date, status")
    .eq("event_booking_id", bookingId)
    .order("installment_number");

  return NextResponse.json({
    event_name: event?.name ?? "",
    option_name: option?.name ?? "",
    start_date: event?.start_date ?? "",
    end_date: event?.end_date ?? "",
    location_name: event?.location_name ?? null,
    total_amount_cents: booking.total_amount_cents,
    payment_type: booking.payment_type,
    booking_status: booking.booking_status ?? "confirmed",
    guest_email: booking.guest_email ?? "",
    schedule: schedule ?? [],
  });
}
