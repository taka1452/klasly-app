import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { getWidgetCorsHeaders, corsPreflightResponse } from "@/lib/widget/cors";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export const runtime = "nodejs";

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);
  return corsPreflightResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);

  try {
    const supabase = createAdminClient();

    // Check feature flag
    const retreatEnabled = await isFeatureEnabled(studioId, FEATURE_KEYS.RETREAT_BOOKING);
    if (!retreatEnabled) {
      return NextResponse.json(
        { events: [], studioName: "" },
        { headers: corsHeaders },
      );
    }

    // Get studio name
    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();

    // Get published, public events with future dates
    const today = new Date().toISOString().slice(0, 10);
    const { data: events } = await supabase
      .from("events")
      .select("id, name, description, start_date, end_date, location_name, location_address, image_url, status, waitlist_enabled, packing_list, access_info, payment_type, installment_count")
      .eq("studio_id", studioId)
      .eq("status", "published")
      .eq("is_public", true)
      .gte("end_date", today)
      .order("start_date", { ascending: true });

    if (!events || events.length === 0) {
      return NextResponse.json(
        { events: [], studioName: studio?.name || "" },
        { headers: corsHeaders },
      );
    }

    // Get options for all events
    const eventIds = events.map((e) => e.id);
    const { data: options } = await supabase
      .from("event_options")
      .select("id, event_id, name, price_cents, capacity, early_bird_price_cents, early_bird_deadline, is_active")
      .in("event_id", eventIds)
      .eq("is_active", true)
      .order("sort_order");

    // Get booking counts per option (accounting for group_size)
    const optionIds = (options || []).map((o) => o.id);
    const { data: bookings } = optionIds.length > 0
      ? await supabase
          .from("event_bookings")
          .select("event_option_id, group_size")
          .in("event_option_id", optionIds)
          .in("booking_status", ["pending_payment", "confirmed", "completed"])
      : { data: [] };

    const capacityUsed: Record<string, number> = {};
    (bookings || []).forEach((b) => {
      if (b.event_option_id) {
        capacityUsed[b.event_option_id] = (capacityUsed[b.event_option_id] || 0) + (b.group_size || 1);
      }
    });

    // Get schedule item counts per event
    const { data: scheduleItems } = await supabase
      .from("event_schedule_items")
      .select("event_id, id")
      .in("event_id", eventIds);
    const scheduleCountByEvent: Record<string, number> = {};
    (scheduleItems || []).forEach((s) => {
      scheduleCountByEvent[s.event_id] = (scheduleCountByEvent[s.event_id] || 0) + 1;
    });

    const now = new Date();
    const enrichedEvents = events.map((event) => {
      const eventOptions = (options || [])
        .filter((o) => o.event_id === event.id)
        .map((o) => {
          const hasEarlyBird = o.early_bird_price_cents != null
            && o.early_bird_deadline
            && new Date(o.early_bird_deadline) > now;
          return {
            id: o.id,
            name: o.name,
            price_cents: o.price_cents,
            capacity: o.capacity,
            remaining: o.capacity - (capacityUsed[o.id] || 0),
            early_bird_price_cents: hasEarlyBird ? o.early_bird_price_cents : null,
            early_bird_deadline: hasEarlyBird ? o.early_bird_deadline : null,
          };
        });

      const minPrice = Math.min(...eventOptions.map((o) => {
        const ebPrice = o.early_bird_price_cents;
        return ebPrice != null ? ebPrice : o.price_cents;
      }));
      const totalRemaining = eventOptions.reduce((sum, o) => sum + Math.max(0, o.remaining), 0);

      const packingItems = Array.isArray(event.packing_list) ? event.packing_list.length : 0;

      return {
        id: event.id,
        name: event.name,
        description: event.description,
        start_date: event.start_date,
        end_date: event.end_date,
        location_name: event.location_name,
        location_address: event.location_address,
        image_url: event.image_url,
        status: event.status,
        waitlist_enabled: event.waitlist_enabled,
        payment_type: event.payment_type,
        installment_count: event.installment_count,
        options: eventOptions,
        min_price_cents: minPrice === Infinity ? 0 : minPrice,
        total_remaining: totalRemaining,
        has_schedule: (scheduleCountByEvent[event.id] || 0) > 0,
        schedule_count: scheduleCountByEvent[event.id] || 0,
        has_packing_list: packingItems > 0,
        has_access_info: !!event.access_info,
      };
    });

    return NextResponse.json(
      { events: enrichedEvents, studioName: studio?.name || "" },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[Widget Events API]", err);
    return NextResponse.json(
      { events: [], studioName: "" },
      { status: 500, headers: corsHeaders },
    );
  }
}
