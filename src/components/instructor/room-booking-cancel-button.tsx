"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoomBookingCancelButton({
  bookingId,
}: {
  bookingId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this room booking?")) return;
    setLoading(true);

    const res = await fetch(`/api/instructor/room-bookings/${bookingId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to cancel booking");
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="shrink-0 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {loading ? "..." : "Cancel"}
    </button>
  );
}
