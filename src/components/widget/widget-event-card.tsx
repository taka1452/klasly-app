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
  location_address: string | null;
  image_url: string | null;
  waitlist_enabled: boolean;
  payment_type: string;
  installment_count: number;
  options: EventOption[];
  min_price_cents: number;
  total_remaining: number;
  has_schedule: boolean;
  schedule_count: number;
  has_packing_list: boolean;
  has_access_info: boolean;
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

// Small icon components
function IconPin({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconCreditCard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
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

  // Info chips to show
  const infoChips: { icon: React.ReactNode; label: string }[] = [];
  if (event.location_name) {
    infoChips.push({ icon: <IconPin className="h-3 w-3" />, label: event.location_name });
  }
  if (daysCount > 1) {
    infoChips.push({ icon: <IconCalendar className="h-3 w-3" />, label: `${daysCount} days` });
  }
  if (event.has_schedule) {
    infoChips.push({ icon: <IconList className="h-3 w-3" />, label: `${event.schedule_count} activities` });
  }
  if (event.payment_type === "installment") {
    infoChips.push({ icon: <IconCreditCard className="h-3 w-3" />, label: `${event.installment_count} installments` });
  }

  // CTA button
  const ctaLabel = isSoldOut
    ? (event.waitlist_enabled ? "Join Waitlist" : "Sold Out")
    : "View Details";
  const ctaColor = isSoldOut
    ? (event.waitlist_enabled ? "#d97706" : "#9ca3af")
    : theme.primary;

  if (featured) {
    return (
      <a
        href={`${baseUrl}/events/${event.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-lg"
      >
        {/* Top section: image (compact) + badges */}
        <div className="relative">
          {event.image_url ? (
            <div className="h-40 w-full overflow-hidden bg-gray-100">
              <img
                src={event.image_url}
                alt={event.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          ) : (
            <div
              className="flex h-20 items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${theme.primaryLight}, ${theme.primary}20)` }}
            />
          )}

          {/* Badges */}
          <div className="absolute right-2.5 top-2.5 flex gap-1.5">
            {earlyBirdOption && (
              <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                Early Bird
              </span>
            )}
            {daysUntil > 0 && daysUntil <= 14 && !isSoldOut && (
              <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                Starts in {daysUntil}d
              </span>
            )}
          </div>

          {/* Date overlay (if has image) */}
          {event.image_url && (
            <div className="absolute bottom-2.5 left-2.5">
              <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-gray-800 shadow-sm backdrop-blur-sm">
                {formatDateRange(event.start_date, event.end_date)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Date (if no image) */}
          {!event.image_url && (
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.primary }}>
              {formatDateRange(event.start_date, event.end_date)}
            </p>
          )}

          {/* Title */}
          <h3 className="mt-1 text-base font-bold text-gray-900 leading-snug">
            {event.name}
          </h3>

          {/* Description */}
          {event.description && (
            <p className="mt-2 text-xs leading-relaxed text-gray-500 line-clamp-3">
              {event.description}
            </p>
          )}

          {/* Info chips */}
          {infoChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {infoChips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600">
                  {chip.icon}
                  {chip.label}
                </span>
              ))}
              {event.has_packing_list && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600">
                  <IconList className="h-3 w-3" />
                  Packing list
                </span>
              )}
            </div>
          )}

          {/* Room options */}
          {event.options.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {event.options.slice(0, 3).map((opt) => {
                const ebActive = opt.early_bird_price_cents != null;
                return (
                  <div key={opt.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-gray-700">{opt.name}</span>
                      {opt.remaining <= 3 && opt.remaining > 0 && (
                        <span className="text-[9px] font-semibold text-orange-500">{opt.remaining} left</span>
                      )}
                      {opt.remaining <= 0 && (
                        <span className="text-[9px] font-semibold text-red-500">Full</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      {ebActive ? (
                        <>
                          <span className="text-[10px] text-gray-300 line-through">${(opt.price_cents / 100).toFixed(0)}</span>
                          <span className="text-[11px] font-bold" style={{ color: theme.primary }}>${(opt.early_bird_price_cents! / 100).toFixed(0)}</span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-gray-900">${(opt.price_cents / 100).toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {event.options.length > 3 && (
                <p className="text-center text-[10px] text-gray-400">+{event.options.length - 3} more options</p>
              )}
            </div>
          )}

          {/* Availability bar */}
          {!isSoldOut && fillPercent > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${fillPercent}%`,
                      backgroundColor: fillPercent > 80 ? "#f97316" : theme.primary,
                    }}
                  />
                </div>
                <span className="shrink-0 text-[10px] font-medium text-gray-400">
                  <IconUsers className="mr-0.5 inline h-3 w-3" />
                  {event.total_remaining} spots
                </span>
              </div>
            </div>
          )}

          {/* Early bird deadline */}
          {earlyBirdOption?.early_bird_deadline && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-[10px] font-medium text-emerald-700">
                Early bird pricing until {new Date(earlyBirdOption.early_bird_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-4">
            <span
              className="block w-full rounded-xl py-2.5 text-center text-xs font-bold text-white transition-opacity group-hover:opacity-90"
              style={{ backgroundColor: ctaColor }}
            >
              {ctaLabel}
            </span>
          </div>
        </div>
      </a>
    );
  }

  // Compact card
  return (
    <a
      href={`${baseUrl}/events/${event.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-gray-100 bg-white p-3.5 transition-all hover:shadow-md"
    >
      <div className="flex gap-3">
        {/* Small thumbnail */}
        {event.image_url && (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
            <img src={event.image_url} alt={event.name} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.primary }}>
                {formatDateRange(event.start_date, event.end_date)}
                {daysCount > 1 && <span className="ml-1 font-normal text-gray-400">{daysCount}d</span>}
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-gray-900 line-clamp-1">{event.name}</h3>
            </div>
            {earlyBirdOption && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">
                EB
              </span>
            )}
          </div>

          {/* Info row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
            {event.location_name && (
              <span className="flex items-center gap-0.5">
                <IconPin className="h-2.5 w-2.5" />{event.location_name}
              </span>
            )}
            {event.has_schedule && (
              <span className="flex items-center gap-0.5">
                <IconCalendar className="h-2.5 w-2.5" />{event.schedule_count} activities
              </span>
            )}
          </div>

          {/* Price + CTA row */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              {earlyBirdOption ? (
                <>
                  <span className="text-[10px] text-gray-300 line-through">${(earlyBirdOption.price_cents / 100).toFixed(0)}</span>
                  <span className="text-sm font-bold" style={{ color: theme.primary }}>${(earlyBirdOption.early_bird_price_cents! / 100).toFixed(0)}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-gray-400">from</span>
                  <span className="text-sm font-bold text-gray-900">${(event.min_price_cents / 100).toFixed(0)}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!isSoldOut && event.total_remaining <= 5 && (
                <span className="text-[9px] font-semibold text-orange-500">{event.total_remaining} left</span>
              )}
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: ctaColor }}
              >
                {isSoldOut ? (event.waitlist_enabled ? "Waitlist" : "Full") : "Book"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
