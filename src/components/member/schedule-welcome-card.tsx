"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";

const DISMISS_KEY = "klasly:member:welcome-dismissed";

/**
 * First-time welcome card shown on the member schedule page.
 *
 * Visible until the member dismisses it (per-device via localStorage).
 * The server already gates this by `profiles.onboarding_completed`, so
 * the only state we own here is the post-mount dismiss preference.
 */
export default function ScheduleWelcomeCard() {
  // Default to visible so the card always shows on first paint (server +
  // pre-hydration). After mount we read localStorage and hide it if the
  // member already dismissed it on this device. Keeping the SSR markup
  // and the initial client markup identical avoids any hydration warning
  // while still letting users dismiss it.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setVisible(false);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss welcome message"
        className="tap-target absolute right-1.5 top-1.5 rounded-md text-brand-700/70 transition-[transform,background-color,color] duration-150 ease-out hover:bg-brand-100 hover:text-brand-900 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="pr-10 text-base font-semibold text-brand-900">Welcome!</h2>
      <p className="mt-1 pr-10 text-sm leading-relaxed text-brand-700">
        Here&apos;s how to get started:
      </p>
      <ol className="mt-3 space-y-2 text-sm text-brand-700">
        {[
          <>
            Browse the <strong>Schedule</strong> to find classes you like
          </>,
          <>
            Click <strong>Book</strong> to reserve your spot
          </>,
          <>
            Check <strong>My Bookings</strong> to see your upcoming classes
          </>,
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-bold text-brand-800"
            >
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      <Link
        href="/help/member-guide/member-book-class"
        className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Detailed booking guide
      </Link>
    </div>
  );
}
