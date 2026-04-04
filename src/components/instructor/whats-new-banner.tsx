"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "instructor_whats_new_v1";

export default function WhatsNewBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900">
            What&apos;s new
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-emerald-800">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              <span>
                <strong>Today</strong> shows your classes for today. Visit{" "}
                <strong>My Schedule</strong> for your full calendar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              <span>
                You can now <strong>mark attendance</strong> directly — tap the
                checkboxes on any session detail.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              <span>
                Book rooms from <strong>My Schedule</strong> using the{" "}
                <strong>Book a Room</strong> button.
              </span>
            </li>
          </ul>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
