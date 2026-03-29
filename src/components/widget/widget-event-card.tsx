"use client";

import { useWidgetTheme } from "./widget-theme-provider";

type EventOption = {
  id: string;
  name: string;
  price_cents: number;
  remaining: number;
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
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", opts)} – ${e.getDate()}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

export default function WidgetEventCard({
  event,
  baseUrl,
}: {
  event: EventData;
  baseUrl: string;
}) {
  const theme = useWidgetTheme();
  const isSoldOut = event.total_remaining <= 0;
  const hasEarlyBird = event.options.some((o) => o.early_bird_price_cents != null);

  return (
    <a
      href={`${baseUrl}/events/${event.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-gray-100 bg-white overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* Image */}
      {event.image_url && (
        <div className="h-36 w-full overflow-hidden bg-gray-100">
          <img
            src={event.image_url}
            alt={event.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="p-3.5">
        {/* Date */}
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          {formatDateRange(event.start_date, event.end_date)}
        </p>

        {/* Title */}
        <h3 className="mt-1 text-sm font-bold text-gray-900 line-clamp-2">
          {event.name}
        </h3>

        {/* Location */}
        {event.location_name && (
          <p className="mt-1 text-[11px] text-gray-500">{event.location_name}</p>
        )}

        {/* Description */}
        {event.description && (
          <p className="mt-1.5 text-[11px] text-gray-400 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Footer: Price + Status */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            {hasEarlyBird && (
              <span className="mr-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                Early Bird
              </span>
            )}
            <span className="text-xs font-bold text-gray-900">
              From ${(event.min_price_cents / 100).toFixed(0)}
            </span>
          </div>
          <div>
            {isSoldOut ? (
              event.waitlist_enabled ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Waitlist
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  Sold Out
                </span>
              )
            ) : (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: theme.primary }}
              >
                Book Now
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
