"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/activity/format-relative-time";
import type {
  ActivityCategory,
  ActivityEvent,
  ActivitySeverity,
} from "@/lib/activity/types";

const severityBorder: Record<ActivitySeverity, string> = {
  critical: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-amber-500",
  success: "border-l-4 border-l-emerald-500",
  info: "border-l-4 border-l-transparent",
};

const categoryPill: Record<
  ActivityCategory,
  { label: string; classes: string }
> = {
  booking: { label: "Booking", classes: "bg-blue-50 text-blue-700" },
  billing: { label: "Billing", classes: "bg-violet-50 text-violet-700" },
  operations: { label: "Operations", classes: "bg-slate-100 text-slate-700" },
  member: { label: "Member", classes: "bg-teal-50 text-teal-700" },
  announcement: { label: "Announcement", classes: "bg-gray-100 text-gray-600" },
  alert: { label: "Alert", classes: "bg-red-50 text-red-700" },
};

export function ActivityFeedItem({ event }: { event: ActivityEvent }) {
  const pill = categoryPill[event.category];
  const [relative, setRelative] = useState(() =>
    formatRelativeTime(event.occurredAt),
  );
  useEffect(() => {
    setRelative(formatRelativeTime(event.occurredAt));
    const id = window.setInterval(() => {
      setRelative(formatRelativeTime(event.occurredAt));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [event.occurredAt]);

  const interactive = !!event.ctaHref;
  const baseClasses = `group relative flex items-center gap-2.5 bg-white px-4 py-2.5 md:px-6 ${severityBorder[event.severity]}`;
  const interactiveClasses = interactive
    ? "motion-safe:transition-colors motion-safe:duration-150 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    : "";

  const body = (
    <>
      {event.unread && (
        <span
          className="pointer-events-none absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-500"
          aria-label="Unread"
        />
      )}
      <span
        className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${pill.classes}`}
      >
        {pill.label}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-gray-900">
        <span className="font-medium">{event.title}</span>
        {event.subtitle && (
          <>
            <span className="mx-1.5 text-gray-300" aria-hidden="true">
              ·
            </span>
            <span className="text-gray-500">{event.subtitle}</span>
          </>
        )}
      </p>
      {event.actionRequired && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Action needed
        </span>
      )}
      <span
        className="shrink-0 text-xs tabular-nums text-gray-500"
        suppressHydrationWarning
      >
        {relative}
      </span>
      {interactive && (
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-gray-300 motion-safe:transition motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:text-gray-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </>
  );

  if (interactive) {
    return (
      <Link
        href={event.ctaHref!}
        title={event.ctaLabel}
        className={`${baseClasses} ${interactiveClasses}`}
      >
        {body}
      </Link>
    );
  }

  return <div className={baseClasses}>{body}</div>;
}
