"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { csrfFetch } from "@/lib/api/csrf-client";

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  price_cents: number;
  payment_method: string | null;
  credit_deducted: boolean;
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
    year: "numeric",
  });
}

export default function InstructorAppointmentsPage() {
  const { isEnabled } = useFeature();
  const soapNotesEnabled = isEnabled(FEATURE_KEYS.SOAP_NOTES);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load appointments.");
        return;
      }
      const data = await res.json();
      setAppointments(data.appointments ?? []);
      setError(null);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  async function handleComplete(id: string) {
    if (!confirm("Mark this appointment as completed?")) return;
    setActionLoading(id);
    try {
      const res = await csrfFetch(`/api/appointments/${id}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchAppointments();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to complete appointment.");
      }
    } catch {
      setError("Failed to complete appointment.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(id: string) {
    const reason = prompt("Cancellation reason (optional):");
    if (reason === null) return; // User clicked cancel on prompt
    setActionLoading(id);
    try {
      const res = await csrfFetch(`/api/appointments/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ cancellation_reason: reason || null }),
      });
      if (res.ok) {
        await fetchAppointments();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to cancel appointment.");
      }
    } catch {
      setError("Failed to cancel appointment.");
    } finally {
      setActionLoading(null);
    }
  }

  if (!isEnabled(FEATURE_KEYS.APPOINTMENTS)) {
    return (
      <div className="card py-12 text-center">
        <p className="text-gray-500">
          Appointments feature is not enabled for your studio.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Contact your studio owner to enable it.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments.filter(
    (a) =>
      a.appointment_date >= today &&
      (a.status === "confirmed" || a.status === "completed")
  );
  const past = appointments.filter(
    (a) =>
      a.appointment_date < today ||
      a.status === "cancelled" ||
      a.status === "no_show"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your 1-on-1 appointment bookings
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upcoming */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Upcoming Appointments
        </h2>
        {upcoming.length === 0 ? (
          <div className="card py-8 text-center">
            <p className="text-gray-500">No upcoming appointments.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <div key={apt.id} className="card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {apt.members?.profiles?.full_name ?? "Member"}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[apt.status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {apt.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {apt.appointment_types?.name ?? "Appointment"}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatDate(apt.appointment_date)} &middot;{" "}
                      {formatTime(apt.start_time)} &ndash;{" "}
                      {formatTime(apt.end_time)}
                    </p>
                    {apt.price_cents > 0 && (
                      <p className="mt-0.5 text-sm font-medium text-gray-700">
                        ${(apt.price_cents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {apt.status === "confirmed" && (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleComplete(apt.id)}
                        disabled={actionLoading === apt.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === apt.id ? "..." : "Complete"}
                      </button>
                      <button
                        onClick={() => handleCancel(apt.id)}
                        disabled={actionLoading === apt.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      {soapNotesEnabled && apt.members && (
                        <Link
                          href={`/instructor/soap-notes?member_id=${apt.members.id}&appointment_id=${apt.id}`}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Add SOAP Note
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Past Appointments
        </h2>
        {past.length === 0 ? (
          <div className="card py-8 text-center">
            <p className="text-gray-500">No past appointments.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {past.map((apt) => (
              <div key={apt.id} className="card opacity-75">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {apt.members?.profiles?.full_name ?? "Member"}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[apt.status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {apt.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {apt.appointment_types?.name ?? "Appointment"}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatDate(apt.appointment_date)} &middot;{" "}
                      {formatTime(apt.start_time)} &ndash;{" "}
                      {formatTime(apt.end_time)}
                    </p>
                    {apt.price_cents > 0 && (
                      <p className="mt-0.5 text-sm font-medium text-gray-700">
                        ${(apt.price_cents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                  {soapNotesEnabled &&
                    apt.status === "completed" &&
                    apt.members && (
                      <Link
                        href={`/instructor/soap-notes?member_id=${apt.members.id}&appointment_id=${apt.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Add SOAP Note
                      </Link>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
