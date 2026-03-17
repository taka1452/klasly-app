"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";

type BookingInfo = {
  event_name: string;
  option_name: string;
  start_date: string;
  end_date: string;
  total_amount_cents: number;
  payment_type: "full" | "installment";
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
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

      <h1 className="text-3xl font-bold text-gray-900">
        Your booking is confirmed!
      </h1>
      <p className="mt-3 text-gray-600">
        You&apos;ll receive a confirmation email shortly.
      </p>

      {loading && <p className="mt-6 text-sm text-gray-400">Loading details...</p>}

      {info && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-left">
          <h2 className="text-lg font-semibold text-gray-900">{info.event_name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {info.start_date} – {info.end_date}
          </p>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Option</span>
              <span className="font-medium text-gray-900">{info.option_name}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-600">Total</span>
              <span className="font-medium text-gray-900">
                ${(info.total_amount_cents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {info.payment_type === "installment" && info.schedule.length > 1 && (
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
                      Installment {s.installment_number} · {s.due_date}
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
