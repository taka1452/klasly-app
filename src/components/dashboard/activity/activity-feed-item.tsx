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

  return (
    <div
      className={`relative flex items-start gap-3 bg-white px-4 py-3 transition-colors hover:bg-gray-50 md:px-6 ${severityBorder[event.severity]}`}
    >
      {event.unread && (
        <span
          className="absolute left-2 top-5 h-1.5 w-1.5 rounded-full bg-brand-500"
          aria-label="Unread"
        />
      )}
      <div className="min-w-0 flex-1 pl-2">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${pill.classes}`}
          >
            {pill.label}
          </span>
          <span className="text-xs text-gray-500" suppressHydrationWarning>
            {relative}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-900">{event.title}</p>
        {event.subtitle && (
          <p className="mt-0.5 text-xs text-gray-500">{event.subtitle}</p>
        )}
        {event.ctaLabel && event.ctaHref && (
          <Link
            href={event.ctaHref}
            className="mt-2 inline-flex items-center text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            {event.ctaLabel} →
          </Link>
        )}
      </div>
      {event.actionRequired && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          Action needed
        </span>
      )}
    </div>
  );
}
