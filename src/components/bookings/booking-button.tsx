"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const hasNoCredits = memberCredits === 0;

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
      if (hasNoCredits) {
        return (
          <div className="flex flex-col items-end gap-2 text-right">
            <span className="text-sm text-amber-600">
              No credits remaining. Please purchase a plan to book classes.
            </span>
            <Link
              href="/purchase"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Purchase
            </Link>
          </div>
        );
      }
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

  if (!existingBooking && hasNoCredits && !showWaitlist) {
    return (
      <div className="flex flex-col items-end gap-2 text-right">
        <span className="text-sm text-amber-600">
          No credits remaining. Please purchase a plan to book classes.
        </span>
        <Link
          href="/purchase"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Purchase
        </Link>
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
