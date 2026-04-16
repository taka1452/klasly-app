"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookingId: string;
  hasFutureSeries: boolean;
  futureCount: number;
};

export default function RoomBookingStaffActions({
  bookingId,
  hasFutureSeries,
  futureCount,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"single" | "future">("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (scope === "future") params.set("cancel_future", "true");
      if (reason.trim()) params.set("reason", reason.trim());
      const url = `/api/instructor/room-bookings/${bookingId}${
        params.size > 0 ? "?" + params.toString() : ""
      }`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel booking");
        setLoading(false);
        return;
      }
      router.push("/rooms");
      router.refresh();
    } catch {
      setError("Failed to cancel booking");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-3">
        {hasFutureSeries && (
          <div>
            <label className="text-xs font-medium text-amber-900">
              Scope
            </label>
            <div className="mt-1 space-y-1 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "single"}
                  onChange={() => setScope("single")}
                  className="accent-red-600"
                />
                This booking only
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "future"}
                  onChange={() => setScope("future")}
                  className="accent-red-600"
                />
                This and all future sessions ({futureCount})
              </label>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-amber-900">
            Reason (optional, shared with instructor)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Studio closed for maintenance"
            className="input-field mt-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Cancel booking
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-100 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs text-amber-900">
        Really cancel{" "}
        {scope === "future" ? `${futureCount} sessions` : "this booking"}? This
        cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Go back
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Cancelling..." : "Confirm cancel"}
        </button>
      </div>
    </div>
  );
}
