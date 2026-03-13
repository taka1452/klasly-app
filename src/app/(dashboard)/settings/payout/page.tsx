"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type InstructorStatus = {
  id: string;
  name: string;
  email: string;
  stripeConnected: boolean;
  onboardingComplete: boolean;
};

type PayoutSettings = {
  payout_model: "studio" | "instructor_direct";
  studio_fee_percentage: number;
  instructors: InstructorStatus[];
};

export default function PayoutSettingsPage() {
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payoutModel, setPayoutModel] = useState<"studio" | "instructor_direct">("studio");
  const [feePercentage, setFeePercentage] = useState("0");

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/studio/payout-settings");
    if (!res.ok) return;
    const data: PayoutSettings = await res.json();
    setSettings(data);
    setPayoutModel(data.payout_model);
    setFeePercentage(String(data.studio_fee_percentage));
  }, []);

  useEffect(() => {
    fetchSettings().finally(() => setLoading(false));
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/payout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_model: payoutModel,
          studio_fee_percentage: parseFloat(feePercentage) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to save settings");
        return;
      }
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payout Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure how payments are distributed
        </p>
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const hasUnsavedChanges =
    payoutModel !== settings.payout_model ||
    parseFloat(feePercentage) !== settings.studio_fee_percentage;

  const disconnectedCount = settings.instructors.filter(
    (i) => !i.onboardingComplete
  ).length;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          &larr; Settings
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Payout Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Configure how payments are distributed
      </p>

      {/* Payout Model Selection */}
      <div className="mt-6 card">
        <h2 className="text-lg font-semibold text-gray-900">Payout Model</h2>
        <p className="mt-1 text-sm text-gray-600">
          Choose how member payments are handled.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-gray-50">
            <input
              type="radio"
              name="payoutModel"
              value="studio"
              checked={payoutModel === "studio"}
              onChange={() => setPayoutModel("studio")}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-gray-900">Studio Payout</p>
              <p className="text-sm text-gray-500">
                All payments go to your studio&apos;s Stripe account. You handle
                instructor payouts manually.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-gray-50">
            <input
              type="radio"
              name="payoutModel"
              value="instructor_direct"
              checked={payoutModel === "instructor_direct"}
              onChange={() => setPayoutModel("instructor_direct")}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-gray-900">
                Instructor Direct Payout
              </p>
              <p className="text-sm text-gray-500">
                Payments go directly to each instructor&apos;s Stripe account.
                Your studio fee is automatically deducted.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Studio Fee (only when instructor_direct) */}
      {payoutModel === "instructor_direct" && (
        <>
          <div className="mt-6 card">
            <h2 className="text-lg font-semibold text-gray-900">
              Studio Fee
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              The percentage your studio keeps from each class payment.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={feePercentage}
                onChange={(e) => setFeePercentage(e.target.value)}
                className="input-field w-24"
              />
              <span className="text-sm text-gray-600">%</span>
            </div>
            {parseFloat(feePercentage) > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Example: For a $20 class, your studio receives $
                {((20 * parseFloat(feePercentage)) / 100).toFixed(2)} and the
                instructor receives the rest (minus Stripe &amp; platform fees).
              </p>
            )}
          </div>

          {/* Instructor Stripe Status */}
          <div className="mt-6 card">
            <h2 className="text-lg font-semibold text-gray-900">
              Instructor Stripe Status
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Each instructor needs to connect their own Stripe account to
              receive direct payments.
            </p>

            {disconnectedCount > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  {disconnectedCount} instructor(s) have not completed Stripe
                  setup. Payments for their classes will fall back to your studio
                  account.
                </p>
              </div>
            )}

            <div className="mt-4 divide-y divide-gray-200">
              {settings.instructors.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{inst.name}</p>
                    <p className="text-sm text-gray-500">{inst.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      inst.onboardingComplete
                        ? "bg-green-100 text-green-700"
                        : inst.stripeConnected
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {inst.onboardingComplete
                      ? "Connected"
                      : inst.stripeConnected
                        ? "Pending"
                        : "Not connected"}
                  </span>
                </div>
              ))}
              {settings.instructors.length === 0 && (
                <p className="py-3 text-sm text-gray-500">
                  No instructors added yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save Button */}
      {hasUnsavedChanges && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
