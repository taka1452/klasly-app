"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { generateGoogleCalendarUrl } from "@/lib/calendar/google-calendar-url";

type BookingInfo = {
  event_name: string;
  option_name: string;
  start_date: string;
  end_date: string;
  location_name: string | null;
  total_amount_cents: number;
  payment_type: "full" | "installment";
  booking_status: string;
  guest_email: string;
  schedule: {
    installment_number: number;
    amount_cents: number;
    due_date: string;
    status: string;
  }[];
};

export default function CheckoutSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const bookingId = searchParams.get("booking_id");

  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!bookingId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/events/${eventId}/booking-info?booking_id=${bookingId}`,
        );
        if (res.ok) {
          setInfo(await res.json());
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [eventId, bookingId]);

  const isWaitlisted = info?.booking_status === "waitlisted";

  const calendarUrl =
    info && !isWaitlisted
      ? generateGoogleCalendarUrl({
          title: info.event_name,
          startDate: info.start_date,
          endDate: info.end_date,
          location: info.location_name ?? undefined,
        })
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {/* Icon */}
      {isWaitlisted ? (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-8 w-8 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      ) : (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Heading */}
      <h1 className="text-3xl font-bold text-gray-900">
        {isWaitlisted ? "You\u2019re on the waitlist!" : "Your booking is confirmed!"}
      </h1>
      <p className="mt-3 text-gray-600">
        {isWaitlisted
          ? `We\u2019ll email you at ${info?.guest_email ?? "your email"} when a spot opens up. No payment is required until then.`
          : "You\u2019ll receive a confirmation email shortly."}
      </p>

      {loading && <p className="mt-6 text-sm text-gray-400">Loading details...</p>}

      {info && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-left">
          <h2 className="text-lg font-semibold text-gray-900">{info.event_name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {info.start_date} &ndash; {info.end_date}
          </p>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Option</span>
              <span className="font-medium text-gray-900">{info.option_name}</span>
            </div>
            {isWaitlisted ? (
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Waitlisted
                </span>
              </div>
            ) : (
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-medium text-gray-900">
                  ${(info.total_amount_cents / 100).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Payment schedule (confirmed bookings only) */}
          {!isWaitlisted &&
            info.payment_type === "installment" &&
            info.schedule.length > 1 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Payment Schedule
                </h3>
                <div className="space-y-2">
                  {info.schedule.map((s) => (
                    <div
                      key={s.installment_number}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">
                        Installment {s.installment_number} &middot; {s.due_date}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          ${(s.amount_cents / 100).toFixed(2)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.status === "paid"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Google Calendar button (confirmed bookings only) */}
      {calendarUrl && (
        <div className="mt-6">
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
            Add to Google Calendar
          </a>
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/events/${eventId}`}
          className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Event
        </Link>
      </div>
    </div>
  );
}
