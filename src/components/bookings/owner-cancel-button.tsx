"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OwnerCancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this booking? The member's credit will be returned.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to cancel booking");
        return;
      }
      router.refresh();
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="text-sm text-gray-400 underline hover:text-red-600"
    >
      {loading ? "..." : "Cancel"}
    </button>
  );
}
