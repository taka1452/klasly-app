"use client";

type Props = {
  weeks: number;
  atRisk: boolean;
  /** "compact" for the top nav, "card" for the stats page */
  variant?: "compact" | "card";
};

export default function StreakIndicator({ weeks, atRisk, variant = "compact" }: Props) {
  if (weeks <= 0) return null;

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
          atRisk
            ? "bg-amber-50 text-amber-800"
            : "bg-orange-50 text-orange-700"
        }`}
        title={
          atRisk
            ? `${weeks}-week streak — book this week to keep it`
            : `${weeks}-week streak`
        }
        aria-label={`${weeks} week streak${atRisk ? ", at risk" : ""}`}
      >
        <span aria-hidden="true">🔥</span>
        <span className="tabular-nums">{weeks}</span>
      </span>
    );
  }

  // card variant
  return (
    <div
      className={`card border ${
        atRisk
          ? "border-amber-200 bg-amber-50"
          : "border-orange-200 bg-orange-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl"
          aria-hidden="true"
        >
          🔥
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            <span className="tabular-nums">{weeks}</span>-week streak
          </p>
          <p className="mt-0.5 text-xs text-gray-700">
            {atRisk
              ? "Book a class this week to keep it alive."
              : "Nice rhythm. Keep it going."}
          </p>
        </div>
      </div>
    </div>
  );
}
