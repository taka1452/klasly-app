"use client";

import { useState, useEffect } from "react";
import { Mail, Loader2 } from "lucide-react";
import ContextHelpLink from "@/components/help/context-help-link";

type Preferences = {
  email_booking_confirmation: boolean;
  email_booking_cancellation: boolean;
  email_class_changes: boolean;
  email_payment_receipts: boolean;
  email_waiver_requests: boolean;
  email_new_messages: boolean;
  email_waitlist_promotion: boolean;
  email_event_reminders: boolean;
};

const NOTIFICATION_OPTIONS: {
  key: keyof Preferences;
  label: string;
  description: string;
}[] = [
  {
    key: "email_booking_confirmation",
    label: "Booking confirmations",
    description: "When you or a member books a class",
  },
  {
    key: "email_booking_cancellation",
    label: "Cancellation notices",
    description: "When a booking is cancelled",
  },
  {
    key: "email_class_changes",
    label: "Class changes",
    description: "When a class time or details are changed",
  },
  {
    key: "email_payment_receipts",
    label: "Payment receipts",
    description: "When a payment is processed",
  },
  {
    key: "email_waiver_requests",
    label: "Waiver requests",
    description: "When a waiver needs to be signed",
  },
  {
    key: "email_new_messages",
    label: "New messages",
    description: "When you receive an in-app message",
  },
  {
    key: "email_waitlist_promotion",
    label: "Waitlist updates",
    description: "When you're promoted from a waitlist",
  },
  {
    key: "email_event_reminders",
    label: "Event reminders",
    description: "Reminders for upcoming events and retreats",
  },
];

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => res.json())
      .then((data) => {
        setPrefs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleToggle(key: keyof Preferences) {
    if (!prefs) return;
    const newValue = !prefs[key];

    setPrefs({ ...prefs, [key]: newValue });
    setSaving(key);

    try {
      await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
    } catch {
      setPrefs({ ...prefs, [key]: !newValue });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="card py-8 text-center text-sm text-gray-500">
        Unable to load notification settings. Please try again.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose which email notifications you receive.
          </p>
        </div>
        <ContextHelpLink href="/help/settings/manage-feature-flags" />
      </div>

      <div className="mt-6 card">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            Email Notifications
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {NOTIFICATION_OPTIONS.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between py-4"
            >
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium text-gray-800">
                  {option.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {option.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[option.key]}
                onClick={() => handleToggle(option.key)}
                disabled={saving === option.key}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                  prefs[option.key] ? "bg-brand-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    prefs[option.key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Important account notifications (password resets, security alerts) cannot be turned off.
      </p>
    </div>
  );
}
