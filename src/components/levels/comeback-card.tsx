import Link from "next/link";

/**
 * Welcome-back banner shown to members nudged by /api/cron/comeback-nudge.
 * Renders on /my-bookings while members.comeback_card_until is in the
 * future. The attendance trigger clears that field on next attendance,
 * so the card disappears organically once they return.
 */
export default function ComebackCard() {
  return (
    <Link
      href="/schedule"
      className={[
        "group relative block overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-emerald-50 via-white to-teal-50",
        "border border-emerald-200 p-5 text-emerald-900 shadow-sm",
        "transition-transform duration-200 ease-out",
        "active:scale-[0.985]",
        "[@media(hover:hover)]:transition-shadow",
        "[@media(hover:hover)]:hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
      ].join(" ")}
      aria-label="We missed you — open the schedule"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-emerald-300/40 to-teal-300/0 blur-xl"
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/80">
            Welcome back
          </p>
          <p className="mt-1 text-lg font-bold">We missed you on the mat.</p>
          <p className="mt-1 text-sm text-emerald-800/80">
            Pick a class to ease back in — your spot is waiting.
          </p>
        </div>
        <span
          aria-hidden="true"
          className="shrink-0 text-2xl transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:translate-x-0.5"
        >
          →
        </span>
      </div>
    </Link>
  );
}
