import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { formatDate, formatCurrency } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import EventGallery from "@/components/events/event-gallery";
import EventMap from "@/components/events/event-map";
import EventScheduleTimeline from "@/components/events/event-schedule-timeline";
import EventPackingList from "@/components/events/event-packing-list";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { title: "Event" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const { data: event } = await supabase
    .from("events")
    .select("name, description, image_url, location_name, start_date, end_date, gallery_images")
    .eq("id", id)
    .eq("status", "published")
    .eq("is_public", true)
    .single();

  if (!event) return { title: "Event Not Found" };

  const dateRange = `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`;
  const ogImage = event.image_url || (event.gallery_images?.[0] as string) || undefined;

  return {
    title: event.name,
    description: event.description || `${event.name} · ${dateRange}`,
    openGraph: {
      title: event.name,
      description: event.description
        ? event.description.slice(0, 200)
        : `${event.name} · ${dateRange}`,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) notFound();

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  // Dashboard mode: logged-in user whose studio owns this event
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (profile?.studio_id) {
      const { data: event } = await supabase
        .from("events")
        .select("id, studio_id")
        .eq("id", id)
        .eq("studio_id", profile.studio_id)
        .single();

      if (event) {
        redirect(`/events/${id}/manage`);
      }
    }
  }

  // Public mode: published event
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, studio_id, name, description, start_date, end_date, location_name, location_address, image_url, is_public, status, payment_type, installment_count, cancellation_policy_text, gallery_images, packing_list, access_info, location_lat, location_lng, waitlist_enabled",
    )
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (!event) notFound();

  // Feature flag check
  const retreatEnabled = await isFeatureEnabled(event.studio_id, FEATURE_KEYS.RETREAT_BOOKING);
  if (!retreatEnabled) notFound();

  if (!event.is_public) {
    if (!user) notFound();
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();
    if (!profile || profile.studio_id !== event.studio_id) notFound();
  }

  // Fetch options
  const { data: options } = await supabase
    .from("event_options")
    .select("id, name, description, price_cents, capacity, is_active, early_bird_price_cents, early_bird_deadline")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("sort_order");

  // Booking counts for capacity
  const optionIds = (options || []).map((o) => o.id);
  const { data: bookings } =
    optionIds.length > 0
      ? await supabase
          .from("event_bookings")
          .select("event_option_id, group_size")
          .eq("event_id", id)
          .in("event_option_id", optionIds)
          .in("booking_status", ["pending_payment", "confirmed", "completed"])
      : { data: [] };

  const bookingCounts = (bookings || []).reduce(
    (acc, b) => {
      if (b.event_option_id) {
        acc[b.event_option_id] = (acc[b.event_option_id] || 0) + (b.group_size || 1);
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Fetch schedule items
  const { data: scheduleItems } = await supabase
    .from("event_schedule_items")
    .select("id, day_number, start_time, end_time, title, description")
    .eq("event_id", id)
    .order("day_number")
    .order("sort_order");

  const galleryImages = (event.gallery_images || []) as string[];
  const packingList = (event.packing_list || []) as { item: string; category?: string }[];
  const now = new Date();

  // Calculate days count
  const startD = new Date(event.start_date + "T00:00:00");
  const endD = new Date(event.end_date + "T00:00:00");
  const daysCount = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero Image */}
      {event.image_url && (
        <div className="mb-8 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.name}
            className="h-64 w-full object-cover sm:h-80 md:h-96"
          />
        </div>
      )}

      {/* Title & Meta */}
      <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{event.name}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-gray-600">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span>
            {formatDate(event.start_date)} – {formatDate(event.end_date)}
            <span className="ml-1 text-sm text-gray-400">({daysCount} days)</span>
          </span>
        </div>
        {event.location_name && (
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span>
              {event.location_name}
              {event.location_address && ` · ${event.location_address}`}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <div className="mt-8">
          <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
            {event.description}
          </p>
        </div>
      )}

      {/* Photo Gallery */}
      {galleryImages.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Gallery</h2>
          <EventGallery images={galleryImages} eventName={event.name} />
        </div>
      )}

      {/* Daily Schedule / Timetable */}
      {scheduleItems && scheduleItems.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Schedule</h2>
          <EventScheduleTimeline items={scheduleItems} startDate={event.start_date} />
        </div>
      )}

      {/* Options / Pricing */}
      {options && options.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">Options</h2>
          <div className="mt-4 space-y-4">
            {options.map((opt) => {
              const booked = bookingCounts[opt.id] || 0;
              const remaining = opt.capacity - booked;
              const isSoldOut = remaining <= 0;

              // Early bird logic
              const hasEarlyBird =
                opt.early_bird_price_cents != null &&
                opt.early_bird_deadline != null &&
                new Date(opt.early_bird_deadline) > now;
              const displayPrice = hasEarlyBird ? opt.early_bird_price_cents! : opt.price_cents;
              const regularPrice = opt.price_cents;

              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border p-5 transition ${
                    isSoldOut
                      ? "border-gray-200 bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{opt.name}</h3>
                      {opt.description && (
                        <p className="mt-1 text-sm text-gray-500">{opt.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {hasEarlyBird ? (
                        <>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(displayPrice)}
                          </p>
                          <p className="text-sm text-gray-400 line-through">
                            {formatCurrency(regularPrice)}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-green-600">
                            Early Bird until{" "}
                            {new Date(opt.early_bird_deadline!).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </>
                      ) : (
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(regularPrice)}
                        </p>
                      )}
                      {event.payment_type === "installment" && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          or {event.installment_count} x{" "}
                          {formatCurrency(Math.round(displayPrice / (event.installment_count || 3)))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {isSoldOut ? (
                        <span className="font-medium text-red-600">Sold Out</span>
                      ) : remaining <= 3 ? (
                        <span className="font-medium text-orange-600">
                          Only {remaining} spot{remaining !== 1 ? "s" : ""} left!
                        </span>
                      ) : (
                        `${remaining} spot${remaining !== 1 ? "s" : ""} remaining`
                      )}
                    </span>
                    {isSoldOut ? (
                      event.waitlist_enabled ? (
                        <a
                          href={`/events/${id}/checkout?option=${opt.id}&waitlist=true`}
                          className="rounded-lg bg-gray-800 px-5 py-2 text-sm font-medium text-white hover:bg-gray-900"
                        >
                          Join Waitlist
                        </a>
                      ) : (
                        <span className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-500 cursor-not-allowed">
                          Sold Out
                        </span>
                      )
                    ) : (
                      <a
                        href={`/events/${id}/checkout?option=${opt.id}`}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                      >
                        Book Now →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Packing List */}
      {packingList.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">What to Bring</h2>
          <EventPackingList items={packingList} />
        </div>
      )}

      {/* Access Info */}
      {event.access_info && (
        <div className="mt-10">
          <h2 className="mb-3 text-xl font-semibold text-gray-900">Getting There</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed">
            {event.access_info}
          </p>
        </div>
      )}

      {/* Map */}
      {(event.location_address || event.location_lat) && (
        <div className="mt-6">
          <EventMap
            locationName={event.location_name}
            locationAddress={event.location_address}
            lat={event.location_lat}
            lng={event.location_lng}
          />
        </div>
      )}

      {/* Cancellation Policy */}
      {event.cancellation_policy_text && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">Cancellation Policy</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 leading-relaxed">
            {event.cancellation_policy_text}
          </p>
        </div>
      )}
    </div>
  );
}
