"use client";

import { useEffect, useState, useCallback } from "react";

type Preferences = {
  email_booking_confirmation: boolean;
  email_booking_cancellation: boolean;
  email_class_changes: boolean;
  email_payment_receipts: boolean;
  email_new_messages: boolean;
};

const defaultPrefs: Preferences = {
  email_booking_confirmation: true,
  email_booking_cancellation: true,
  email_class_changes: true,
  email_payment_receipts: true,
  email_new_messages: true,
};

const NOTIFICATION_TYPES: Array<{
  key: keyof Preferences;
  label: string;
  description: string;
}> = [
  {
    key: "email_booking_confirmation",
    label: "Room booking confirmations",
    description:
      "Get an email when your studio room booking is created (including any overage charge details).",
  },
  {
    key: "email_booking_cancellation",
    label: "Cancellations by the studio",
    description:
      "Get an email if the studio cancels one of your room bookings on your behalf.",
  },
  {
    key: "email_class_changes",
    label: "Class changes",
    description:
      "Get an email when a session or class you're assigned to is updated.",
  },
  {
    key: "email_payment_receipts",
    label: "Payment receipts",
    description:
      "Get an email for every membership, overage, and payout transaction.",
  },
  {
    key: "email_new_messages",
    label: "New messages",
    description: "Get an email when you receive a new message from your studio.",
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-brand-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function InstructorNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications/preferences");
        if (!res.ok) {
          setError("Failed to load preferences");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setPrefs({ ...defaultPrefs, ...data });
      } catch {
        if (!cancelled) setError("Failed to load preferences");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (key: keyof Preferences, value: boolean) => {
      const prev = prefs;
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      setSaving(true);
      setError("");
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });
        if (!res.ok) {
          setPrefs(prev);
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to save");
        }
      } catch {
        setPrefs(prev);
        setError("Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [prefs]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
        Email Notifications
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Choose which emails you want to receive from your studio.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-1 rounded-xl border border-gray-200 bg-white">
        {loading
          ? [1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse border-b border-gray-100 last:border-0"
              />
            ))
          : NOTIFICATION_TYPES.map((type, idx) => (
              <div
                key={type.key}
                className={`flex items-center justify-between gap-4 px-4 py-4 md:px-6 ${
                  idx > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {type.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {type.description}
                  </p>
                </div>
                <Toggle
                  checked={prefs[type.key]}
                  onChange={(v) => update(type.key, v)}
                  disabled={saving}
                />
              </div>
            ))}
      </div>
    </div>
  );
}
