import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { EventBookingFilters } from "@/components/events/event-booking-filters";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
  published: { label: "Published", cls: "bg-green-100 text-green-700" },
  sold_out: { label: "Sold Out", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function EventManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) notFound();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) notFound();

  const retreatEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.RETREAT_BOOKING);
  if (!retreatEnabled) redirect("/dashboard");

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("studio_id", profile.studio_id)
    .single();
  if (!event) notFound();

  const { data: options } = await supabase
    .from("event_options")
    .select("*")
    .eq("event_id", id)
    .order("sort_order");

  const { data: bookings } = await supabase
    .from("event_bookings")
    .select(
      "id, event_option_id, guest_name, guest_email, booking_status, total_amount_cents, payment_type, payment_status, created_at, application_responses, group_size, group_members",
    )
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const allBookings = bookings || [];
  const activeBookings = allBookings.filter(
    (b) => b.booking_status !== "cancelled",
  );

  // Get installment progress for each booking
  const bookingIds = allBookings.map((b) => b.id);
  const { data: schedules } =
    bookingIds.length > 0
      ? await supabase
          .from("event_payment_schedule")
          .select("event_booking_id, status")
          .in("event_booking_id", bookingIds)
      : { data: [] };

  const installmentProgress: Record<
    string,
    { paid: number; total: number }
  > = {};
  (schedules || []).forEach((s) => {
    if (!installmentProgress[s.event_booking_id]) {
      installmentProgress[s.event_booking_id] = { paid: 0, total: 0 };
    }
    installmentProgress[s.event_booking_id].total++;
    if (s.status === "paid") {
      installmentProgress[s.event_booking_id].paid++;
    }
  });

  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.draft;
  const optionMap = new Map((options || []).map((o) => [o.id, o]));
  const optionBookingCounts = activeBookings.reduce(
    (acc, b) => {
      if (b.event_option_id) {
        acc[b.event_option_id] = (acc[b.event_option_id] || 0) + ((b as { group_size?: number }).group_size || 1);
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Prepare serializable booking data for client component
  const bookingRows = allBookings.map((booking) => {
    const opt = booking.event_option_id
      ? optionMap.get(booking.event_option_id)
      : null;
    const progress = installmentProgress[booking.id];
    return {
      id: booking.id,
      guest_name: booking.guest_name || "—",
      guest_email: booking.guest_email,
      option_name: opt?.name ?? "—",
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      payment_type: booking.payment_type,
      total_amount_cents: booking.total_amount_cents,
      created_at: booking.created_at,
      installment_paid: progress?.paid ?? 0,
      installment_total: progress?.total ?? 0,
      application_responses: (booking as { application_responses?: Record<string, string | boolean> }).application_responses ?? null,
      group_size: (booking as { group_size?: number }).group_size || 1,
      group_members: (booking as { group_members?: { name: string; email: string }[] }).group_members || [],
    };
  });

  // Parse application field labels for display
  const appFieldLabels: Record<string, string> = {};
  const appFields = (event as { application_fields?: { id: string; label: string }[] }).application_fields;
  if (Array.isArray(appFields)) {
    for (const f of appFields) {
      appFieldLabels[f.id] = f.label;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/events"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to events
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {formatDate(event.start_date)} – {formatDate(event.end_date)}
            {event.location_name && ` · ${event.location_name}`}
          </p>
          {event.location_address && (
            <p className="text-sm text-gray-400">{event.location_address}</p>
          )}
        </div>
        <div className="flex gap-3">
          {event.is_public && event.status === "published" && (
            <Link
              href={`/events/${id}`}
              target="_blank"
              className="btn-secondary"
            >
              View Public Page ↗
            </Link>
          )}
          <Link href={`/events/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
        </div>
      </div>

      {event.description && (
        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
            {event.description}
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Visibility
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {event.is_public ? "Public" : "Members Only"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Payment
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {event.payment_type === "installment"
              ? `${event.installment_count} Installments`
              : "Full Payment"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Bookings
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {activeBookings.length}
            {event.max_total_capacity
              ? ` / ${event.max_total_capacity}`
              : ""}
          </p>
        </div>
      </div>

      {options && options.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-sm font-medium text-gray-700">Options</h2>
          <div className="divide-y divide-gray-100">
            {options.map((opt) => {
              const count = optionBookingCounts[opt.id] || 0;
              return (
                <div
                  key={opt.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{opt.name}</p>
                    {opt.description && (
                      <p className="text-sm text-gray-500">
                        {opt.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>${(opt.price_cents / 100).toFixed(0)}</span>
                    <span>
                      {count}/{opt.capacity} booked
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {event.cancellation_policy_text && (
        <div className="card mb-6">
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Cancellation Policy
          </h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600">
            {event.cancellation_policy_text}
          </p>
        </div>
      )}

      <EventBookingFilters
        eventId={id}
        bookings={bookingRows}
        appFieldLabels={appFieldLabels}
      />
    </div>
  );
}
