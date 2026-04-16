"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Info, Infinity as InfinityIcon, Ban, CreditCard } from "lucide-react";

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
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

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
      setSuccess("Overage charge waived.");
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
      pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      charged: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      failed: "bg-red-50 text-red-700 ring-1 ring-red-200",
      waived: "bg-gray-50 text-gray-500 ring-1 ring-gray-200",
    };
    return (
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
          colors[status] || "bg-gray-50 text-gray-500"
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

  const activeTiers = tiers.filter((t) => t.is_active);
  const plansWithOverage = activeTiers.filter(
    (t) => t.monthly_minutes !== -1 && t.allow_overage
  );
  const plansBlocked = activeTiers.filter(
    (t) => t.monthly_minutes !== -1 && !t.allow_overage
  );

  const pendingTotal = charges
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + c.total_charge_cents, 0);
  const chargedTotal = charges
    .filter((c) => c.status === "charged")
    .reduce((s, c) => s + c.total_charge_cents, 0);
  const failedCount = charges.filter((c) => c.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Top: KPI row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-gray-500">Pending (this period)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${(pendingTotal / 100).toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {charges.filter((c) => c.status === "pending").length} charge(s)
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Charged (this period)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${(chargedTotal / 100).toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {charges.filter((c) => c.status === "charged").length} charge(s)
          </p>
        </div>
        <div
          className={`card ${
            failedCount > 0 ? "border-red-200 bg-red-50" : ""
          }`}
        >
          <p
            className={`text-xs ${
              failedCount > 0 ? "text-red-700" : "text-gray-500"
            }`}
          >
            Failed
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              failedCount > 0 ? "text-red-700" : "text-gray-900"
            }`}
          >
            {failedCount}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              failedCount > 0 ? "text-red-600" : "text-gray-400"
            }`}
          >
            {failedCount > 0 ? "Needs attention" : "No failures"}
          </p>
        </div>
      </div>

      {/* Policy summary — compact */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Policies by plan
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Each hourly plan sets its own overage rule.
            </p>
          </div>
          <Link
            href="/settings/contracts?tab=hourly"
            className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Edit plans &rarr;
          </Link>
        </div>

        {activeTiers.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No active hourly plans yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
            {activeTiers.map((t) => {
              const unlimited = t.monthly_minutes === -1;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {unlimited
                        ? "Unlimited hours"
                        : `${fmtMinutes(t.monthly_minutes)} / month`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    {unlimited ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <InfinityIcon className="h-3.5 w-3.5" />
                        No overage needed
                      </span>
                    ) : t.allow_overage ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <CreditCard className="h-3.5 w-3.5" />
                        {t.overage_rate_cents != null
                          ? `$${(t.overage_rate_cents / 100).toFixed(2)} / hour`
                          : "Rate not set"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Ban className="h-3.5 w-3.5" />
                        Blocked at limit
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Totals line */}
        {activeTiers.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {plansWithOverage.length} plan(s) bill overage &middot;{" "}
            {plansBlocked.length} plan(s) blocked at limit
          </p>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Charges table */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input-field w-48"
            />
          </div>
          <button
            type="button"
            onClick={() => setHowItWorksOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <Info className="h-3.5 w-3.5" />
            How overage billing works
          </button>
        </div>

        {howItWorksOpen && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <ol className="ml-4 list-decimal space-y-1">
              <li>
                When an instructor books beyond the monthly allowance on a plan
                with overage allowed, they see a confirmation and must agree
                to the charge before the booking is created.
              </li>
              <li>
                On the 1st of the following month a cron job sums the overage
                and bills the instructor&apos;s Stripe card.
              </li>
              <li>
                Charges move from <em>pending</em> to{" "}
                <em>charged</em> or <em>failed</em>.
              </li>
              <li>
                <em>Waive</em> cancels a pending charge or issues an automatic
                refund if already charged.
              </li>
            </ol>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : charges.length === 0 ? (
          <div className="card py-10 text-center">
            <p className="text-sm text-gray-500">
              No overage charges for this period.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Charges are created automatically on the 1st of the following month.
            </p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
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
                        <td className="px-4 py-3 text-gray-600">
                          {c.tier_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {fmtMinutes(c.used_minutes)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {fmtMinutes(c.included_minutes)}
                        </td>
                        <td className="px-4 py-3 font-medium text-red-600">
                          {fmtMinutes(c.overage_minutes)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          ${(c.total_charge_cents / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">{statusBadge(c.status)}</td>
                        <td className="px-4 py-3">
                          {(c.status === "pending" ||
                            c.status === "charged" ||
                            c.status === "failed") && (
                            <button
                              onClick={() =>
                                setWaivingId(waivingId === c.id ? null : c.id)
                              }
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

            {charges.length > 0 && (
              <p className="mt-2 text-right text-xs text-gray-500">
                {formatPeriod(charges[0].period_start)}
              </p>
            )}

            {waivingId && (
              <div className="card mt-4 border-amber-200 bg-amber-50">
                <h3 className="text-sm font-semibold text-gray-900">
                  Waive overage charge
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {charges.find((c) => c.id === waivingId)?.status === "charged"
                    ? "A refund will be issued automatically via Stripe."
                    : "This will mark the charge as waived (no payment)."}
                </p>
                <div className="mt-3">
                  <input
                    type="text"
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="input-field w-full"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleWaive(waivingId)}
                    disabled={actionLoading}
                    className="btn-primary text-sm"
                  >
                    {actionLoading ? "Processing..." : "Confirm waive"}
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
    </div>
  );
}
