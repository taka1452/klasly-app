"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type RoomOption = { id: string; name: string; capacity: number | null };

export default function NewRoomBookingPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [bookingType, setBookingType] = useState<"one_time" | "recurring">("one_time");
  const [bookingDate, setBookingDate] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [numWeeks, setNumWeeks] = useState(4);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isPublic, setIsPublic] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [noMembershipWarning, setNoMembershipWarning] = useState(false);

  // Overage confirmation modal state
  type OverageInfo = {
    monthlyMinutes: number;
    overageMinutes: number;
    overageRateCents: number | null;
    estimatedChargeCents: number | null;
    bookingCount: number;
    months: Array<{
      year: number;
      month: number;
      used: number;
      requested: number;
      overage: number;
    }>;
  };
  const [overageInfo, setOverageInfo] = useState<OverageInfo | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("studio_id")
        .eq("id", user?.id)
        .single();
      if (!profile?.studio_id) return;
      const { data } = await supabase
        .from("rooms")
        .select("id, name, capacity")
        .eq("studio_id", profile.studio_id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      setRooms(data || []);

      // Check if instructor has active membership (for warning)
      try {
        const res = await fetch("/api/instructor/quota");
        if (res.ok) {
          const quota = await res.json();
          if (!quota.hasTier) {
            setNoMembershipWarning(true);
          }
        }
      } catch {
        // Ignore — warning is best-effort
      }
    }
    fetchData();

    // デフォルト日付を今日に
    const today = new Date().toISOString().split("T")[0];
    setBookingDate(today);
  }, []);

  async function submitBooking(confirmOverage: boolean) {
    const res = await fetch("/api/instructor/room-bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: roomId,
        title,
        booking_date: bookingType === "one_time" ? bookingDate : undefined,
        start_time: startTime,
        end_time: endTime,
        is_public: isPublic,
        notes: notes || null,
        recurring: bookingType === "recurring",
        day_of_week: bookingType === "recurring" ? dayOfWeek : undefined,
        weeks: bookingType === "recurring" ? numWeeks : undefined,
        confirm_overage: confirmOverage,
      }),
    });
    return { res, data: await res.json() };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOverageInfo(null);
    setLoading(true);

    try {
      const { res, data } = await submitBooking(false);

      if (res.status === 409 && data?.code === "OVERAGE_CONFIRM_REQUIRED") {
        setOverageInfo(data.overage);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to create booking");
        setLoading(false);
        return;
      }

      router.push("/instructor/room-bookings");
      router.refresh();
    } catch {
      setError("Failed to create booking");
      setLoading(false);
    }
  }

  async function handleConfirmOverage() {
    setError("");
    setLoading(true);
    try {
      const { res, data } = await submitBooking(true);
      if (!res.ok) {
        setError(data.error || "Failed to create booking");
        setLoading(false);
        setOverageInfo(null);
        return;
      }
      router.push("/instructor/room-bookings");
      router.refresh();
    } catch {
      setError("Failed to create booking");
      setLoading(false);
      setOverageInfo(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/instructor/room-bookings"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to room bookings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Book a room</h1>
      </div>

      {noMembershipWarning && (
        <div className="mb-4 max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ No active membership
          </p>
          <p className="mt-1 text-sm text-amber-700">
            You don&apos;t have an active studio membership yet. Please purchase
            a membership plan before booking rooms to ensure your hours are
            tracked correctly.
          </p>
          <Link
            href="/instructor/membership"
            className="mt-2 inline-block text-sm font-medium text-amber-800 underline hover:text-amber-900"
          >
            View membership plans →
          </Link>
        </div>
      )}

      <div className="card max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Private session, Yoga class, etc."
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Room *
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="input-field mt-1"
            >
              <option value="">Select a room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity ? ` (cap. ${r.capacity})` : ""}
                </option>
              ))}
            </select>
            {rooms.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                No rooms available. Ask the studio owner to add rooms.
              </p>
            )}
          </div>

          {/* Booking Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Schedule
            </label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="bookingType"
                  checked={bookingType === "one_time"}
                  onChange={() => setBookingType("one_time")}
                  className="h-4 w-4 border-gray-300 text-emerald-600"
                />
                One-time
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="bookingType"
                  checked={bookingType === "recurring"}
                  onChange={() => setBookingType("recurring")}
                  className="h-4 w-4 border-gray-300 text-emerald-600"
                />
                Recurring (weekly)
              </label>
            </div>
          </div>

          {bookingType === "one_time" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date *
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
                className="input-field mt-1"
              />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Day of week *
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                  className="input-field mt-1"
                >
                  {[
                    { value: 0, label: "Sunday" },
                    { value: 1, label: "Monday" },
                    { value: 2, label: "Tuesday" },
                    { value: 3, label: "Wednesday" },
                    { value: 4, label: "Thursday" },
                    { value: 5, label: "Friday" },
                    { value: 6, label: "Saturday" },
                  ].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Weeks *
                </label>
                <input
                  type="number"
                  value={numWeeks}
                  onChange={(e) => setNumWeeks(parseInt(e.target.value, 10) || 4)}
                  min={1}
                  max={52}
                  className="input-field mt-1"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Number of weekly bookings to create
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                End time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="input-field mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublicBooking"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600"
            />
            <label
              htmlFor="isPublicBooking"
              className="text-sm font-medium text-gray-700"
            >
              Public{" "}
              <span className="font-normal text-gray-500">
                (visible to members on the schedule)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional details..."
              className="input-field mt-1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Booking..." : "Book room"}
            </button>
            <Link href="/instructor/room-bookings" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Overage confirmation modal */}
      {overageInfo && (
        <OverageConfirmModal
          info={overageInfo}
          loading={loading}
          onCancel={() => setOverageInfo(null)}
          onConfirm={handleConfirmOverage}
        />
      )}
    </div>
  );
}

function fmtH(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

function OverageConfirmModal({
  info,
  loading,
  onCancel,
  onConfirm,
}: {
  info: {
    monthlyMinutes: number;
    overageMinutes: number;
    overageRateCents: number | null;
    estimatedChargeCents: number | null;
    bookingCount: number;
    months: Array<{
      year: number;
      month: number;
      used: number;
      requested: number;
      overage: number;
    }>;
  };
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rateStr =
    info.overageRateCents != null
      ? `$${(info.overageRateCents / 100).toFixed(2)}/hour`
      : "per-hour rate";
  const chargeStr =
    info.estimatedChargeCents != null
      ? `$${(info.estimatedChargeCents / 100).toFixed(2)}`
      : "—";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            ⚠ Overage charge required
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            This booking exceeds your monthly hour allowance. Extra time will
            be billed to your card on the 1st of next month.
          </p>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">
              {info.bookingCount > 1
                ? `${info.bookingCount} bookings will go over by`
                : "This booking goes over by"}
            </span>
            <span className="font-semibold text-red-600">
              {fmtH(info.overageMinutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Rate</span>
            <span className="font-medium text-gray-900">{rateStr}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-gray-100 pt-3">
            <span className="font-medium text-gray-700">
              Estimated charge
            </span>
            <span className="text-lg font-bold text-gray-900">{chargeStr}</span>
          </div>
          {info.months.length > 1 && (
            <div className="mt-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
              Breakdown by month:
              <ul className="mt-1 space-y-0.5">
                {info.months.map((m) => (
                  <li key={`${m.year}-${m.month}`} className="flex justify-between">
                    <span>
                      {m.year}/{String(m.month).padStart(2, "0")}
                    </span>
                    <span>+{fmtH(m.overage)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
            By proceeding, you agree to pay the overage charge. The exact
            amount may differ slightly if you book more or cancel hours this
            month.
          </p>
        </div>

        <div className="flex gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? "Booking..." : "Proceed & agree to charge"}
          </button>
        </div>
      </div>
    </div>
  );
}
