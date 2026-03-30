import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ScheduleDateEditor } from "@/components/events/schedule-date-editor";
import EventCancelSection from "@/components/events/event-cancel-section";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

const PAYMENT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "bg-gray-100 text-gray-600" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  fully_paid: { label: "Fully Paid", cls: "bg-green-100 text-green-700" },
  refunded: { label: "Refunded", cls: "bg-purple-100 text-purple-700" },
};

const BOOKING_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending_payment: {
    label: "Pending Payment",
    cls: "bg-amber-100 text-amber-700",
  },
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700" },
  completed: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

const SCHEDULE_STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-purple-100 text-purple-700",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-gray-100 text-gray-600",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string; bookingId: string }>;
}) {
  const { id: eventId, bookingId } = await params;

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

  // Verify event belongs to studio
  const { data: event } = await supabase
    .from("events")
    .select("id, name, studio_id, start_date, end_date, cancellation_policy")
    .eq("id", eventId)
    .eq("studio_id", profile.studio_id)
    .single();
  if (!event) notFound();

  // Get booking
  const { data: booking } = await supabase
    .from("event_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("event_id", eventId)
    .single();
  if (!booking) notFound();

  // Get option
  const { data: option } = booking.event_option_id
    ? await supabase
        .from("event_options")
        .select("name, description, price_cents")
        .eq("id", booking.event_option_id)
        .single()
    : { data: null };

  // Get payment schedule
  const { data: schedules } = await supabase
    .from("event_payment_schedule")
    .select("*")
    .eq("event_booking_id", bookingId)
    .order("installment_number");

  const bookingBadge =
    BOOKING_STATUS_BADGE[booking.booking_status] ??
    BOOKING_STATUS_BADGE.pending_payment;
  const paymentBadge =
    PAYMENT_STATUS_BADGE[booking.payment_status] ??
    PAYMENT_STATUS_BADGE.unpaid;

  const isCancelled = booking.booking_status === "cancelled";

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/events/${eventId}/manage`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to event
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Details</h1>
          <p className="mt-1 text-sm text-gray-500">
            {event.name} · {formatDate(event.start_date)} –{" "}
            {formatDate(event.end_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${bookingBadge.cls}`}
          >
            {bookingBadge.label}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${paymentBadge.cls}`}
          >
            {paymentBadge.label}
          </span>
        </div>
      </div>

      {/* Guest Info */}
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-medium text-gray-700">
          Guest Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500 uppercase">Name</p>
            <p className="mt-1 font-medium text-gray-900">
              {booking.guest_name || "\u2014"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Email</p>
            <p className="mt-1 font-medium text-gray-900">
              {booking.guest_email}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Phone</p>
            <p className="mt-1 font-medium text-gray-900">
              {booking.guest_phone || "\u2014"}
            </p>
          </div>
        </div>
      </div>

      {/* Option & Amount */}
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-medium text-gray-700">
          Booking Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500 uppercase">Option</p>
            <p className="mt-1 font-medium text-gray-900">
              {option?.name ?? "\u2014"}
            </p>
            {option?.description && (
              <p className="text-xs text-gray-500">{option.description}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Amount</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              ${(booking.total_amount_cents / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Payment Type</p>
            <p className="mt-1 font-medium text-gray-900 capitalize">
              {booking.payment_type}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs text-gray-500 uppercase">Booked At</p>
          <p className="mt-1 text-sm text-gray-600">
            {formatDate(booking.created_at)}
          </p>
        </div>
        {booking.notes && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 uppercase">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
              {booking.notes}
            </p>
          </div>
        )}
      </div>

      {/* Payment Schedule */}
      {schedules && schedules.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-sm font-medium text-gray-700">
            Payment Schedule
          </h2>
          <div className="divide-y divide-gray-100">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    #{s.installment_number}
                  </span>
                  <span className="text-sm text-gray-900">
                    ${(s.amount_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {s.status === "pending" ? (
                    <ScheduleDateEditor
                      bookingId={bookingId}
                      scheduleId={s.id}
                      currentDate={s.due_date}
                    />
                  ) : (
                    <span className="text-sm text-gray-500">{s.due_date}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      SCHEDULE_STATUS_BADGE[s.status] ?? SCHEDULE_STATUS_BADGE.pending
                    }`}
                  >
                    {s.status}
                  </span>
                  {s.paid_at && (
                    <span className="text-xs text-gray-400">
                      {formatDate(s.paid_at)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Section */}
      {!isCancelled && (
        <EventCancelSection
          bookingId={bookingId}
          eventId={eventId}
          guestName={booking.guest_name || "Guest"}
          optionName={option?.name ?? "\u2014"}
          totalAmountCents={booking.total_amount_cents}
          schedules={(schedules ?? []).map((s) => ({
            id: s.id,
            installment_number: s.installment_number,
            amount_cents: s.amount_cents,
            due_date: s.due_date,
            status: s.status,
            paid_at: s.paid_at,
          }))}
          cancellationPolicy={event.cancellation_policy ?? []}
          eventStartDate={event.start_date}
        />
      )}
    </div>
  );
}
