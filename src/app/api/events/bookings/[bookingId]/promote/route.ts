import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { eventWaitlistPromoted } from "@/lib/email/templates";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = createAdminClient();

  // Get booking
  const { data: booking } = await adminDb
    .from("event_bookings")
    .select("id, event_id, event_option_id, guest_name, guest_email, booking_status")
    .eq("id", bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.booking_status !== "waitlisted") {
    return NextResponse.json({ error: "Booking is not on waitlist" }, { status: 400 });
  }

  // Verify user is owner of this event's studio
  const { data: event } = await adminDb
    .from("events")
    .select("id, name, start_date, end_date, studio_id")
    .eq("id", booking.event_id)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: profile } = await adminDb
    .from("profiles")
    .select("role, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.studio_id !== event.studio_id || (profile.role !== "owner" && profile.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Promote
  await adminDb
    .from("event_bookings")
    .update({ booking_status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", bookingId);

  // Get option name
  const { data: opt } = await adminDb
    .from("event_options")
    .select("name")
    .eq("id", booking.event_option_id)
    .single();

  // Send email
  try {
    await sendEmail({
      to: booking.guest_email,
      subject: `You're in! — ${event.name}`,
      html: eventWaitlistPromoted({
        guestName: booking.guest_name,
        eventName: event.name,
        optionName: opt?.name || "",
        startDate: event.start_date,
        endDate: event.end_date,
      }),
    });
  } catch (emailErr) {
    console.error("[Promote] email error:", emailErr);
  }

  return NextResponse.json({ success: true });
}
