"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { csrfFetch } from "@/lib/api/csrf-client";
import HelpTip from "@/components/ui/help-tip";

type AppointmentType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type Booking = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  price_cents: number;
  created_at: string;
  appointment_types: { id: string; name: string; duration_minutes: number } | null;
  members: {
    id: string;
    profile_id: string;
    profiles: { full_name: string } | null;
  } | null;
  instructors: {
    id: string;
    profile_id: string;
    profiles: { full_name: string } | null;
  } | null;
};

type DateFilter = "today" | "week" | "month" | "all";
type StatusFilter = "all" | "confirmed" | "completed" | "cancelled" | "no_show";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-100 text-gray-500",
};

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDateRange(filter: DateFilter): { from: string; to: string } | null {
  if (filter === "all") return null;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (filter === "today") {
    return { from: todayStr, to: todayStr };
  }
  if (filter === "week") {
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: todayStr, to: weekEnd.toISOString().split("T")[0] };
  }
  // month
  const monthEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return { from: todayStr, to: monthEnd.toISOString().split("T")[0] };
}

export default function AppointmentsPage() {
  const { isEnabled } = useFeature();
  const [tab, setTab] = useState<"types" | "bookings">("types");
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments/types");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load appointment types.");
        return;
      }
      const data = await res.json();
      setTypes(data);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const params = new URLSearchParams();
      const range = getDateRange(dateFilter);
      if (range) {
        params.set("date_from", range.from);
        params.set("date_to", range.to);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/appointments?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBookingsError(data.error || "Failed to load bookings.");
        return;
      }
      const data = await res.json();
      setBookings(data.appointments ?? []);
    } catch {
      setBookingsError("An unexpected error occurred.");
    } finally {
      setBookingsLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  useEffect(() => {
    if (tab === "bookings") {
      fetchBookings();
    }
  }, [tab, fetchBookings]);

  async function handleToggleActive(type: AppointmentType) {
    setToggling(type.id);
    try {
      const res = await csrfFetch(`/api/appointments/types/${type.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !type.is_active }),
      });
      if (res.ok) {
        setTypes((prev) =>
          prev.map((t) =>
            t.id === type.id ? { ...t, is_active: !t.is_active } : t
          )
        );
      }
    } catch {
      // Silently fail toggle
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(type: AppointmentType) {
    if (!confirm(`Deactivate "${type.name}"? It will no longer be bookable.`)) {
      return;
    }
    try {
      const res = await csrfFetch(`/api/appointments/types/${type.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTypes((prev) =>
          prev.map((t) =>
            t.id === type.id ? { ...t, is_active: false } : t
          )
        );
      }
    } catch {
      // Silently fail
    }
  }

  if (!isEnabled(FEATURE_KEYS.APPOINTMENTS)) {
    return (
      <div className="card py-12 text-center">
        <p className="text-gray-500">
          Appointments feature is not enabled for your studio.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Go to Settings &rarr; Features to enable it.
        </p>
        <Link
          href="/settings/features"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Manage Features &rarr;
        </Link>
      </div>
    );
  }

  const activeTypes = types.filter((t) => t.is_active);
  const inactiveTypes = types.filter((t) => !t.is_active);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Appointments{" "}
            <HelpTip
              text="Manage your 1-on-1 appointment types. Clients can book these from your public page."
              helpSlug="appointments"
            />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Set up appointment types that clients can book
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab("types")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "types"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Appointment Types
        </button>
        <button
          onClick={() => setTab("bookings")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "bookings"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Bookings
        </button>
      </div>

      {tab === "types" && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Appointment Types
            </h2>
            <Link href="/appointments/types/new" className="btn-primary">
              + Create New Type
            </Link>
          </div>

          {loading && (
            <div className="py-12 text-center text-sm text-gray-400">
              Loading...
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && types.length === 0 && (
            <div className="card py-12 text-center">
              <p className="text-gray-500">No appointment types yet.</p>
              <p className="mt-1 text-sm text-gray-400">
                Create your first appointment type to get started.
              </p>
              <Link
                href="/appointments/types/new"
                className="btn-primary mt-4 inline-block"
              >
                + Create New Type
              </Link>
            </div>
          )}

          {!loading && activeTypes.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeTypes.map((type) => (
                <div key={type.id} className="card">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{type.name}</h3>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  </div>
                  {type.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {type.description}
                    </p>
                  )}
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Duration:</span>{" "}
                      {type.duration_minutes} min
                    </p>
                    <p>
                      <span className="font-medium">Price:</span>{" "}
                      {type.price_cents > 0
                        ? `$${(type.price_cents / 100).toFixed(2)}`
                        : "Free"}
                    </p>
                    {type.buffer_minutes > 0 && (
                      <p>
                        <span className="font-medium">Buffer:</span>{" "}
                        {type.buffer_minutes} min
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/appointments/types/${type.id}/edit`}
                      className="btn-secondary text-xs"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggleActive(type)}
                      disabled={toggling === type.id}
                      className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {toggling === type.id ? "..." : "Deactivate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && inactiveTypes.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-medium text-gray-500">
                Inactive Types
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactiveTypes.map((type) => (
                  <div key={type.id} className="card opacity-60">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900">
                        {type.name}
                      </h3>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Inactive
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Duration:</span>{" "}
                        {type.duration_minutes} min
                      </p>
                      <p>
                        <span className="font-medium">Price:</span>{" "}
                        {type.price_cents > 0
                          ? `$${(type.price_cents / 100).toFixed(2)}`
                          : "Free"}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/appointments/types/${type.id}/edit`}
                        className="btn-secondary text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleToggleActive(type)}
                        disabled={toggling === type.id}
                        className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {toggling === type.id ? "..." : "Reactivate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-6">
          {/* Date filter */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg bg-gray-50 p-1">
              {(
                [
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "all", label: "All" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateFilter(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    dateFilter === opt.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex gap-1 rounded-lg bg-gray-50 p-1">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "confirmed", label: "Confirmed" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "no_show", label: "No Show" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {bookingsLoading && (
            <div className="py-12 text-center text-sm text-gray-400">
              Loading bookings...
            </div>
          )}

          {bookingsError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {bookingsError}
            </div>
          )}

          {!bookingsLoading && !bookingsError && bookings.length === 0 && (
            <div className="card py-12 text-center">
              <p className="text-gray-500">No bookings found.</p>
              <p className="mt-1 text-sm text-gray-400">
                Bookings will appear here once members start booking appointments.
              </p>
            </div>
          )}

          {!bookingsLoading && bookings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Instructor</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {b.members?.profiles?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.instructors?.profiles?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.appointment_types?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(b.appointment_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatTime(b.start_time)} &ndash;{" "}
                        {formatTime(b.end_time)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {b.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {b.price_cents > 0
                          ? `$${(b.price_cents / 100).toFixed(2)}`
                          : "Free"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
