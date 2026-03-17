import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
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
    .select("name, description, image_url, location_name, start_date, end_date")
    .eq("id", id)
    .eq("status", "published")
    .eq("is_public", true)
    .single();

  if (!event) return { title: "Event Not Found" };

  const dateRange = `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`;

  return {
    title: event.name,
    description: event.description || `${event.name} · ${dateRange}`,
    openGraph: {
      title: event.name,
      description: event.description || `${event.name} · ${dateRange}`,
      ...(event.image_url ? { images: [{ url: event.image_url }] } : {}),
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
        .select("*")
        .eq("id", id)
        .eq("studio_id", profile.studio_id)
        .single();

      if (event) {
        redirect(`/events/${id}/manage`);
      }
    }
  }

  // Public mode: published event, with is_public or same-studio auth
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (!event) notFound();

  if (!event.is_public) {
    if (!user) notFound();
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();
    if (!profile || profile.studio_id !== event.studio_id) notFound();
  }

  const { data: options } = await supabase
    .from("event_options")
    .select("id, name, description, price_cents, capacity, is_active")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("sort_order");

  const optionIds = (options || []).map((o) => o.id);
  const { data: bookings } =
    optionIds.length > 0
      ? await supabase
          .from("event_bookings")
          .select("event_option_id")
          .eq("event_id", id)
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {event.image_url && (
        <div className="mb-8 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.name}
            className="h-64 w-full object-cover sm:h-80"
          />
        </div>
      )}
      <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
      <p className="mt-2 text-lg text-gray-600">
        {formatDate(event.start_date)} – {formatDate(event.end_date)}
      </p>
      {event.location_name && (
        <p className="mt-1 text-gray-500">
          {event.location_name}
          {event.location_address && ` · ${event.location_address}`}
        </p>
      )}
      {event.description && (
        <div className="mt-8">
          <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
            {event.description}
          </p>
        </div>
      )}
      {options && options.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">Options</h2>
          <div className="mt-4 space-y-4">
            {options.map((opt) => {
              const booked = bookingCounts[opt.id] || 0;
              const remaining = opt.capacity - booked;
              const isSoldOut = remaining <= 0;

              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border p-5 ${
                    isSoldOut
                      ? "border-gray-200 bg-gray-50"
                      : "border-gray-200 bg-white"
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
                      <p className="text-xl font-bold text-gray-900">
                        ${(opt.price_cents / 100).toLocaleString()}
                      </p>
                      {event.payment_type === "installment" && (
                        <p className="text-xs text-gray-500">
                          or 3 x ${(opt.price_cents / 100 / 3).toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {isSoldOut ? (
                        <span className="font-medium text-red-600">Sold Out</span>
                      ) : (
                        `${remaining} spot${remaining !== 1 ? "s" : ""} remaining`
                      )}
                    </span>
                    <button
                      disabled
                      className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
                      title="Online booking coming soon"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            Online booking coming soon. Please contact the studio to reserve your spot.
          </p>
        </div>
      )}
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
