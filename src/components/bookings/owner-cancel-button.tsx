"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function OwnerCancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
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
      setShowConfirm(false);
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="text-sm text-gray-400 underline hover:text-red-600"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => { setShowConfirm(false); setError(""); }}
        onConfirm={handleCancel}
        title="Cancel booking"
        description="Are you sure you want to cancel this booking? The member will be notified."
        confirmLabel="Confirm cancel"
        variant="warning"
        loading={loading}
      />
    </>
  );
}
