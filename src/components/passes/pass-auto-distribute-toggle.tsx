"use client";

import { useState } from "react";

type Props = {
  passId: string;
  initialValue: boolean;
};

export default function PassAutoDistributeToggle({ passId, initialValue }: Props) {
  const [enabled, setEnabled] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/passes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId, auto_distribute: !enabled }),
      });
      if (res.ok) {
        setEnabled(!enabled);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">Auto-distribute:</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={loading}
        onClick={toggle}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          enabled ? "bg-brand-600" : "bg-gray-300"
        } ${loading ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-xs text-gray-400">
        {enabled
          ? "Payouts are sent automatically on the 1st."
          : "You review and approve before sending."}
      </span>
    </div>
  );
}
