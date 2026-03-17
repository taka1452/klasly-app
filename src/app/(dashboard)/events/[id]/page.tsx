import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
  published: { label: "Published", cls: "bg-green-100 text-green-700" },
  sold_out: { label: "Sold Out", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function EventDetailPage({
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

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("studio_id", profile.studio_id)
    .single();
  if (!event) notFound();

  // Fetch options
  const { data: options } = await supabase
    .from("event_options")
    .select("*")
    .eq("event_id", id)
    .order("sort_order");

  // Fetch bookings
  const { data: bookings } = await supabase
    .from("event_bookings")
    .select("id, event_option_id, guest_name, guest_email, booking_status, total_amount_cents, payment_status, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const activeBookings = (bookings || []).filter(
    (b) => b.booking_status !== "cancelled",
  );

  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.draft;

  // Build option lookup
  const optionMap = new Map(
    (options || []).map((o) => [o.id, o]),
  );

  // Booking counts per option
  const optionBookingCounts = activeBookings.reduce(
    (acc, b) => {
      if (b.event_option_id) {
        acc[b.event_option_id] = (acc[b.event_option_id] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="mb-6">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to events
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
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
          <Link href={`/events/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
            {event.description}
          </p>
        </div>
      )}

      {/* Event Info Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase">Visibility</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {event.is_public ? "Public" : "Members Only"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase">Payment</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {event.payment_type === "installment"
              ? `${event.installment_count} Installments`
              : "Full Payment"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase">Bookings</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {activeBookings.length}
            {event.max_total_capacity ? ` / ${event.max_total_capacity}` : ""}
          </p>
        </div>
      </div>

      {/* Options */}
      {options && options.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-sm font-medium text-gray-700">Options</h2>
          <div className="divide-y divide-gray-100">
            {options.map((opt) => {
              const count = optionBookingCounts[opt.id] || 0;
              return (
                <div key={opt.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">{opt.name}</p>
                    {opt.description && (
                      <p className="text-sm text-gray-500">{opt.description}</p>
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

      {/* Cancellation Policy */}
      {event.cancellation_policy_text && (
        <div className="card mb-6">
          <h2 className="mb-2 text-sm font-medium text-gray-700">Cancellation Policy</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600">
            {event.cancellation_policy_text}
          </p>
        </div>
      )}

      {/* Bookings Table */}
      <div className="card">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Bookings</h2>
        {activeBookings.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No bookings yet.</p>
            <p className="mt-1 text-xs text-gray-400">
              Bookings will appear here once guests register.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="pb-2 pr-4">Guest</th>
                  <th className="pb-2 pr-4">Option</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Payment</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeBookings.map((booking) => {
                  const opt = booking.event_option_id
                    ? optionMap.get(booking.event_option_id)
                    : null;
                  return (
                    <tr key={booking.id}>
                      <td className="py-2 pr-4">
                        <p className="font-medium text-gray-900">
                          {booking.guest_name || "—"}
                        </p>
                        <p className="text-xs text-gray-500">{booking.guest_email}</p>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {opt ? opt.name : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            booking.booking_status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : booking.booking_status === "completed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {booking.booking_status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            booking.payment_status === "fully_paid"
                              ? "bg-green-100 text-green-700"
                              : booking.payment_status === "partial"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {booking.payment_status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">
                        {formatDate(booking.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
