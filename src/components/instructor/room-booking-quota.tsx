"use client";

import { useState, useEffect } from "react";

type QuotaData = {
  hasTier: boolean;
  tierName?: string;
  monthlyMinutes?: number;
  usedMinutes?: number;
  allowOverage?: boolean;
  overageRateCents?: number | null;
  overageMinutes?: number;
  estimatedOverageCharge?: number;
};

export default function RoomBookingQuota() {
  const [quota, setQuota] = useState<QuotaData | null>(null);

  useEffect(() => {
    async function fetchQuota() {
      const res = await fetch("/api/instructor/quota");
      if (res.ok) {
        setQuota(await res.json());
      }
    }
    fetchQuota();
  }, []);

  if (!quota || !quota.hasTier) return null;

  const { tierName, monthlyMinutes, usedMinutes, overageMinutes, overageRateCents, estimatedOverageCharge } = quota;
  if (monthlyMinutes === undefined || usedMinutes === undefined) return null;

  const isUnlimited = monthlyMinutes === -1;
  const isOver = !isUnlimited && usedMinutes > monthlyMinutes;
  const pct = isUnlimited ? 0 : (usedMinutes / monthlyMinutes) * 100;
  const remaining = isUnlimited ? Infinity : monthlyMinutes - usedMinutes;

  function fmt(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  return (
    <div className={`card ${isOver ? "border-red-200 bg-red-50" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {tierName}
          </p>
          <p className="text-xs text-gray-500">
            {isUnlimited
              ? `Used: ${fmt(usedMinutes)} (Unlimited)`
              : isOver
                ? `Used: ${fmt(usedMinutes)} / ${fmt(monthlyMinutes)} — ${fmt(overageMinutes || 0)} over`
                : `Used: ${fmt(usedMinutes)} / ${fmt(monthlyMinutes)}`}
          </p>
        </div>
        {!isUnlimited && (
          <p
            className={`text-sm font-semibold ${
              isOver
                ? "text-red-600"
                : remaining <= 0
                  ? "text-red-600"
                  : remaining < 60
                    ? "text-amber-600"
                    : "text-emerald-600"
            }`}
          >
            {isOver
              ? `${fmt(overageMinutes || 0)} over`
              : remaining <= 0
                ? "No time left"
                : `${fmt(remaining)} left`}
          </p>
        )}
      </div>
      {!isUnlimited && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 100
                ? "bg-red-500"
                : pct >= 80
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(pct, 120)}%` }}
          />
        </div>
      )}
      {/* Overage warning */}
      {isOver && overageRateCents && estimatedOverageCharge ? (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-100 p-2">
          <span className="text-red-500 text-sm">&#9888;</span>
          <p className="text-xs text-red-700">
            Overage: {fmt(overageMinutes || 0)} &times; ${(overageRateCents / 100).toFixed(2)}/h = ${(estimatedOverageCharge / 100).toFixed(2)} will be charged at end of month
          </p>
        </div>
      ) : null}
    </div>
  );
}
