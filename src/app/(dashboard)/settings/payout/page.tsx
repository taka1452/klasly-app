"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/ui/toast";

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
  classes: { id: string; name: string }[];
};

export default function PayoutSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Owner-only page guard
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "owner") router.replace("/settings");
    })();
  }, [router]);
  const [saving, setSaving] = useState(false);
  const [payoutModel, setPayoutModel] = useState<"studio" | "instructor_direct">("studio");
  const [feePercentage, setFeePercentage] = useState("0");
  const [feeType, setFeeType] = useState<"percentage" | "fixed">("percentage");

  // Per-instructor fee override editing
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(null);
  const [editFeeType, setEditFeeType] = useState<"percentage" | "fixed">("percentage");
  const [editFeeValue, setEditFeeValue] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        setToastMessage(data.error ?? "Failed to save settings");
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
        setToastMessage(data.error ?? "Failed to save override");
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
        setToastMessage(data.error ?? "Failed to remove override");
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

      {/* Class-Specific Fees (Phase 3a) — shown if feature flag is on */}
      {payoutModel === "instructor_direct" && (
        <ClassFeeSection
          studioFeeType={feeType}
          studioFeeValue={feePercentage}
          allClasses={settings.classes ?? []}
        />
      )}

      {/* Fee Schedules (Phase 3b) — shown if feature flag is on */}
      {payoutModel === "instructor_direct" && (
        <FeeScheduleSection />
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
            href="/settings/contracts?tab=flat"
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
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}

/* ============================================
 * Phase 3a: Class-Specific Fee Overrides
 * ============================================ */

type ClassFeeRow = {
  id: string;
  class_id: string;
  fee_type: "percentage" | "fixed";
  fee_value: number;
  classes?: { name: string };
};

function ClassFeeSection({
  studioFeeType,
  studioFeeValue,
  allClasses,
}: {
  studioFeeType: string;
  studioFeeValue: string;
  allClasses: { id: string; name: string }[];
}) {
  const [overrides, setOverrides] = useState<ClassFeeRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [editFeeType, setEditFeeType] = useState<"percentage" | "fixed">(
    studioFeeType as "percentage" | "fixed"
  );
  const [editFeeValue, setEditFeeValue] = useState(studioFeeValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/studio/class-fee-override");
      if (res.status === 403) {
        setFeatureEnabled(false);
        setLoaded(true);
        return;
      }
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      setFeatureEnabled(true);
      const data = await res.json();
      setOverrides(data.overrides ?? []);
      setLoaded(true);
    }
    load();
  }, []);

  async function handleSave() {
    if (!selectedClassId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/class-fee-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClassId,
          fee_type: editFeeType,
          fee_value: parseFloat(editFeeValue) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToastMessage(data.error ?? "Failed to save");
        return;
      }
      setShowForm(false);
      // Refresh
      const refreshRes = await fetch("/api/studio/class-fee-override");
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setOverrides(data.overrides ?? []);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(classId: string) {
    const res = await fetch("/api/studio/class-fee-override", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId }),
    });
    if (res.ok) {
      setOverrides((prev) => prev.filter((o) => o.class_id !== classId));
    }
  }

  if (!loaded || !featureEnabled) return null;

  const usedClassIds = new Set(overrides.map((o) => o.class_id));
  const availableClasses = allClasses.filter((c) => !usedClassIds.has(c.id));

  return (
    <div className="mt-6 card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Class-Specific Fees
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Override the studio fee for specific classes. These take highest priority.
          </p>
        </div>
        {availableClasses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setSelectedClassId(availableClasses[0]?.id ?? "");
              setEditFeeType(studioFeeType as "percentage" | "fixed");
              setEditFeeValue(studioFeeValue);
            }}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            + Add Override
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="input-field w-48 text-sm"
            >
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
                value={
                  editFeeType === "fixed"
                    ? (parseFloat(editFeeValue) / 100).toFixed(2)
                    : editFeeValue
                }
                onChange={(e) => {
                  if (editFeeType === "fixed") {
                    setEditFeeValue(
                      String(Math.round(parseFloat(e.target.value) * 100) || 0)
                    );
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
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm px-3 py-1"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 divide-y divide-gray-200">
        {overrides.map((override) => (
          <div key={override.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">
                {override.classes?.name ?? "Unknown Class"}
              </p>
              <p className="text-sm text-brand-600">
                {override.fee_type === "fixed"
                  ? `$${(override.fee_value / 100).toFixed(2)}/class`
                  : `${override.fee_value}%`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(override.class_id)}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        {overrides.length === 0 && !showForm && (
          <p className="py-3 text-sm text-gray-500">
            No class-specific fee overrides. Studio default applies to all classes.
          </p>
        )}
      </div>
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}

/* ============================================
 * Phase 3b: Fee Schedules
 * ============================================ */

type FeeScheduleRow = {
  id: string;
  name: string;
  day_of_week: number[] | null;
  start_time: string;
  end_time: string;
  fee_type: "percentage" | "fixed";
  fee_value: number;
  priority: number;
  is_active: boolean;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function FeeScheduleSection() {
  const [schedules, setSchedules] = useState<FeeScheduleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDays, setFormDays] = useState<number[]>([]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formFeeType, setFormFeeType] = useState<"percentage" | "fixed">("percentage");
  const [formFeeValue, setFormFeeValue] = useState("20");
  const [formPriority, setFormPriority] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/studio/fee-schedules");
      if (res.status === 403) {
        setFeatureEnabled(false);
        setLoaded(true);
        return;
      }
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      setFeatureEnabled(true);
      const data = await res.json();
      setSchedules(data.schedules ?? []);
      setLoaded(true);
    }
    load();
  }, []);

  async function handleSave() {
    if (!formName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/fee-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          day_of_week: formDays.length > 0 ? formDays : null,
          start_time: formStartTime,
          end_time: formEndTime,
          fee_type: formFeeType,
          fee_value: parseFloat(formFeeValue) || 0,
          priority: parseInt(formPriority) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToastMessage(data.error ?? "Failed to save");
        return;
      }
      setShowForm(false);
      const data = await res.json();
      setSchedules((prev) => [data.schedule, ...prev]);
      // Reset form
      setFormName("");
      setFormDays([]);
      setFormStartTime("09:00");
      setFormEndTime("17:00");
      setFormFeeType("percentage");
      setFormFeeValue("20");
      setFormPriority("0");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    await fetch("/api/studio/fee-schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentActive }),
    });
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !currentActive } : s))
    );
  }

  async function handleDelete(id: string) {
    await fetch("/api/studio/fee-schedules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleDay(day: number) {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  if (!loaded || !featureEnabled) return null;

  return (
    <div className="mt-6 card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Fee Schedules</h2>
          <p className="mt-1 text-sm text-gray-600">
            Set different fee rates based on time of day and day of week.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          + Add Schedule
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Schedule name (e.g. Weekend Rate)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="input-field flex-1 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Priority:</label>
              <input
                type="number"
                min="0"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="input-field w-16 text-sm"
              />
            </div>
          </div>

          {/* Day selection */}
          <div>
            <label className="text-xs text-gray-500">
              Days (leave all unchecked for every day):
            </label>
            <div className="mt-1 flex gap-1">
              {DAY_NAMES.map((name, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    formDays.includes(idx)
                      ? "bg-brand-600 text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs text-gray-500">From:</label>
              <input
                type="time"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">To:</label>
              <input
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Fee */}
          <div className="flex items-center gap-3">
            <select
              value={formFeeType}
              onChange={(e) =>
                setFormFeeType(e.target.value as "percentage" | "fixed")
              }
              className="input-field w-32 text-sm"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
            <div className="flex items-center gap-1">
              {formFeeType === "fixed" && (
                <span className="text-sm text-gray-600">$</span>
              )}
              <input
                type="number"
                min="0"
                value={formFeeValue}
                onChange={(e) => setFormFeeValue(e.target.value)}
                className="input-field w-24 text-sm"
              />
              {formFeeType === "percentage" && (
                <span className="text-sm text-gray-600">%</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formName}
              className="btn-primary text-sm px-3 py-1"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 divide-y divide-gray-200">
        {schedules.map((sched) => (
          <div key={sched.id} className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{sched.name}</p>
                {!sched.is_active && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {sched.day_of_week
                  ? sched.day_of_week.map((d) => DAY_NAMES[d]).join(", ")
                  : "Every day"}{" "}
                | {sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)}
              </p>
              <p className="text-xs text-brand-600">
                {sched.fee_type === "fixed"
                  ? `$${(sched.fee_value / 100).toFixed(2)}/class`
                  : `${sched.fee_value}%`}
                {sched.priority > 0 && ` (priority: ${sched.priority})`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggle(sched.id, sched.is_active)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {sched.is_active ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(sched.id)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {schedules.length === 0 && !showForm && (
          <p className="py-3 text-sm text-gray-500">
            No fee schedules configured.
          </p>
        )}
      </div>
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
