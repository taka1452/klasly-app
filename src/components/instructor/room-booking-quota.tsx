"use client";

import { useState, useEffect } from "react";

type QuotaData = {
  hasTier: boolean;
  tierName?: string;
  monthlyMinutes?: number;
  usedMinutes?: number;
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

  const { tierName, monthlyMinutes, usedMinutes } = quota;
  if (monthlyMinutes === undefined || usedMinutes === undefined) return null;

  const isUnlimited = monthlyMinutes === -1;
  const remaining = isUnlimited ? Infinity : monthlyMinutes - usedMinutes;
  const pct = isUnlimited ? 0 : Math.min((usedMinutes / monthlyMinutes) * 100, 100);

  function fmt(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {tierName}
          </p>
          <p className="text-xs text-gray-500">
            {isUnlimited
              ? `Used: ${fmt(usedMinutes)} (Unlimited)`
              : `Used: ${fmt(usedMinutes)} / ${fmt(monthlyMinutes)}`}
          </p>
        </div>
        {!isUnlimited && (
          <p
            className={`text-sm font-semibold ${
              remaining <= 0
                ? "text-red-600"
                : remaining < 60
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {remaining <= 0 ? "No time left" : `${fmt(remaining)} left`}
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
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
