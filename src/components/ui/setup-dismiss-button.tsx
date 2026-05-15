"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { csrfFetch } from "@/lib/api/csrf-client";

export function SetupDismissButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    if (busy) return;
    setBusy(true);
    try {
      await csrfFetch("/api/dashboard/prefs", {
        method: "POST",
        body: JSON.stringify({ setup_checklist_dismissed: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={dismiss}
      disabled={busy}
      aria-label="Dismiss setup checklist"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 6l8 8M14 6l-8 8"
        />
      </svg>
    </button>
  );
}
