"use client";

import { useState, useEffect, useCallback } from "react";
import ErrorAlert from "@/components/ui/error-alert";

type Props = {
  onSwitchToOverage?: () => void;
};

type Tier = {
  id: string;
  name: string;
  monthly_minutes: number;
  monthly_price: number;
  is_active: boolean;
  sort_order: number;
  overage_rate_cents: number | null;
  allow_overage: boolean;
};

export default function ContractsHourlyPlans({ onSwitchToOverage }: Props = {}) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formMinutes, setFormMinutes] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAllowOverage, setFormAllowOverage] = useState(true);
  const [formOverageRate, setFormOverageRate] = useState("");

  const fetchTiers = useCallback(async () => {
    const res = await fetch("/api/instructor-membership-tiers");
    if (res.ok) {
      const data = await res.json();
      setTiers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  function resetForm() {
    setFormName("");
    setFormMinutes("");
    setFormPrice("");
    setFormAllowOverage(true);
    setFormOverageRate("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(tier: Tier) {
    setFormName(tier.name);
    setFormMinutes(tier.monthly_minutes === -1 ? "-1" : String(tier.monthly_minutes));
    setFormPrice(tier.monthly_price > 0 ? String(tier.monthly_price / 100) : "");
    setFormAllowOverage(tier.allow_overage);
    setFormOverageRate(
      tier.allow_overage && tier.overage_rate_cents
        ? String(tier.overage_rate_cents / 100)
        : ""
    );
    setEditingId(tier.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const minutes = parseInt(formMinutes);
    if (isNaN(minutes)) {
      setError("Monthly minutes must be a number (-1 for unlimited)");
      setSaving(false);
      return;
    }

    const priceCents = Math.round((parseFloat(formPrice) || 0) * 100);
    const overageRateCents =
      formAllowOverage && formOverageRate
        ? Math.round(parseFloat(formOverageRate) * 100)
        : null;

    try {
      const body = editingId
        ? {
            id: editingId,
            name: formName,
            monthly_minutes: minutes,
            monthly_price: priceCents,
            allow_overage: formAllowOverage,
            overage_rate_cents: overageRateCents,
          }
        : {
            name: formName,
            monthly_minutes: minutes,
            monthly_price: priceCents,
            sort_order: tiers.length,
            allow_overage: formAllowOverage,
            overage_rate_cents: overageRateCents,
          };

      const res = await fetch("/api/instructor-membership-tiers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      setSuccess(editingId ? "Plan updated!" : "Plan created!");
      resetForm();
      await fetchTiers();
    } catch {
      setError("Failed to save plan");
    }
    setSaving(false);
  }

  async function toggleActive(tier: Tier) {
    const res = await fetch("/api/instructor-membership-tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tier.id, is_active: !tier.is_active }),
    });
    if (res.ok) {
      await fetchTiers();
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

  function overageLabel(tier: Tier) {
    if (tier.monthly_minutes === -1) return null;
    if (!tier.allow_overage) return "Blocked at limit";
    if (tier.overage_rate_cents) return `$${(tier.overage_rate_cents / 100).toFixed(2)}/h overage`;
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>When to use:</strong> Use an hourly plan when you want to
        charge a recurring monthly fee in exchange for a fixed number of
        studio hours (e.g. &quot;$300/mo for 10h&quot;). Overage is
        automatically charged if enabled.
      </div>

      {onSwitchToOverage && (
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onSwitchToOverage}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            View overage charges &rarr;
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorAlert error={error} onDismiss={() => setError("")} />
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      {tiers.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-gray-200">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">
                      {tier.name}
                    </p>
                    {!tier.is_active && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatMinutes(tier.monthly_minutes)} / month
                    {tier.monthly_price > 0 && (
                      <> &middot; ${(tier.monthly_price / 100).toFixed(2)}/mo</>
                    )}
                    {overageLabel(tier) && (
                      <> &middot; {overageLabel(tier)}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(tier)}
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(tier)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {tier.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No hourly plans defined yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Create a plan to set monthly hour allowances for instructors.
          </p>
        </div>
      )}

      {showForm ? (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingId ? "Edit hourly plan" : "New hourly plan"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Plan name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Basic, Premium, Unlimited..."
                required
                className="input-field mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Monthly minutes *
              </label>
              <input
                type="number"
                value={formMinutes}
                onChange={(e) => setFormMinutes(e.target.value)}
                placeholder="600 (= 10 hours)"
                required
                className="input-field mt-1"
              />
              <p className="mt-1 text-xs text-gray-400">
                Enter -1 for unlimited. E.g. 600 = 10 hours/month.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Monthly price (optional)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                  className="input-field w-32"
                />
                <span className="text-sm text-gray-500">/ month</span>
              </div>
            </div>

            {formMinutes !== "-1" && (
              <div>
                <p className="text-sm font-medium text-gray-700">
                  When the monthly limit is reached...
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Choose what happens when an instructor tries to book beyond
                  their included hours.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {/* Block option */}
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                      !formAllowOverage
                        ? "border-brand-400 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="overagePolicy"
                        checked={!formAllowOverage}
                        onChange={() => {
                          setFormAllowOverage(false);
                          setFormOverageRate("");
                        }}
                        className="accent-brand-600"
                      />
                      <span className="font-medium text-gray-900">
                        Block further bookings
                      </span>
                    </div>
                    <p className="ml-6 text-xs text-gray-500">
                      Instructor cannot schedule additional hours until the
                      next month resets their allowance.
                    </p>
                  </label>

                  {/* Allow overage option */}
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                      formAllowOverage
                        ? "border-brand-400 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="overagePolicy"
                        checked={formAllowOverage}
                        onChange={() => setFormAllowOverage(true)}
                        className="accent-brand-600"
                      />
                      <span className="font-medium text-gray-900">
                        Allow overage &mdash; charge per extra hour
                      </span>
                    </div>
                    <p className="ml-6 text-xs text-gray-500">
                      Instructor can keep booking. At month-end we auto-charge
                      the extra hours to their Stripe card.
                    </p>
                  </label>
                </div>

                {formAllowOverage && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <label className="block text-sm font-medium text-gray-800">
                      Overage rate
                    </label>
                    <p className="mt-0.5 text-xs text-amber-800">
                      Per extra hour the instructor uses beyond the plan. E.g.
                      plan is 10h/$200 and rate is $25 → they book 12h → $50
                      extra billed on the 1st of next month.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formOverageRate}
                        onChange={(e) => setFormOverageRate(e.target.value)}
                        placeholder="25.00"
                        className="input-field w-28"
                        required
                      />
                      <span className="text-sm text-gray-500">/ hour</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : editingId ? "Update plan" : "Create plan"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary mt-6"
        >
          + Add plan
        </button>
      )}
    </div>
  );
}
