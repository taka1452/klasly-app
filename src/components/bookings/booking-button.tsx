"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  sessionId: string;
  capacity: number;
  memberId: string | null;
  existingBooking: { id: string; status: string } | null;
  memberCredits: number;
  confirmedCount: number;
  canBook?: boolean;
  /** クレジット不要モード: false の場合クレジット0でも予約ボタンを表示 */
  requiresCredits?: boolean;
  /** instructor_direct モードの場合 true → "Book & Pay" フローを使用 */
  payPerClass?: boolean;
  /** payPerClass 時に表示する料金（cents） */
  classPrice?: number;
  "data-tour"?: string;
};

export default function BookingButton({
  sessionId,
  capacity,
  memberId,
  existingBooking,
  memberCredits,
  confirmedCount,
  canBook = true,
  requiresCredits = true,
  payPerClass = false,
  classPrice,
  "data-tour": dataTour,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isFull = confirmedCount >= capacity;
  const showWaitlist = isFull;
  // クレジット必須モードのときのみ 0 クレジットをブロック
  // payPerClass モードではクレジットチェックを無効化（決済で代替）
  const hasNoCredits = !payPerClass && requiresCredits && memberCredits === 0;

  const tourProps = dataTour ? { "data-tour": dataTour } : {};

  if (!memberId) {
    return (
      <span className="text-sm text-gray-500" {...tourProps}>
        Member access required
      </span>
    );
  }

  if (!canBook) {
    return (
      <span className="text-sm text-amber-600" {...tourProps}>
        Bookings are temporarily unavailable
      </span>
    );
  }

  async function handlePayAndBook() {
    if (!memberId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/class-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleBook(action: "book" | "rebook" | "cancel" | "leave_waitlist") {
    const status = showWaitlist ? "waitlist" : "confirmed";
    if (
      requiresCredits &&
      (action === "book" || action === "rebook") &&
      status === "confirmed" &&
      memberCredits >= 0 &&
      memberCredits < 1
    ) {
      setError("No credits remaining. Please purchase a plan.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId, memberId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (existingBooking) {
    if (existingBooking.status === "cancelled") {
      if (hasNoCredits) {
        return (
          <div className="flex flex-col items-end gap-2 text-right" {...tourProps}>
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
        <div className="flex flex-col items-end gap-1" {...tourProps}>
          {error && <p className="text-xs text-red-600 text-right">{error}</p>}
          <button
            type="button"
            onClick={() => handleBook("rebook")}
            disabled={loading}
            className="btn-primary text-sm"
          >
            {loading ? "…" : "Re-book"}
          </button>
        </div>
      );
    }
    if (existingBooking.status === "waitlist") {
      return (
        <div className="flex flex-col items-end gap-1" {...tourProps}>
          {error && <p className="text-xs text-red-600 text-right">{error}</p>}
          <button
            type="button"
            onClick={() => handleBook("leave_waitlist")}
            disabled={loading}
            className="btn-secondary text-sm"
          >
            {loading ? "…" : "Leave waitlist"}
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-end gap-1" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
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
      </div>
    );
  }

  if (!existingBooking && hasNoCredits && !showWaitlist) {
    return (
      <div className="flex flex-col items-end gap-2 text-right" {...tourProps}>
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

  // Pay-per-class mode: show "Book & Pay" when member has no credits
  if (payPerClass && !existingBooking && memberCredits <= 0 && !showWaitlist) {
    const priceLabel = classPrice ? `$${(classPrice / 100).toFixed(2)}` : "";
    return (
      <div className="flex flex-col items-end gap-1" {...tourProps}>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        <button
          type="button"
          onClick={handlePayAndBook}
          disabled={loading}
          className="btn-primary text-sm"
        >
          {loading ? "…" : `Book & Pay${priceLabel ? ` ${priceLabel}` : ""}`}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1" {...tourProps}>
      {error && <p className="text-xs text-red-600 text-right">{error}</p>}
      <button
        type="button"
        onClick={() => handleBook("book")}
        disabled={loading}
        className={showWaitlist ? "btn-secondary text-sm" : "btn-primary text-sm"}
      >
        {loading ? "…" : showWaitlist ? "Waitlist" : "Book"}
      </button>
    </div>
  );
}
