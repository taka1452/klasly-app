"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type FeeOverride = {
  fee_type: "percentage" | "fixed";
  fee_value: number;
} | null;

type InstructorStatus = {
  id: string;
  name: string;
  email: string;
  stripeConnected: boolean;
  onboardingComplete: boolean;
  feeOverride: FeeOverride;
};

type PayoutSettings = {
  payout_model: "studio" | "instructor_direct";
  studio_fee_percentage: number;
  studio_fee_type: "percentage" | "fixed";
  instructors: InstructorStatus[];
};

export default function PayoutSettingsPage() {
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payoutModel, setPayoutModel] = useState<"studio" | "instructor_direct">("studio");
  const [feePercentage, setFeePercentage] = useState("0");
  const [feeType, setFeeType] = useState<"percentage" | "fixed">("percentage");

  // Per-instructor fee override editing
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(null);
  const [editFeeType, setEditFeeType] = useState<"percentage" | "fixed">("percentage");
  const [editFeeValue, setEditFeeValue] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/studio/payout-settings");
    if (!res.ok) return;
    const data: PayoutSettings = await res.json();
    setSettings(data);
    setPayoutModel(data.payout_model);
    setFeePercentage(String(data.studio_fee_percentage));
    setFeeType(data.studio_fee_type ?? "percentage");
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
          studio_fee_type: feeType,
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

  function startEditOverride(inst: InstructorStatus) {
    setEditingInstructorId(inst.id);
    if (inst.feeOverride) {
      setEditFeeType(inst.feeOverride.fee_type);
      setEditFeeValue(String(inst.feeOverride.fee_value));
    } else {
      setEditFeeType(feeType);
      setEditFeeValue(feePercentage);
    }
  }

  async function saveOverride(instructorId: string) {
    setSavingOverride(true);
    try {
      const res = await fetch("/api/studio/instructor-fee-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: instructorId,
          fee_type: editFeeType,
          fee_value: parseFloat(editFeeValue) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to save override");
        return;
      }
      setEditingInstructorId(null);
      await fetchSettings();
    } finally {
      setSavingOverride(false);
    }
  }

  async function removeOverride(instructorId: string) {
    setSavingOverride(true);
    try {
      const res = await fetch("/api/studio/instructor-fee-override", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructor_id: instructorId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to remove override");
        return;
      }
      setEditingInstructorId(null);
      await fetchSettings();
    } finally {
      setSavingOverride(false);
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
    parseFloat(feePercentage) !== settings.studio_fee_percentage ||
    feeType !== (settings.studio_fee_type ?? "percentage");

  const disconnectedCount = settings.instructors.filter(
    (i) => !i.onboardingComplete
  ).length;

  const feeLabel = feeType === "fixed" ? "cents" : "%";
  const feeExample =
    feeType === "fixed"
      ? `$${(parseFloat(feePercentage) / 100).toFixed(2)} per class`
      : `${feePercentage}% of each class payment`;

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
              Default Studio Fee
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              The default fee your studio keeps from each class payment.
              You can override this per instructor below.
            </p>

            {/* Fee Type Selection */}
            <div className="mt-4 flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="feeType"
                  value="percentage"
                  checked={feeType === "percentage"}
                  onChange={() => setFeeType("percentage")}
                />
                <span className="text-sm text-gray-700">Percentage</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="feeType"
                  value="fixed"
                  checked={feeType === "fixed"}
                  onChange={() => setFeeType("fixed")}
                />
                <span className="text-sm text-gray-700">Fixed Amount</span>
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {feeType === "fixed" && (
                <span className="text-sm text-gray-600">$</span>
              )}
              <input
                type="number"
                min="0"
                max={feeType === "percentage" ? "100" : undefined}
                step={feeType === "percentage" ? "0.5" : "0.01"}
                value={feeType === "fixed" ? (parseFloat(feePercentage) / 100).toFixed(2) : feePercentage}
                onChange={(e) => {
                  if (feeType === "fixed") {
                    // Convert dollars to cents for storage
                    setFeePercentage(String(Math.round(parseFloat(e.target.value) * 100) || 0));
                  } else {
                    setFeePercentage(e.target.value);
                  }
                }}
                className="input-field w-28"
              />
              {feeType === "percentage" && (
                <span className="text-sm text-gray-600">{feeLabel}</span>
              )}
            </div>
            {parseFloat(feePercentage) > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Default: {feeExample}
                {feeType === "percentage" && (
                  <>
                    {" "}— For a $20 class, your studio receives $
                    {((20 * parseFloat(feePercentage)) / 100).toFixed(2)}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Instructor Stripe Status & Fee Overrides */}
          <div className="mt-6 card">
            <h2 className="text-lg font-semibold text-gray-900">
              Instructor Stripe Status
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Each instructor needs to connect their own Stripe account to
              receive direct payments. You can set custom fee rates per instructor.
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
                <div key={inst.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{inst.name}</p>
                      <p className="text-sm text-gray-500">{inst.email}</p>
                      {inst.feeOverride && editingInstructorId !== inst.id && (
                        <p className="mt-1 text-xs text-brand-600">
                          Custom fee: {inst.feeOverride.fee_type === "fixed"
                            ? `$${(inst.feeOverride.fee_value / 100).toFixed(2)}/class`
                            : `${inst.feeOverride.fee_value}%`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editingInstructorId === inst.id
                            ? setEditingInstructorId(null)
                            : startEditOverride(inst)
                        }
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        {editingInstructorId === inst.id ? "Cancel" : "Edit Fee"}
                      </button>
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
                  </div>

                  {/* Inline edit form */}
                  {editingInstructorId === inst.id && (
                    <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Custom Fee for {inst.name}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <select
                          value={editFeeType}
                          onChange={(e) =>
                            setEditFeeType(e.target.value as "percentage" | "fixed")
                          }
                          className="input-field w-32 text-sm"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                        <div className="flex items-center gap-1">
                          {editFeeType === "fixed" && (
                            <span className="text-sm text-gray-600">$</span>
                          )}
                          <input
                            type="number"
                            min="0"
                            max={editFeeType === "percentage" ? "100" : undefined}
                            step={editFeeType === "percentage" ? "0.5" : "0.01"}
                            value={editFeeType === "fixed"
                              ? (parseFloat(editFeeValue) / 100).toFixed(2)
                              : editFeeValue
                            }
                            onChange={(e) => {
                              if (editFeeType === "fixed") {
                                setEditFeeValue(String(Math.round(parseFloat(e.target.value) * 100) || 0));
                              } else {
                                setEditFeeValue(e.target.value);
                              }
                            }}
                            className="input-field w-24 text-sm"
                          />
                          {editFeeType === "percentage" && (
                            <span className="text-sm text-gray-600">%</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => saveOverride(inst.id)}
                          disabled={savingOverride}
                          className="btn-primary text-sm px-3 py-1"
                        >
                          {savingOverride ? "Saving..." : "Save"}
                        </button>
                        {inst.feeOverride && (
                          <button
                            type="button"
                            onClick={() => removeOverride(inst.id)}
                            disabled={savingOverride}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>
                  )}
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

      {/* Studio Rental */}
      <div className="mt-6 card">
        <h2 className="text-lg font-semibold text-gray-900">Studio Rental</h2>
        <p className="mt-1 text-sm text-gray-600">
          Charge instructors a studio usage fee — either a flat monthly rate or
          per class taught. Rental terms are configured per instructor.
        </p>
        <div className="mt-4 space-y-3">
          <Link
            href="/instructors/rental"
            className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View rental report →
          </Link>
          <p className="text-xs text-gray-400">
            To set up a rental agreement, go to each instructor&apos;s edit page
            and configure the &ldquo;Studio Rental&rdquo; section.
          </p>
        </div>
      </div>
    </div>
  );
}
