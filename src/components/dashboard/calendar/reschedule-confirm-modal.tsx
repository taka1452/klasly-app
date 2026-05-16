"use client";

import { useEffect, useState } from "react";
import { type DashboardSessionData } from "./dashboard-event-card";

type Scope = "single" | "future" | "all";

type ScopeImpact = {
  recurring: boolean;
  future: { sessions: number; bookings: number };
  all: { sessions: number; bookings: number };
};

type Props = {
  session: DashboardSessionData;
  newDate: string; // YYYY-MM-DD
  newStartTime: string; // HH:MM
  onClose: () => void;
  onConfirm: (args: { scope: Scope }) => Promise<void> | void;
};

/**
 * Confirmation modal that pops after a successful drop on the calendar.
 *
 * Mirrors the patterns in `session-edit-modal.tsx` (modal-dialog-enter,
 * panel-enter, label-swap, scope radios) so drag-rescheduling and the
 * keyboard edit flow feel like the same primitive.
 *
 * Before showing the scope radios it fetches `scope-impact` and (when the
 * session has a room) `room-availability` so the user sees the blast radius
 * + any conflicts before committing.
 */
export default function RescheduleConfirmModal({
  session,
  newDate,
  newStartTime,
  onClose,
  onConfirm,
}: Props) {
  const isRecurring = !!session.recurrence_group_id;
  const [scope, setScope] = useState<Scope>("single");
  const [impact, setImpact] = useState<ScopeImpact | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC closes the modal without committing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Pull scope-impact for recurring series so the radio labels can preview
  // the blast radius. Failures are silent — informational only.
  useEffect(() => {
    if (!isRecurring) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${session.id}?action=scope-impact`);
        if (!res.ok) return;
        const data = (await res.json()) as ScopeImpact;
        if (!cancelled) setImpact(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, isRecurring]);

  // Pre-flight room conflict check. Only meaningful when the session has a
  // room — otherwise the API does the source-of-truth check anyway.
  useEffect(() => {
    if (!session.room_id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/instructor/room-availability?date=${encodeURIComponent(newDate)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          events?: Array<{
            id: string;
            room_id: string;
            start_time: string;
            end_time: string;
            title: string;
          }>;
        };
        if (cancelled) return;
        const newStart = `${newStartTime}:00`;
        const newEndMinutes = toMinutes(newStartTime) + session.duration_minutes;
        const newEnd = `${pad2(Math.floor(newEndMinutes / 60))}:${pad2(newEndMinutes % 60)}:00`;
        const clash = (data.events ?? []).find(
          (ev) =>
            ev.id !== session.id &&
            ev.room_id === session.room_id &&
            ev.start_time < newEnd &&
            ev.end_time > newStart,
        );
        if (clash) {
          setConflict(
            `Room conflict: "${clash.title}" overlaps from ${formatTime(clash.start_time)} to ${formatTime(clash.end_time)}.`,
          );
        } else {
          setConflict(null);
        }
      } catch {
        // ignore — server-side check still runs
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, session.room_id, session.duration_minutes, newDate, newStartTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onConfirm({ scope });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move session");
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="modal-dialog-enter w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-confirm-title"
      >
        <h2
          id="reschedule-confirm-title"
          className="text-lg font-semibold text-gray-900"
        >
          Move session
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Move <span className="font-medium text-gray-900">{session.class_name}</span> to{" "}
          <span className="font-medium text-gray-900">{formatLongDate(newDate)}</span>{" "}
          at{" "}
          <span className="font-medium text-gray-900">{formatTime12(newStartTime)}</span>?
        </p>

        {conflict && (
          <div
            className="panel-enter mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            role="alert"
          >
            <span className="font-semibold">Heads up:</span> {conflict} You can still
            save and the server will reject if it sticks.
          </div>
        )}

        {error && (
          <div className="panel-enter mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isRecurring && (
            <fieldset
              className="panel-enter rounded-lg border border-gray-200 bg-gray-50/60 p-3"
              aria-label="Apply move to"
            >
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Apply to
              </legend>
              <div className="space-y-1.5">
                <ScopeRadio
                  value="single"
                  current={scope}
                  onChange={setScope}
                  label="This session only"
                  hint="Only this date moves. The rest of the series stays put."
                />
                <ScopeRadio
                  value="future"
                  current={scope}
                  onChange={setScope}
                  label="This and following"
                  hint={impactHint(impact?.future)}
                />
                <ScopeRadio
                  value="all"
                  current={scope}
                  onChange={setScope}
                  label="All sessions in the series"
                  hint={impactHint(impact?.all)}
                />
              </div>
              {scope !== "single" && (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                  Date change applies only to this session. The new start time
                  fans out across {scope === "all" ? "all" : "future"} sessions.
                </p>
              )}
            </fieldset>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              <span className="label-swap" data-pending={loading}>
                {loading ? "Saving..." : saveLabel(scope, impact)}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(hhmmss: string): string {
  return formatTime12(hhmmss.slice(0, 5));
}

function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${pad2(m)} ${ampm}`;
}

function formatLongDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function impactHint(
  s: { sessions: number; bookings: number } | undefined,
): string {
  if (!s) return "";
  const sessionsPart =
    s.sessions === 1 ? "1 session" : `${s.sessions} sessions`;
  const bookingsPart =
    s.bookings === 0
      ? "no bookings"
      : s.bookings === 1
        ? "1 booking"
        : `${s.bookings} bookings`;
  return `Affects ${sessionsPart}, ${bookingsPart}.`;
}

function saveLabel(
  scope: Scope,
  impact: ScopeImpact | null,
): string {
  if (scope === "single") return "Move session";
  const target = scope === "future" ? impact?.future : impact?.all;
  if (!target) return "Move sessions";
  return `Move ${target.sessions} sessions`;
}

function ScopeRadio(props: {
  value: Scope;
  current: Scope;
  onChange: (s: Scope) => void;
  label: string;
  hint: string;
}) {
  const { value, current, onChange, label, hint } = props;
  const checked = current === value;
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors duration-150 ${
        checked
          ? "border-gray-900 bg-white shadow-sm"
          : "border-transparent hover:border-gray-300 hover:bg-white/60"
      }`}
    >
      <input
        type="radio"
        name="reschedule-scope"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 h-4 w-4 accent-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/40 focus-visible:ring-offset-1"
      />
      <span className="flex-1">
        <span className="block font-medium text-gray-900">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] text-gray-500">{hint}</span>
        )}
      </span>
    </label>
  );
}
