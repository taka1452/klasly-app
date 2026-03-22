"use client";

import { useState, useEffect } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function PushPrompt({ studioId }: { studioId?: string }) {
  const { isSupported, isSubscribed, permission, isLoading, subscribe } =
    usePushNotifications(studioId);
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // localStorage で dismissal を確認
    try {
      const expiry = localStorage.getItem("klasly-push-prompt-dismissed");
      if (expiry && Date.now() < Number(expiry)) {
        setDismissed(true);
        return;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (
      isSupported &&
      !isSubscribed &&
      !isLoading &&
      permission === "default" &&
      !dismissed
    ) {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [isSupported, isSubscribed, isLoading, permission, dismissed]);

  if (!show) return null;

  const handleEnable = async () => {
    await subscribe();
    setShow(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    try {
      localStorage.setItem(
        "klasly-push-prompt-dismissed",
        String(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-blue-100 p-2">
            <svg
              className="h-5 w-5 text-brand-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Stay Updated</p>
            <p className="mt-1 text-xs text-gray-500">
              Get notified about class reminders, booking updates, and messages.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Enabling..." : "Enable Notifications"}
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
