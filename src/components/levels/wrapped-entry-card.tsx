import Link from "next/link";

type Props = {
  year: number;
};

/**
 * Entry banner for /wrapped/[year]. Designed for mobile-first PWA use:
 * - Hover effects gated to non-touch pointers (prevents stuck hover on tap)
 * - Active scale gives press confirmation
 * - Decorative glow uses lighter blur to stay smooth on Safari/iOS
 */
export default function WrappedEntryCard({ year }: Props) {
  return (
    <Link
      href={`/wrapped/${year}`}
      className={[
        "group relative block overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900",
        "p-5 text-white shadow-md",
        "transition-transform duration-200 ease-out",
        "active:scale-[0.985]",
        "[@media(hover:hover)]:transition-shadow",
        "[@media(hover:hover)]:hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
      ].join(" ")}
      aria-label={`Open your ${year} Wrapped`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-fuchsia-500/30 via-amber-400/20 to-transparent blur-xl"
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            Year in review
          </p>
          <p className="mt-1 text-lg font-bold">Your {year} Wrapped</p>
          <p className="mt-1 text-xs text-white/70">
            Tap to see how your year on the mat went.
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
