import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

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

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, studio_id, start_date, end_date, location_name, payment_type, installment_count, cancellation_policy_text, application_fields",
    )
    .eq("id", eventId)
    .eq("status", "published")
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Feature flag check
  const retreatEnabled = await isFeatureEnabled(event.studio_id, FEATURE_KEYS.RETREAT_BOOKING);
  if (!retreatEnabled) {
    return NextResponse.json({ error: "Feature not available" }, { status: 404 });
  }

  const { data: options } = await supabase
    .from("event_options")
    .select("id, name, description, price_cents, capacity, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("sort_order");

  const optionIds = (options || []).map((o) => o.id);
  const { data: bookings } =
    optionIds.length > 0
      ? await supabase
          .from("event_bookings")
          .select("event_option_id")
          .eq("event_id", eventId)
          .in("event_option_id", optionIds)
          .in("booking_status", ["pending_payment", "confirmed", "completed"])
      : { data: [] };

  const bookingCounts = (bookings || []).reduce(
    (acc, b) => {
      if (b.event_option_id) {
        acc[b.event_option_id] = (acc[b.event_option_id] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const enrichedOptions = (options || []).map((opt) => ({
    id: opt.id,
    name: opt.name,
    description: opt.description,
    price_cents: opt.price_cents,
    capacity: opt.capacity,
    remaining: opt.capacity - (bookingCounts[opt.id] || 0),
  }));

  return NextResponse.json({
    ...event,
    options: enrichedOptions,
  });
}
