"use client";

import { useWidgetTheme } from "./widget-theme-provider";

type EventOption = {
  id: string;
  name: string;
  price_cents: number;
  remaining: number;
  capacity: number;
  early_bird_price_cents: number | null;
  early_bird_deadline: string | null;
};

type EventData = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  location_name: string | null;
  image_url: string | null;
  waitlist_enabled: boolean;
  options: EventOption[];
  min_price_cents: number;
  total_remaining: number;
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (start === end) return s.toLocaleDateString("en-US", opts);
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function getDaysCount(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatEarlyBirdDeadline(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WidgetEventCard({
  event,
  baseUrl,
  featured = false,
}: {
  event: EventData;
  baseUrl: string;
  featured?: boolean;
}) {
  const theme = useWidgetTheme();
  const isSoldOut = event.total_remaining <= 0;
  const earlyBirdOption = event.options.find((o) => o.early_bird_price_cents != null);
  const daysCount = getDaysCount(event.start_date, event.end_date);
  const daysUntil = getDaysUntil(event.start_date);
  const totalCapacity = event.options.reduce((sum, o) => sum + o.capacity, 0);
  const fillPercent = totalCapacity > 0 ? Math.round(((totalCapacity - event.total_remaining) / totalCapacity) * 100) : 0;

  // Featured layout: hero-style for the first event
  if (featured) {
    return (
      <a
        href={`${baseUrl}/events/${event.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-lg"
      >
        {/* Hero image with overlay */}
        <div className="relative h-52 w-full overflow-hidden bg-gray-100">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.primaryLight}, ${theme.primary})` }}>
              <span className="text-3xl font-bold text-white/80">{event.name.charAt(0)}</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Date badge on image */}
          <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
              {formatDateRange(event.start_date, event.end_date)}
            </p>
            <p className="text-[9px] text-gray-400">{daysCount} {daysCount === 1 ? "day" : "days"}</p>
          </div>

          {/* Urgency badges */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            {earlyBirdOption && (
              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                Early Bird
              </span>
            )}
            {daysUntil > 0 && daysUntil <= 14 && !isSoldOut && (
              <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                {daysUntil}d left
              </span>
            )}
          </div>

          {/* Title on image */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-bold leading-tight text-white drop-shadow-sm">
              {event.name}
            </h3>
            {event.location_name && (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/80">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.location_name}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {event.description && (
            <p className="text-xs leading-relaxed text-gray-500 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Options preview */}
          {event.options.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.options.slice(0, 3).map((opt) => (
                <span key={opt.id} className="rounded-md bg-gray-50 px-2 py-1 text-[10px] text-gray-600">
                  {opt.name}
                  {opt.remaining <= 3 && opt.remaining > 0 && (
                    <span className="ml-1 text-orange-500">{opt.remaining} left</span>
                  )}
                </span>
              ))}
              {event.options.length > 3 && (
                <span className="rounded-md bg-gray-50 px-2 py-1 text-[10px] text-gray-400">
                  +{event.options.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Availability bar */}
          {!isSoldOut && fillPercent > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>{event.total_remaining} spots left</span>
                <span>{fillPercent}% booked</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fillPercent}%`,
                    backgroundColor: fillPercent > 80 ? "#f97316" : theme.primary,
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer: Price + CTA */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              {earlyBirdOption ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm text-gray-300 line-through">
                    ${(earlyBirdOption.price_cents / 100).toFixed(0)}
                  </span>
                  <span className="text-lg font-bold" style={{ color: theme.primary }}>
                    ${(earlyBirdOption.early_bird_price_cents! / 100).toFixed(0)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    until {formatEarlyBirdDeadline(earlyBirdOption.early_bird_deadline!)}
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-gray-400">from</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${(event.min_price_cents / 100).toFixed(0)}
                  </span>
                </div>
              )}
            </div>
            <span
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity group-hover:opacity-90"
              style={{ backgroundColor: isSoldOut ? (event.waitlist_enabled ? "#d97706" : "#9ca3af") : theme.primary }}
            >
              {isSoldOut ? (event.waitlist_enabled ? "Join Waitlist" : "Sold Out") : "View & Book"}
            </span>
          </div>
        </div>
      </a>
    );
  }

  // Compact card for non-featured events
  return (
    <a
      href={`${baseUrl}/events/${event.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex overflow-hidden rounded-xl bg-white shadow-sm transition-all hover:shadow-md"
    >
      {/* Side image */}
      <div className="relative w-28 shrink-0 overflow-hidden bg-gray-100">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.primaryLight}, ${theme.primary})` }}>
            <span className="text-xl font-bold text-white/80">{event.name.charAt(0)}</span>
          </div>
        )}
        {earlyBirdOption && (
          <div className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
            Early Bird
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.primary }}>
            {formatDateRange(event.start_date, event.end_date)}
            <span className="ml-1.5 font-normal text-gray-400">{daysCount}d</span>
          </p>
          <h3 className="mt-0.5 text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-gray-700">
            {event.name}
          </h3>
          {event.location_name && (
            <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-gray-400">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {event.location_name}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div>
            {earlyBirdOption ? (
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-gray-300 line-through">${(earlyBirdOption.price_cents / 100).toFixed(0)}</span>
                <span className="text-sm font-bold" style={{ color: theme.primary }}>${(earlyBirdOption.early_bird_price_cents! / 100).toFixed(0)}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-gray-900">${(event.min_price_cents / 100).toFixed(0)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isSoldOut && event.total_remaining <= 5 && (
              <span className="text-[9px] font-medium text-orange-500">{event.total_remaining} left</span>
            )}
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
              style={{ backgroundColor: isSoldOut ? (event.waitlist_enabled ? "#d97706" : "#9ca3af") : theme.primary }}
            >
              {isSoldOut ? (event.waitlist_enabled ? "Waitlist" : "Sold Out") : "Book"}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
