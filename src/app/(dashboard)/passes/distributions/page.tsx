"use client";

import { useCallback, useEffect, useState } from "react";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type Distribution = {
  id: string;
  studio_pass_id: string;
  instructor_id: string;
  period_start: string;
  period_end: string;
  total_classes: number;
  total_pool_classes: number;
  gross_pool_amount: number;
  payout_amount: number;
  stripe_transfer_id: string | null;
  status: string;
  approved_at: string | null;
  created_at: string;
};

type DistributionData = {
  distributions: Distribution[];
  instructorNames: Record<string, string>;
  passInfo: Record<string, { name: string; price_cents: number }>;
  fees: { studioFeePercent: number; platformFeePercent: number };
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function DistributionsPage() {
  const { isEnabled } = useFeature();
  const now = new Date();
  // Default to previous month
  const defaultMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${defaultMonth.getFullYear()}-${String(defaultMonth.getMonth() + 1).padStart(2, "0")}`
  );
  const [data, setData] = useState<DistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/passes/distributions?period=${selectedPeriod}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleApprove() {
    setApproving(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/passes/distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod }),
      });
      if (res.ok) {
        setShowApproveConfirm(false);
        setStatusMessage({ type: "success", text: "Payouts approved! Transfers will be sent within 2 hours." });
        await fetchData();
      } else {
        const d = await res.json();
        setStatusMessage({ type: "error", text: d.error ?? "Failed to approve" });
      }
    } finally {
      setApproving(false);
    }
  }

  async function handleSaveAmount(distId: string) {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid amount." });
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/passes/distributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributionId: distId, payout_amount: Math.round(amount * 100) }),
      });
      if (res.ok) {
        setEditingId(null);
        setStatusMessage({ type: "success", text: "Payout amount updated." });
        await fetchData();
      } else {
        const d = await res.json();
        setStatusMessage({ type: "error", text: d.error ?? "Failed to update" });
      }
    } finally {
      setSaving(false);
    }
  }

  const distributions = data?.distributions ?? [];
  const hasPending = distributions.some((d) => d.status === "pending");
  const totalPayout = distributions.reduce((sum, d) => sum + d.payout_amount, 0);

  // Aggregate per-pass totals (each pass has its own pool)
  const passIds = Array.from(new Set(distributions.map((d) => d.studio_pass_id)));
  const perPassTotals = new Map<string, { poolClasses: number; poolAmount: number }>();
  for (const d of distributions) {
    if (!perPassTotals.has(d.studio_pass_id)) {
      perPassTotals.set(d.studio_pass_id, {
        poolClasses: d.total_pool_classes,
        poolAmount: d.gross_pool_amount,
      });
    }
  }
  let totalClasses = 0;
  let grossAmount = 0;
  for (const v of Array.from(perPassTotals.values())) {
    totalClasses += v.poolClasses;
    grossAmount += v.poolAmount;
  }

  const firstPassInfo = passIds.length > 0 && data?.passInfo?.[passIds[0]]
    ? data.passInfo[passIds[0]]
    : null;

  if (!isEnabled(FEATURE_KEYS.STUDIO_PASS)) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">Studio passes are not enabled.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Pass Distributions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve monthly instructor payouts from pass revenue
          </p>
        </div>
        <a href="/passes" className="btn-secondary shrink-0 text-sm">
          ← Back to Passes
        </a>
      </div>

      {/* Period selector */}
      <div className="mt-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Period:</label>
        <input
          type="month"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="input-field w-auto"
        />
      </div>

      {loading ? (
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      ) : distributions.length === 0 ? (
        <div className="mt-6 card">
          <p className="text-sm text-gray-700 font-medium">No distributions for this period.</p>
          <p className="mt-2 text-sm text-gray-500">
            Distributions are calculated automatically on the 1st of each month based on pass usage from the previous month.
            If members booked classes using a pass last month, distributions will appear here.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Try selecting a different month, or check back after the 1st.
          </p>
        </div>
      ) : (
        <>
          {/* Revenue Summary */}
          <div className="mt-6 card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-gray-500">Distributable Amount</p>
                <p className="text-xl font-bold text-gray-900">{formatCents(grossAmount)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Classes</p>
                <p className="text-xl font-bold text-gray-900">{totalClasses}</p>
              </div>
              <div>
                <p className="text-gray-500">Instructors</p>
                <p className="text-xl font-bold text-gray-900">{distributions.length}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Payout</p>
                <p className="text-xl font-bold text-green-600">{formatCents(totalPayout)}</p>
              </div>
            </div>
            {data?.fees && (
              <p className="mt-3 text-xs text-gray-400">
                Fees applied: Stripe ~2.9%+30¢ · Klasly {data.fees.platformFeePercent}% · Studio {data.fees.studioFeePercent}%
                {firstPassInfo && ` · Pass: ${firstPassInfo.name}`}
              </p>
            )}
          </div>

          {/* Distribution Table */}
          {/* Mobile: Card list */}
          <div className="mt-6 space-y-3 md:hidden">
            {distributions.map((dist) => {
              const name = data?.instructorNames?.[dist.instructor_id] ?? "Unknown";
              const sharePercent = dist.total_pool_classes > 0
                ? ((dist.total_classes / dist.total_pool_classes) * 100).toFixed(1)
                : "0";
              return (
                <div key={dist.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {dist.total_classes} classes · {sharePercent}% share
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCents(dist.payout_amount)}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        dist.status === "completed" ? "bg-green-100 text-green-700"
                          : dist.status === "approved" ? "bg-blue-100 text-blue-700"
                          : dist.status === "failed" ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {dist.status === "completed" ? "Completed" : dist.status.charAt(0).toUpperCase() + dist.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="card bg-gray-50">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-gray-900">Total: {totalClasses} classes</span>
                <span className="text-green-600">{formatCents(totalPayout)}</span>
              </div>
            </div>
          </div>

          {/* Desktop: Table */}
          <div className="mt-6 card hidden overflow-hidden p-0 md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Classes</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payout</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {distributions.map((dist) => {
                  const name = data?.instructorNames?.[dist.instructor_id] ?? "Unknown";
                  const sharePercent = dist.total_pool_classes > 0
                    ? ((dist.total_classes / dist.total_pool_classes) * 100).toFixed(1)
                    : "0";
                  const isEditing = editingId === dist.id;

                  return (
                    <tr key={dist.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{dist.total_classes}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{sharePercent}%</td>
                      <td className="px-6 py-4 text-sm text-right">
                        {isEditing ? (
                          <span className="flex items-center justify-end gap-1">
                            <span className="text-gray-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="input-field w-24 text-right"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveAmount(dist.id)}
                              disabled={saving}
                              className="ml-1 text-xs text-green-600 hover:text-green-700 font-medium"
                            >
                              {saving ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (dist.status === "pending") {
                                setEditingId(dist.id);
                                setEditValue((dist.payout_amount / 100).toFixed(2));
                              }
                            }}
                            className={`font-semibold ${dist.status === "pending" ? "text-gray-900 hover:text-blue-600 cursor-pointer" : "text-gray-900 cursor-default"}`}
                            title={dist.status === "pending" ? "Click to edit" : undefined}
                          >
                            {formatCents(dist.payout_amount)}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          dist.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : dist.status === "approved"
                            ? "bg-blue-100 text-blue-700"
                            : dist.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {dist.status === "completed" ? "✓ Completed" : dist.status.charAt(0).toUpperCase() + dist.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="bg-gray-50">
                  <td className="px-6 py-3 text-sm font-bold text-gray-900">Total</td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">{totalClasses}</td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">100%</td>
                  <td className="px-6 py-3 text-sm font-bold text-green-600 text-right">{formatCents(totalPayout)}</td>
                  <td className="px-6 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Status message */}
          {statusMessage && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${
              statusMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {statusMessage.text}
            </div>
          )}

          {/* Approve section */}
          {hasPending && !showApproveConfirm && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowApproveConfirm(true)}
                className="btn-primary"
              >
                Approve &amp; Send All
              </button>
            </div>
          )}

          {hasPending && showApproveConfirm && (() => {
            const pendingCount = distributions.filter((d) => d.status === "pending").length;
            const pendingTotal = distributions.filter((d) => d.status === "pending").reduce((sum, d) => sum + d.payout_amount, 0);
            return (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  Approve {pendingCount} payout{pendingCount !== 1 ? "s" : ""} totaling {formatCents(pendingTotal)}?
                </p>
                <p className="mt-1 text-xs text-amber-600">
                  Payouts will be sent to each instructor&apos;s Stripe account within 2 hours. This cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approving}
                    className="btn-primary"
                  >
                    {approving ? "Approving..." : "Yes, Approve & Send"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApproveConfirm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}

          {distributions.every((d) => d.status === "completed") && distributions[0]?.approved_at && (
            <div className="mt-4 text-sm text-green-600 text-right">
              ✓ All payouts completed
            </div>
          )}
        </>
      )}
    </div>
  );
}
