"use client";

import { useEffect, useState, useCallback } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

type Preferences = {
  booking_confirmation: boolean;
  booking_cancellation: boolean;
  class_reminder: boolean;
  waitlist_promotion: boolean;
  new_message: boolean;
  studio_announcement: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
};

const defaultPrefs: Preferences = {
  booking_confirmation: true,
  booking_cancellation: true,
  class_reminder: true,
  waitlist_promotion: true,
  new_message: true,
  studio_announcement: true,
  push_enabled: true,
  email_enabled: true,
};

const notificationTypes = [
  {
    key: "booking_confirmation" as const,
    label: "Booking confirmations",
    description: "When your booking is confirmed",
  },
  {
    key: "booking_cancellation" as const,
    label: "Booking cancellations",
    description: "When a booking is cancelled",
  },
  {
    key: "class_reminder" as const,
    label: "Class reminders",
    description: "1 hour before class starts",
  },
  {
    key: "waitlist_promotion" as const,
    label: "Waitlist promotions",
    description: "When a spot opens up for you",
  },
  {
    key: "new_message" as const,
    label: "New messages",
    description: "When you receive a message",
  },
  {
    key: "studio_announcement" as const,
    label: "Studio announcements",
    description: "Updates from your studio",
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
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
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

export default function MemberSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // Load preferences
  useEffect(() => {
    fetch("/api/push/preferences")
      .then((res) => res.json())
      .then((data) => {
        setPrefs({ ...defaultPrefs, ...data });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updatePreference = useCallback(
    async (key: keyof Preferences, value: boolean) => {
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);
      setSaving(true);
      try {
        await fetch("/api/push/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.error("Failed to save preferences:", err);
        // Revert
        setPrefs(prefs);
      } finally {
        setSaving(false);
      }
    },
    [prefs]
  );

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await subscribe();
      if (success) {
        updatePreference("push_enabled", true);
      }
    } else {
      await unsubscribe();
      updatePreference("push_enabled", false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Notification Settings
        </h1>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : (
          <>
            {/* Push Notifications Master Toggle */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Push Notifications
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {!isSupported
                      ? "Not supported on this browser"
                      : permission === "denied"
                        ? "Blocked by browser. Enable in browser settings."
                        : isSubscribed
                          ? "Enabled on this device"
                          : "Receive alerts on your device"}
                  </p>
                </div>
                <Toggle
                  checked={isSubscribed && prefs.push_enabled}
                  onChange={handlePushToggle}
                  disabled={!isSupported || permission === "denied" || pushLoading}
                />
              </div>
            </div>

            {/* Email Notifications Master Toggle */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Email Notifications
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Receive email updates
                  </p>
                </div>
                <Toggle
                  checked={prefs.email_enabled}
                  onChange={(v) => updatePreference("email_enabled", v)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Notification Types */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3 md:px-6">
                <h2 className="text-sm font-semibold text-gray-900">
                  Notification Types
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Choose which notifications you want to receive
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {notificationTypes.map((type) => (
                  <div
                    key={type.key}
                    className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {type.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {type.description}
                      </p>
                    </div>
                    <Toggle
                      checked={prefs[type.key]}
                      onChange={(v) => updatePreference(type.key, v)}
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* iOS Help */}
            {isSupported && permission === "default" && !isSubscribed && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-800">
                  <strong>iPhone users:</strong> Push notifications require
                  adding Klasly to your Home Screen. In Safari, tap the Share
                  button, then &quot;Add to Home Screen.&quot;
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
