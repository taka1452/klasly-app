"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/toast";

export default function RoomBookingCancelButton({
  bookingId,
}: {
  bookingId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);

    const res = await fetch(`/api/instructor/room-bookings/${bookingId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.refresh();
    } else {
      setToastMessage("Failed to cancel booking");
    }
    setLoading(false);
    setConfirmCancel(false);
  }

  if (confirmCancel) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Cancel?</span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {loading ? "..." : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmCancel(false)}
          disabled={loading}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          No
        </button>
        {toastMessage && (
          <Toast
            message={toastMessage}
            variant="error"
            onClose={() => setToastMessage(null)}
          />
        )}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmCancel(true)}
        disabled={loading}
        className="shrink-0 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        Cancel
      </button>
      {toastMessage && (
        <Toast
          message={toastMessage}
          variant="error"
          onClose={() => setToastMessage(null)}
        />
      )}
    </>
  );
}
