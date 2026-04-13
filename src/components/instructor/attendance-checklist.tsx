"use client";

import { useState } from "react";
import { getStatusColor } from "@/lib/utils";
import { csrfFetch } from "@/lib/api/csrf-client";

type BookingItem = {
  id: string;
  memberName: string;
  status: string;
  attended: boolean;
};

type Props = {
  bookings: BookingItem[];
};

export default function AttendanceChecklist({ bookings }: Props) {
  const [items, setItems] = useState(bookings);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function toggleAttendance(bookingId: string, newValue: boolean) {
    // Optimistic update
    setItems((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, attended: newValue } : b,
      ),
    );
    setLoading((prev) => ({ ...prev, [bookingId]: true }));

    try {
      const res = await csrfFetch("/api/attendance/toggle", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, attended: newValue }),
      });

      if (!res.ok) {
        // Rollback on error
        setItems((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, attended: !newValue } : b,
          ),
        );
      }
    } catch {
      // Rollback on network error
      setItems((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, attended: !newValue } : b,
        ),
      );
    } finally {
      setLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  const attendedCount = items.filter((b) => b.attended).length;

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">No confirmed bookings.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        {attendedCount}/{items.length} attended — tap to toggle
      </p>

      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {items.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={loading[b.id]}
            onClick={() => toggleAttendance(b.id, !b.attended)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
              b.attended
                ? "border-green-200 bg-green-50"
                : "border-gray-100 bg-white"
            } ${loading[b.id] ? "opacity-60" : ""}`}
          >
            <div>
              <p className="font-medium text-gray-900">{b.memberName}</p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(b.status)}`}
              >
                {b.status}
              </span>
            </div>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                b.attended
                  ? "bg-green-500 text-white"
                  : "border-2 border-gray-300 text-transparent"
              }`}
            >
              {b.attended ? "\u2713" : ""}
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Attended</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="py-3 font-medium text-gray-900">
                  {b.memberName}
                </td>
                <td className="py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(b.status)}`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    disabled={loading[b.id]}
                    onClick={() => toggleAttendance(b.id, !b.attended)}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                      b.attended
                        ? "bg-green-500 text-white"
                        : "border-2 border-gray-300 hover:border-green-400"
                    } ${loading[b.id] ? "opacity-60" : ""}`}
                  >
                    {b.attended && (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
