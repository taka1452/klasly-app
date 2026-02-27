"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sessionId: string;
  studioId: string;
  capacity: number;
  memberId: string | null;
  existingBooking: { id: string; status: string } | null;
  memberCredits: number;
  confirmedCount: number;
  canBook?: boolean;
};

export default function BookingButton({
  sessionId,
  capacity,
  memberId,
  existingBooking,
  memberCredits,
  confirmedCount,
  canBook = true,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isFull = confirmedCount >= capacity;
  const showWaitlist = isFull;

  if (!memberId) {
    return (
      <span className="text-sm text-gray-500">Member access required</span>
    );
  }

  if (!canBook) {
    return (
      <span className="text-sm text-amber-600">
        Bookings are temporarily unavailable
      </span>
    );
  }

  async function handleBook(action: "book" | "rebook" | "cancel" | "leave_waitlist") {
    const status = showWaitlist ? "waitlist" : "confirmed";
    if (
      (action === "book" || action === "rebook") &&
      status === "confirmed" &&
      memberCredits >= 0 &&
      memberCredits < 1
    ) {
      alert("No credits remaining.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sessionId,
          memberId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Something went wrong");
        return;
      }

      router.refresh();
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (existingBooking) {
    if (existingBooking.status === "cancelled") {
      return (
        <button
          type="button"
          onClick={() => handleBook("rebook")}
          disabled={loading}
          className="btn-primary text-sm"
        >
          {loading ? "..." : "Re-book"}
        </button>
      );
    }
    if (existingBooking.status === "waitlist") {
      return (
        <button
          type="button"
          onClick={() => handleBook("leave_waitlist")}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          {loading ? "..." : "Leave waitlist"}
        </button>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-green-600">Booked ✓</span>
        <button
          type="button"
          onClick={() => handleBook("cancel")}
          disabled={loading}
          className="text-sm text-gray-500 underline hover:text-red-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => handleBook("book")}
      disabled={loading}
      className={
        showWaitlist ? "btn-secondary text-sm" : "btn-primary text-sm"
      }
    >
      {loading ? "..." : showWaitlist ? "Waitlist" : "Book"}
    </button>
  );
}
