"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "no_show" | "late_cancel" | null;

type Props = {
  bookingId: string;
  initialStatus: Status;
};

export default function RoomBookingClientStatus({
  bookingId,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setRemote(next: Status) {
    setPending(true);
    setError(null);
    const previous = status;
    setStatus(next);
    const res = await fetch(
      `/api/instructor/room-bookings/${bookingId}/client-status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      }
    );
    setPending(false);
    if (!res.ok) {
      setStatus(previous);
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update status");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {status ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              status === "no_show"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {status === "no_show" ? "No-show" : "Late cancel"}
          </span>
          <button
            type="button"
            onClick={() => setRemote(null)}
            disabled={pending}
            className="text-xs text-gray-500 transition-colors duration-150 hover:text-gray-700 active:text-gray-900 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRemote("no_show")}
            disabled={pending}
            className="text-xs text-red-600 transition-colors duration-150 hover:text-red-800 active:text-red-900 disabled:opacity-50"
          >
            Mark no-show
          </button>
          <span className="text-gray-400" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => setRemote("late_cancel")}
            disabled={pending}
            className="text-xs text-amber-600 transition-colors duration-150 hover:text-amber-800 active:text-amber-900 disabled:opacity-50"
          >
            Mark late cancel
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
