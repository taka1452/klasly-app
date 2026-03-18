"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CancellationPolicyTier } from "@/types/database";

type Schedule = {
  id: string;
  installment_number: number;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_at: string | null;
};

type Props = {
  bookingId: string;
  eventId: string;
  guestName: string;
  optionName: string;
  totalAmountCents: number;
  schedules: Schedule[];
  cancellationPolicy: CancellationPolicyTier[];
  eventStartDate: string;
};

function calculateRefund(
  paidCents: number,
  policy: CancellationPolicyTier[],
  eventStartDate: string
): { refundCents: number; tier: CancellationPolicyTier | null; daysUntil: number } {
  const now = new Date();
  const start = new Date(eventStartDate);
  const daysUntil = Math.ceil(
    (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Sort policy tiers by days_before descending
  const sorted = [...policy].sort((a, b) => b.days_before - a.days_before);

  let matchedTier: CancellationPolicyTier | null = null;
  for (const tier of sorted) {
    if (daysUntil >= tier.days_before) {
      matchedTier = tier;
      break;
    }
  }

  if (!matchedTier) {
    // No matching tier = no refund (past all deadlines)
    return { refundCents: 0, tier: null, daysUntil };
  }

  const refundBeforeFee = Math.round(
    (paidCents * matchedTier.refund_percent) / 100
  );
  const refundCents = Math.max(0, refundBeforeFee - matchedTier.fee_cents);

  return { refundCents, tier: matchedTier, daysUntil };
}

export default function EventCancelSection({
  bookingId,
  eventId,
  guestName,
  optionName,
  totalAmountCents,
  schedules,
  cancellationPolicy,
  eventStartDate,
}: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidCents = schedules
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.amount_cents, 0);

  const { refundCents, tier, daysUntil } = calculateRefund(
    paidCents,
    cancellationPolicy,
    eventStartDate
  );

  const [customRefund, setCustomRefund] = useState(
    (refundCents / 100).toFixed(2)
  );

  const handleCancel = async (withRefund: boolean) => {
    setLoading(true);
    setError(null);

    const refundAmountCents = withRefund
      ? Math.round(parseFloat(customRefund) * 100)
      : 0;

    try {
      const res = await fetch(
        `/api/events/bookings/${bookingId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refund_amount_cents: refundAmountCents }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
      setLoading(false);
    }
  };

  if (!showConfirm) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Cancel Booking
        </button>
      </div>
    );
  }

  return (
    <div className="card border border-red-200 bg-red-50">
      <h3 className="mb-4 text-lg font-semibold text-red-800">
        Cancel Booking
      </h3>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Guest</span>
          <span className="font-medium">{guestName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Option</span>
          <span className="font-medium">{optionName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Amount</span>
          <span className="font-medium">
            ${(totalAmountCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Paid So Far</span>
          <span className="font-medium text-green-700">
            ${(paidCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Days Until Event</span>
          <span className="font-medium">{daysUntil} days</span>
        </div>
      </div>

      {/* Policy tier info */}
      {tier ? (
        <div className="mb-4 rounded-lg bg-white p-3 text-sm">
          <p className="font-medium text-gray-700">
            Cancellation Policy ({"\u2265"}{tier.days_before} days before):
          </p>
          <p className="text-gray-600">
            {tier.refund_percent}% refund
            {tier.fee_cents > 0 &&
              ` minus $${(tier.fee_cents / 100).toFixed(2)} fee`}
          </p>
          {tier.note && (
            <p className="mt-1 text-xs text-gray-500">{tier.note}</p>
          )}
        </div>
      ) : cancellationPolicy.length > 0 ? (
        <div className="mb-4 rounded-lg bg-white p-3 text-sm">
          <p className="font-medium text-red-700">
            Past cancellation deadline — no refund per policy.
          </p>
        </div>
      ) : null}

      {/* Refund amount */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Refund Amount ($)
        </label>
        <input
          type="number"
          min="0"
          max={(paidCents / 100).toFixed(2)}
          step="0.01"
          value={customRefund}
          onChange={(e) => setCustomRefund(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Auto-calculated: ${(refundCents / 100).toFixed(2)} · You can adjust
          this amount.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleCancel(true)}
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Processing\u2026" : "Process Refund & Cancel"}
        </button>
        <button
          onClick={() => handleCancel(false)}
          disabled={loading}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {loading ? "Processing\u2026" : "Cancel without Refund"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
