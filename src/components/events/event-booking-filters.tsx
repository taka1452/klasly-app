"use client";

import React, { useState } from "react";
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
  application_responses: Record<string, string | boolean> | null;
  group_size: number;
  group_members: { name: string; email: string }[];
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
  appFieldLabels = {},
}: {
  eventId: string;
  bookings: BookingRow[];
  appFieldLabels?: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasAppFields = Object.keys(appFieldLabels).length > 0;

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
                {hasAppFields && <th className="pb-2 pr-4">Form</th>}
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((booking) => (
                <React.Fragment key={booking.id}>
                <tr>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-gray-900">
                        {booking.guest_name}
                      </p>
                      {booking.group_size > 1 && (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          ×{booking.group_size}
                        </span>
                      )}
                    </div>
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
                  {hasAppFields && (
                    <td className="py-2 pr-4">
                      {booking.application_responses || booking.group_members.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          {expandedId === booking.id ? "Hide" : "View"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="py-2">
                    <Link
                      href={`/events/${eventId}/bookings/${booking.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
                {expandedId === booking.id && (booking.application_responses || booking.group_members.length > 0) && (
                  <tr>
                    <td colSpan={hasAppFields ? 8 : 7} className="pb-3 pt-0 px-4">
                      <div className="rounded-lg bg-gray-50 p-3 space-y-2">
                        {booking.group_members.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-600 mb-1">Group Members:</p>
                            <div className="space-y-0.5">
                              {booking.group_members.map((m, i) => (
                                <p key={i} className="text-xs text-gray-900">
                                  {m.name} · <span className="text-gray-500">{m.email}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {booking.application_responses && Object.keys(booking.application_responses).length > 0 && (
                          <div className="space-y-1">
                            {Object.entries(booking.application_responses).map(([fieldId, answer]) => (
                              <div key={fieldId} className="flex gap-2 text-xs">
                                <span className="font-medium text-gray-600 min-w-[120px]">
                                  {appFieldLabels[fieldId] || fieldId}:
                                </span>
                                <span className="text-gray-900">
                                  {typeof answer === "boolean" ? (answer ? "Yes" : "No") : String(answer)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
