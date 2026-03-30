"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { csrfFetch } from "@/lib/api/csrf-client";
import { generateClassCalendarUrl } from "@/lib/calendar/google-calendar-url";

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  price_cents: number;
  notes: string | null;
  appointment_types: {
    id: string;
    name: string;
    duration_minutes: number;
  } | null;
  instructors: {
    id: string;
    profile_id: string;
    profiles: { full_name: string } | null;
  } | null;
};

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "no_show":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No Show";
    default:
      return status;
  }
}

export default function MemberAppointmentsPage() {
  const { isEnabled } = useFeature();
  const enabled = isEnabled(FEATURE_KEYS.APPOINTMENTS);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments");
      if (!res.ok) throw new Error("Failed to load appointments");
      const data = await res.json();
      setAppointments(data.appointments ?? []);
    } catch {
      setError("Failed to load appointments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchAppointments();
  }, [enabled, fetchAppointments]);

  // Check for success message from booking redirect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("booked") === "1") {
        setSuccessMsg("Appointment booked successfully!");
        window.history.replaceState({}, "", "/my-appointments");
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    }
  }, []);

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setCancellingId(id);
    try {
      const res = await csrfFetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to cancel appointment");
        return;
      }
      await fetchAppointments();
      setSuccessMsg("Appointment cancelled. Credits have been refunded if applicable.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      alert("Failed to cancel appointment. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  if (!enabled) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          The appointments feature is not enabled for this studio.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments.filter(
    (a) => a.status === "confirmed" && a.appointment_date >= today
  );
  const past = appointments.filter(
    (a) =>
      a.status === "completed" ||
      a.status === "cancelled" ||
      a.status === "no_show" ||
      (a.status === "confirmed" && a.appointment_date < today)
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            My Appointments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your 1-on-1 appointment bookings
          </p>
        </div>
        <Link href="/my-appointments/book" className="btn-primary">
          Book Appointment
        </Link>
      </div>

      {successMsg && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center text-sm text-gray-500">
          Loading appointments...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((apt) => {
                  const typeName =
                    apt.appointment_types?.name ?? "Appointment";
                  const duration =
                    apt.appointment_types?.duration_minutes ?? 60;
                  const instructorName =
                    (apt.instructors as unknown as {
                      profiles?: { full_name: string } | { full_name: string }[];
                    })?.profiles
                      ? Array.isArray(
                          (apt.instructors as unknown as { profiles: unknown })
                            .profiles
                        )
                        ? ((apt.instructors as unknown as { profiles: { full_name: string }[] }).profiles[0]?.full_name ?? "Instructor")
                        : ((apt.instructors as unknown as { profiles: { full_name: string } }).profiles.full_name ?? "Instructor")
                      : "Instructor";

                  const calendarUrl = generateClassCalendarUrl({
                    className: typeName,
                    date: apt.appointment_date,
                    startTime: apt.start_time,
                    durationMinutes: duration,
                    instructorName,
                  });

                  return (
                    <div
                      key={apt.id}
                      className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {typeName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          with {instructorName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(apt.appointment_date)} &middot;{" "}
                          {formatTime(apt.start_time)} &ndash;{" "}
                          {formatTime(apt.end_time)}
                        </p>
                        <div className="mt-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(apt.status)}`}
                          >
                            {statusLabel(apt.status)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <a
                          href={calendarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                        >
                          Add to Calendar
                        </a>
                        <button
                          onClick={() => handleCancel(apt.id)}
                          disabled={cancellingId === apt.id}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancellingId === apt.id ? "Cancelling..." : "Cancel"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Past
              </h2>
              <div className="space-y-3">
                {past.map((apt) => {
                  const typeName =
                    apt.appointment_types?.name ?? "Appointment";
                  const instructorName =
                    (apt.instructors as unknown as {
                      profiles?: { full_name: string } | { full_name: string }[];
                    })?.profiles
                      ? Array.isArray(
                          (apt.instructors as unknown as { profiles: unknown })
                            .profiles
                        )
                        ? ((apt.instructors as unknown as { profiles: { full_name: string }[] }).profiles[0]?.full_name ?? "Instructor")
                        : ((apt.instructors as unknown as { profiles: { full_name: string } }).profiles.full_name ?? "Instructor")
                      : "Instructor";

                  return (
                    <div
                      key={apt.id}
                      className="card flex items-center justify-between opacity-75"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {typeName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          with {instructorName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(apt.appointment_date)} &middot;{" "}
                          {formatTime(apt.start_time)} &ndash;{" "}
                          {formatTime(apt.end_time)}
                        </p>
                        <div className="mt-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(apt.status)}`}
                          >
                            {statusLabel(apt.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {upcoming.length === 0 && past.length === 0 && !loading && (
            <div className="mt-6 card">
              <p className="text-sm text-gray-500">No appointments yet.</p>
              <Link
                href="/my-appointments/book"
                className="btn-primary mt-4 inline-block"
              >
                Book your first appointment
              </Link>
            </div>
          )}

          {upcoming.length === 0 && past.length > 0 && (
            <div className="mt-6 card">
              <p className="text-sm text-gray-500">
                No upcoming appointments.
              </p>
              <Link
                href="/my-appointments/book"
                className="btn-primary mt-4 inline-block"
              >
                Book an appointment
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
