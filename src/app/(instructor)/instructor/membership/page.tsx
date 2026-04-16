"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

type MembershipInfo = {
  hasTier: boolean;
  tierName?: string;
  monthlyMinutes?: number;
  monthlyPrice?: number;
  subscriptionActive?: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
};

type OverageCharge = {
  id: string;
  period_start: string;
  tier_name: string;
  overage_minutes: number;
  overage_rate_cents: number;
  total_charge_cents: number;
  status: string;
};

type Quota = {
  hasTier: boolean;
  monthlyMinutes?: number;
  usedMinutes?: number;
  allowOverage?: boolean;
  overageRateCents?: number | null;
  overageMinutes?: number;
  estimatedOverageCharge?: number;
};

export default function InstructorMembershipPage() {
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<MembershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overageCharges, setOverageCharges] = useState<OverageCharge[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

  const fetchInfo = useCallback(async () => {
    const res = await fetch("/api/instructor/membership");
    if (res.ok) {
      setInfo(await res.json());
    }
    // Also fetch overage charges
    const overageRes = await fetch("/api/instructor/overage-charges");
    if (overageRes.ok) {
      setOverageCharges(await overageRes.json());
    }
    // And current-month quota usage
    const quotaRes = await fetch("/api/instructor/quota");
    if (quotaRes.ok) {
      setQuota(await quotaRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInfo();
    if (searchParams.get("success") === "true") {
      setSuccess("Your subscription has been activated!");
    }
  }, [fetchInfo, searchParams]);

  async function handleSubscribe() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/instructor-membership-checkout", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create checkout session");
        setActionLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("An error occurred");
      setActionLoading(false);
    }
  }

  function formatMinutes(minutes: number) {
    if (minutes === -1) return "Unlimited";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  if (!info?.hasTier) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Membership</h1>
        <div className="mt-6 card py-12 text-center">
          <p className="text-gray-500">
            No membership tier has been assigned to you.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Please contact your studio owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Membership</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your room booking tier and payment status
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      <div className="mt-6 card">
        <h2 className="text-lg font-semibold text-gray-900">
          {info.tierName}
        </h2>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-gray-500">Monthly Hours</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatMinutes(info.monthlyMinutes ?? 0)}
            </dd>
          </div>
          {info.monthlyPrice != null && info.monthlyPrice > 0 && (
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Monthly Price</dt>
              <dd className="text-sm font-medium text-gray-900">
                ${(info.monthlyPrice / 100).toFixed(2)} / mo
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-sm text-gray-500">Payment Status</dt>
            <dd>
              {info.subscriptionActive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Active
                </span>
              ) : info.monthlyPrice && info.monthlyPrice > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Not subscribed
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  Free
                </span>
              )}
            </dd>
          </div>
          {info.cancelAtPeriodEnd && info.currentPeriodEnd && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              Your subscription will be cancelled on{" "}
              {new Date(info.currentPeriodEnd).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}.
            </div>
          )}
        </dl>

        {info.monthlyPrice && info.monthlyPrice > 0 && !info.subscriptionActive && (
          <button
            onClick={handleSubscribe}
            disabled={actionLoading}
            className="btn-primary mt-6"
          >
            {actionLoading ? "Processing..." : "Start Subscription"}
          </button>
        )}
      </div>

      {/* This month's usage / overage estimate */}
      {quota?.hasTier &&
        quota.monthlyMinutes != null &&
        quota.monthlyMinutes !== -1 && (
          <div className="mt-6 card">
            <h2 className="text-lg font-semibold text-gray-900">This Month</h2>
            <p className="mt-1 text-xs text-gray-500">
              Live usage against your plan. If you exceed the included hours,
              overage is billed automatically on the 1st of next month.
            </p>
            {(() => {
              const used = quota.usedMinutes ?? 0;
              const limit = quota.monthlyMinutes!;
              const pct = Math.min(100, Math.round((used / limit) * 100));
              const overMin = quota.overageMinutes ?? 0;
              const overOk = quota.allowOverage === true;
              const rate = quota.overageRateCents ?? 0;
              const estCharge = quota.estimatedOverageCharge ?? 0;
              const barColor =
                overMin > 0
                  ? "bg-red-500"
                  : pct >= 90
                    ? "bg-amber-500"
                    : "bg-brand-500";
              const fmt = (m: number) => {
                const h = Math.floor(m / 60);
                const r = m % 60;
                if (h === 0) return `${r}m`;
                if (r === 0) return `${h}h`;
                return `${h}h ${r}m`;
              };
              return (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{fmt(used)}</span>{" "}
                      used of{" "}
                      <span className="font-semibold">{fmt(limit)}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {pct}% {overMin > 0 ? "(over)" : ""}
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  {overMin > 0 ? (
                    overOk ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        You are <strong>{fmt(overMin)} over</strong> your
                        monthly allowance. Estimated overage charge:{" "}
                        <strong>${(estCharge / 100).toFixed(2)}</strong>
                        {rate ? ` ($${(rate / 100).toFixed(2)}/hour)` : ""}.
                        Billed on the 1st of next month.
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        You have exceeded your monthly allowance. Further
                        bookings are blocked until next month.
                      </div>
                    )
                  ) : pct >= 90 ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      You&apos;re approaching your monthly limit ({100 - pct}%
                      remaining).
                      {overOk && rate
                        ? ` If you go over, extra hours will be billed at $${(rate / 100).toFixed(2)}/hour.`
                        : overOk === false
                          ? " Additional bookings will be blocked at the limit."
                          : ""}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        )}

      {/* Overage charge history */}
      {overageCharges.length > 0 && (
        <div className="mt-6 card">
          <h2 className="text-lg font-semibold text-gray-900">
            Overage Charges
          </h2>
          <div className="mt-4 divide-y">
            {overageCharges.map((c) => {
              const fmtH = (m: number) => {
                const h = Math.floor(m / 60);
                const r = m % 60;
                return h > 0 && r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${r}m`;
              };
              const period = new Date(c.period_start + "T00:00:00");
              const monthStr = period.toLocaleString("en-US", { month: "long", year: "numeric" });
              const statusColor: Record<string, string> = {
                pending: "text-amber-600",
                charged: "text-green-600",
                failed: "text-red-600",
                waived: "text-gray-400",
              };
              return (
                <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{monthStr}</p>
                    <p className="text-xs text-gray-500">
                      {fmtH(c.overage_minutes)} overage &middot; ${(c.overage_rate_cents / 100).toFixed(2)}/h
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {c.status === "waived" ? (
                        <span className="line-through text-gray-400">${(c.total_charge_cents / 100).toFixed(2)}</span>
                      ) : (
                        `$${(c.total_charge_cents / 100).toFixed(2)}`
                      )}
                    </p>
                    <p className={`text-xs font-medium ${statusColor[c.status] || "text-gray-500"}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
