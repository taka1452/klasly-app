"use client";

import { useState, useCallback } from "react";
import HelpTip from "@/components/ui/help-tip";

type Props = {
  passId: string;
  initialValue: boolean;
};

export default function PassAutoDistributeToggle({ passId, initialValue }: Props) {
  const [enabled, setEnabled] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);

  const clearFeedback = useCallback(() => {
    const timer = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, []);

  async function toggle() {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/passes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId, auto_distribute: !enabled }),
      });
      if (res.ok) {
        setEnabled(!enabled);
        setFeedback("saved");
      } else {
        setFeedback("error");
      }
      clearFeedback();
    } catch {
      setFeedback("error");
      clearFeedback();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">
        Auto-distribute:
        <HelpTip
          text="ON: payouts sent automatically on the 1st. OFF: you review and approve first."
          helpSlug="studio-pass"
        />
      </span>
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
      {feedback === "saved" && (
        <span className="text-xs font-medium text-green-600">Saved</span>
      )}
      {feedback === "error" && (
        <span className="text-xs font-medium text-red-500">Failed to save</span>
      )}
    </div>
  );
}
