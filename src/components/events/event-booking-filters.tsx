"use client";

import { useState } from "react";
import Link from "next/link";

type BookingRow = {
  id: string;
  guest_name: string;
  guest_email: string;
  option_name: string;
  booking_status: string;
  payment_status: string;
  payment_type: string;
  total_amount_cents: number;
  created_at: string;
  installment_paid: number;
  installment_total: number;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function EventBookingFilters({
  eventId,
  bookings,
}: {
  eventId: string;
  bookings: BookingRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filtered =
    activeTab === "all"
      ? bookings
      : bookings.filter((b) => b.booking_status === activeTab);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">Bookings</h2>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => {
          const count = tab.key === "all"
            ? bookings.length
            : bookings.filter((b) => b.booking_status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">No bookings in this category.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                <th className="pb-2 pr-4">Guest</th>
                <th className="pb-2 pr-4">Option</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Payment</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((booking) => (
                <tr key={booking.id}>
                  <td className="py-2 pr-4">
                    <p className="font-medium text-gray-900">
                      {booking.guest_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {booking.guest_email}
                    </p>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {booking.option_name}
                  </td>
                  <td className="py-2 pr-4 font-medium text-gray-900">
                    ${(booking.total_amount_cents / 100).toFixed(0)}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        booking.booking_status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : booking.booking_status === "completed"
                            ? "bg-blue-100 text-blue-700"
                            : booking.booking_status === "cancelled"
                              ? "bg-red-100 text-red-700"
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
                            : booking.payment_status === "refunded"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {booking.payment_status}
                    </span>
                    {booking.payment_type === "installment" &&
                      booking.installment_total > 1 && (
                        <span className="ml-1 text-xs text-gray-400">
                          {booking.installment_paid}/{booking.installment_total}
                        </span>
                      )}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {new Date(booking.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/events/${eventId}/bookings/${booking.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
