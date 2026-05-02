"use client";

import { useEffect, useState } from "react";
import { ChevronRight, History } from "lucide-react";

/**
 * Per-template change history. Hidden by default behind a disclosure
 * toggle so the template page stays focused on the form for the
 * day-to-day "edit + scroll Upcoming Sessions" flow. When opened, it
 * fetches the audit log lazily and renders one row per material change.
 *
 * Jamie feedback 2026-04-30: "Is it possible to document changes to
 * classes within the class template and optionally display them via a
 * toggle?" → toggle = the disclosure below; the per-class log surfaces
 * both template-level edits (price/duration/instructor) and the
 * session-level edits that drive contracted hours (instructor swaps,
 * cancellations, hours_returned overrides).
 */

type Entry = {
  id: string;
  change_type: string;
  summary: string;
  actor_name: string | null;
  actor_role: string | null;
  session_id: string | null;
  created_at: string;
};

const COLOR: Record<string, string> = {
  session_instructor_changed: "bg-blue-50 text-blue-700",
  template_instructor_changed: "bg-blue-50 text-blue-700",
  session_time_changed: "bg-violet-50 text-violet-700",
  session_date_changed: "bg-violet-50 text-violet-700",
  session_room_changed: "bg-violet-50 text-violet-700",
  session_cancelled: "bg-rose-50 text-rose-700",
  session_uncancelled: "bg-emerald-50 text-emerald-700",
  session_hours_returned: "bg-amber-50 text-amber-700",
  template_price_changed: "bg-emerald-50 text-emerald-700",
  template_duration_changed: "bg-violet-50 text-violet-700",
  template_capacity_changed: "bg-gray-100 text-gray-700",
  template_updated: "bg-gray-100 text-gray-700",
};

export default function TemplateHistory({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || entries !== null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/class-templates/${templateId}/history`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error || "Failed to load history");
          return;
        }
        const data = (await res.json()) as { entries: Entry[] };
        if (!cancelled) setEntries(data.entries);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, entries, templateId]);

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-900 transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
      >
        <ChevronRight
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <History className="h-4 w-4 text-gray-400" aria-hidden />
        <span className="flex-1">Change history</span>
        {entries !== null && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div className="panel-enter border-t border-gray-100 px-4 pb-4 pt-3">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          )}
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {!loading && !error && entries && entries.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              No changes yet. Edits to this class — instructor swaps,
              reschedules, cancellations — will appear here as they happen.
            </p>
          )}
          {!loading && !error && entries && entries.length > 0 && (
            <ol className="space-y-2">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-50"
                >
                  <span
                    className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      COLOR[e.change_type] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {labelFor(e.change_type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-900">{e.summary}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {actorPrefix(e)} · {formatRelative(e.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(changeType: string): string {
  switch (changeType) {
    case "session_instructor_changed":
    case "template_instructor_changed":
      return "Instructor";
    case "session_time_changed":
      return "Time";
    case "session_date_changed":
      return "Date";
    case "session_room_changed":
      return "Room";
    case "session_cancelled":
      return "Cancelled";
    case "session_uncancelled":
      return "Restored";
    case "session_hours_returned":
      return "Hours";
    case "template_price_changed":
      return "Price";
    case "template_duration_changed":
      return "Duration";
    case "template_capacity_changed":
      return "Capacity";
    case "template_updated":
      return "Edited";
    default:
      return "Change";
  }
}

function actorPrefix(e: Entry): string {
  if (e.actor_name) return `${e.actor_name}${e.actor_role ? ` · ${e.actor_role}` : ""}`;
  if (e.actor_role) return e.actor_role;
  return "System";
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffSec = (Date.now() - t) / 1000;
  if (diffSec < 60) return "just now";
  if (diffSec < 60 * 60) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 60 * 60 * 24) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 60 * 60 * 24 * 7) return `${Math.floor(diffSec / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}
