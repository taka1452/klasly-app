"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Tier = {
  id: string;
  name: string;
  monthly_minutes: number;
  allow_overage: boolean;
  overage_rate_cents: number | null;
  is_active: boolean;
};

type OverageCharge = {
  id: string;
  instructor_id: string;
  instructor_name: string;
  period_start: string;
  period_end: string;
  tier_name: string;
  included_minutes: number;
  used_minutes: number;
  overage_minutes: number;
  overage_rate_cents: number;
  total_charge_cents: number;
  status: "pending" | "charged" | "failed" | "waived";
  created_at: string;
};

export default function ContractsOverageCharges() {
  const [charges, setCharges] = useState<OverageCharge[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  });
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/instructor-overage?period=${period}`);
    if (res.ok) {
      setCharges(await res.json());
    }
    setLoading(false);
  }, [period]);

  const fetchTiers = useCallback(async () => {
    const res = await fetch("/api/instructor-membership-tiers");
    if (res.ok) {
      const data = await res.json();
      setTiers(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    fetchCharges();
    fetchTiers();
  }, [fetchCharges, fetchTiers]);

  async function handleWaive(chargeId: string) {
    setActionLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/instructor-overage/${chargeId}/waive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: waiveReason }),
    });

    if (res.ok) {
      setSuccess("Overage charge waived successfully.");
      setWaivingId(null);
      setWaiveReason("");
      await fetchCharges();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to waive charge");
    }
    setActionLoading(false);
  }

  function fmtMinutes(m: number) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}m`;
    if (r === 0) return `${h}h`;
    return `${h}h ${r}m`;
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800",
      charged: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      waived: "bg-gray-100 text-gray-500",
    };
    return (
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
          colors[status] || "bg-gray-100 text-gray-500"
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function formatPeriod(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  const totalCharge = charges
    .filter((c) => c.status !== "waived")
    .reduce((sum, c) => sum + c.total_charge_cents, 0);

  const pendingCount = charges.filter((c) => c.status === "pending").length;
  const chargedCount = charges.filter((c) => c.status === "charged").length;
  const failedCount = charges.filter((c) => c.status === "failed").length;

  const activeTiers = tiers.filter((t) => t.is_active);

  return (
    <div>
      {/* Overage settings summary */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Overage settings
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Each hourly plan controls its own policy. Edit a plan to change
              whether overage is allowed and the hourly rate.
            </p>
          </div>
          <Link
            href="/settings/contracts?tab=hourly"
            className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Edit in Hourly plans &rarr;
          </Link>
        </div>

        {activeTiers.length === 0 ? (
          <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            No active hourly plans yet. Create a plan first, then set its
            overage policy.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Monthly</th>
                  <th className="px-3 py-2">Overage policy</th>
                  <th className="px-3 py-2">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeTiers.map((t) => {
                  const unlimited = t.monthly_minutes === -1;
                  const hours = unlimited
                    ? "Unlimited"
                    : `${Math.floor(t.monthly_minutes / 60)}h ${t.monthly_minutes % 60}m`;
                  const policyBadge = unlimited ? (
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                      ✨ Unlimited
                    </span>
                  ) : t.allow_overage ? (
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                      💳 Allowed (auto-bill)
                    </span>
                  ) : (
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                      🚫 Blocked at limit
                    </span>
                  );
                  const rateText =
                    unlimited || !t.allow_overage
                      ? "—"
                      : t.overage_rate_cents != null
                        ? `$${(t.overage_rate_cents / 100).toFixed(2)} / hour`
                        : "Not set";
                  return (
                    <tr key={t.id}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {t.name}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{hours}</td>
                      <td className="px-3 py-2">{policyBadge}</td>
                      <td className="px-3 py-2 text-gray-900">{rateText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Billing schedule explainer */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>How overage billing works:</strong>
        <ol className="mt-2 ml-4 list-decimal space-y-1 text-xs">
          <li>
            When an instructor books beyond their monthly allowance on a plan
            with overage allowed, they see a confirmation modal and explicitly
            agree to the charge.
          </li>
          <li>
            On the 1st of the following month (01:00 UTC), a cron job
            calculates the accumulated overage and bills the instructor&apos;s
            Stripe card off-session.
          </li>
          <li>
            Charges move through{" "}
            <em>pending &rarr; charged</em> (success) or <em>failed</em>{" "}
            (payment method issue &mdash; instructor notified).
          </li>
          <li>
            You can <em>Waive</em> any charge below; if already charged, a
            refund is issued automatically via Stripe.
          </li>
        </ol>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {/* Period selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Period:</label>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input-field w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
        </div>
      ) : charges.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No overage charges for this period.</p>
          <p className="mt-1 text-xs text-gray-400">
            Charges are created automatically on the 1st of the following month.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-4 grid gap-4 sm:grid-cols-4">
            <div className="card">
              <p className="text-xs text-gray-500">Total</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                ${(totalCharge / 100).toFixed(2)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-amber-700">Pending</p>
              <p className="mt-1 text-xl font-bold text-amber-700">
                {pendingCount}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-green-700">Charged</p>
              <p className="mt-1 text-xl font-bold text-green-700">
                {chargedCount}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-red-700">Failed</p>
              <p className="mt-1 text-xl font-bold text-red-700">
                {failedCount}
              </p>
            </div>
          </div>

          {/* Charges table */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-4 py-3">Instructor</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Limit</th>
                    <th className="px-4 py-3">Over</th>
                    <th className="px-4 py-3">Charge</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {charges.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.instructor_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.tier_name}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtMinutes(c.used_minutes)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtMinutes(c.included_minutes)}</td>
                      <td className="px-4 py-3 font-medium text-red-600">
                        {fmtMinutes(c.overage_minutes)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        ${(c.total_charge_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3">
                        {(c.status === "pending" || c.status === "charged" || c.status === "failed") && (
                          <button
                            onClick={() => setWaivingId(waivingId === c.id ? null : c.id)}
                            className="text-xs text-brand-600 hover:text-brand-700"
                          >
                            Waive
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-right text-sm text-gray-700">
            Total overage charges:{" "}
            <span className="font-semibold">
              ${(totalCharge / 100).toFixed(2)}
            </span>
            {charges.length > 0 && (
              <span className="ml-2 text-gray-400">
                ({formatPeriod(charges[0].period_start)})
              </span>
            )}
          </div>

          {/* Waive modal */}
          {waivingId && (
            <div className="card mt-4 border-amber-200 bg-amber-50">
              <h3 className="text-sm font-semibold text-gray-900">
                Waive Overage Charge
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                This will mark the charge as waived.
                {charges.find((c) => c.id === waivingId)?.status === "charged" &&
                  " A refund will be issued automatically."}
              </p>
              <div className="mt-3">
                <input
                  type="text"
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="Reason for waiving (optional)"
                  className="input-field w-full"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleWaive(waivingId)}
                  disabled={actionLoading}
                  className="btn-primary text-sm"
                >
                  {actionLoading ? "Processing..." : "Confirm Waive"}
                </button>
                <button
                  onClick={() => {
                    setWaivingId(null);
                    setWaiveReason("");
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
