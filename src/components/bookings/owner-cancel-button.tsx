"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OwnerCancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel booking");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setConfirming(false); setError(""); }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            {loading ? "Cancelling…" : "Confirm cancel"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-sm text-gray-400 underline hover:text-red-600"
    >
      Cancel
    </button>
  );
}
