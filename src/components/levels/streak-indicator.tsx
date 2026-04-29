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
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
          atRisk
            ? "bg-amber-50 text-amber-900"
            : "bg-orange-50 text-orange-800"
        }`}
        title={
          atRisk
            ? `${weeks}-week streak — book this week to keep it`
            : `${weeks}-week streak`
        }
        aria-label={`${weeks} week streak${atRisk ? ", at risk" : ""}`}
      >
        <span aria-hidden="true" className="text-sm leading-none">
          🔥
        </span>
        <span className="tabular-nums">{weeks}</span>
      </span>
    );
  }

  // card variant — text colors are shades of the bg color (no gray on
  // color), so the card reads as a single tint instead of clashing.
  const tone = atRisk
    ? {
        bg: "bg-amber-50",
        border: "border-amber-200",
        title: "text-amber-950",
        body: "text-amber-900/80",
      }
    : {
        bg: "bg-orange-50",
        border: "border-orange-200",
        title: "text-orange-950",
        body: "text-orange-900/80",
      };

  return (
    <div className={`card border ${tone.border} ${tone.bg}`}>
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-2xl shadow-sm"
          aria-hidden="true"
        >
          🔥
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${tone.title}`}>
            <span className="tabular-nums">{weeks}</span>-week streak
          </p>
          <p className={`mt-0.5 text-xs ${tone.body}`}>
            {atRisk
              ? "Book a class this week to keep it alive."
              : "Nice rhythm. Keep it going."}
          </p>
        </div>
      </div>
    </div>
  );
}
