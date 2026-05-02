"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, X } from "lucide-react";
import SessionEditModal from "@/components/classes/session-edit-modal";

type Session = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  is_cancelled: boolean;
  room_name: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  confirmed_count: number;
  capacity: number;
  title?: string | null;
  recurrence_group_id?: string | null;
  // Cancellation policy fields (Jamie 2026-04-30). Populated only when
  // is_cancelled = true.
  cancelled_by_role?: "owner" | "manager" | "instructor" | null;
  hours_returned?: boolean | null;
};

type Props = {
  templateId: string;
};

export default function UpcomingSessions({ templateId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // Default ON: when admins cancel a session, members hear about it. They
  // can opt out per cancellation for silent fixes.
  const [notifyOnCancel, setNotifyOnCancel] = useState(true);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  // Bulk-select mode lets the owner cancel several upcoming sessions at once
  // (e.g. "skip the next four weeks of yoga"). Off by default; engaging it
  // hides the per-row edit/cancel actions in favour of checkboxes.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkNotifyMembers, setBulkNotifyMembers] = useState(true);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  // Bulk edit (Jamie 2026-04-30): "A simple way to change, update, or
  // cancel multiple sessions would be great as we sometimes need to
  // adjust them to accommodate our instructors' schedules."
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `/api/dashboard/sessions?template_id=${templateId}&start=${today}&end=2099-12-31&limit=20`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSessions(
        (data.sessions || []).map(
          (s: {
            id: string;
            session_date: string;
            start_time: string;
            end_time: string | null;
            is_cancelled: boolean;
            room_name: string | null;
            instructor_id: string | null;
            instructor_name: string | null;
            capacity: number;
            title?: string | null;
            recurrence_group_id?: string | null;
            cancelled_by_role?: "owner" | "manager" | "instructor" | null;
            hours_returned?: boolean | null;
          }) => ({
            ...s,
            confirmed_count: data.confirmedCounts?.[s.id] || 0,
          })
        )
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkConfirmOpen(false);
    setBulkEditOpen(false);
    setBulkReason("");
  }

  async function handleBulkCancel() {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    const reason = bulkReason.trim();
    const ids = Array.from(selectedIds);
    const payload: Record<string, unknown> = {};
    if (reason) payload.reason = reason;
    if (!bulkNotifyMembers) payload.notify_members = false;
    const hasBody = Object.keys(payload).length > 0;
    try {
      // Fire DELETEs in parallel — the per-session route already wraps the
      // booking refund flow, so we get correct credit / pass returns for each
      // cancellation without a dedicated bulk endpoint.
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/sessions/${id}`, {
            method: "DELETE",
            headers: hasBody ? { "Content-Type": "application/json" } : undefined,
            body: hasBody ? JSON.stringify(payload) : undefined,
          }).catch(() => null)
        )
      );
      // Refetch to pick up cancelled state + any side-effects.
      await fetchSessions();
      exitSelectMode();
    } finally {
      setBulkSubmitting(false);
      setBulkNotifyMembers(true);
    }
  }

  async function handleCancel(sessionId: string) {
    setCancelling(sessionId);
    const reason = cancelReason.trim();
    try {
      const payload: Record<string, unknown> = {};
      if (reason) payload.reason = reason;
      if (!notifyOnCancel) payload.notify_members = false;
      const hasBody = Object.keys(payload).length > 0;
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: hasBody ? { "Content-Type": "application/json" } : undefined,
        body: hasBody ? JSON.stringify(payload) : undefined,
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, is_cancelled: true } : s
          )
        );
      }
    } catch {
      // ignore
    } finally {
      setCancelling(null);
      setConfirmCancel(null);
      setCancelReason("");
      setNotifyOnCancel(true);
    }
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":").map(Number);
    const hour = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Upcoming Sessions
        </h3>
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => !s.is_cancelled);
  const cancelledSessions = sessions.filter((s) => s.is_cancelled);

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Upcoming Sessions ({activeSessions.length})
        </h3>
        {activeSessions.length >= 2 && !selectMode && (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="text-xs font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            Select multiple
          </button>
        )}
        {selectMode && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size === activeSessions.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(activeSessions.map((s) => s.id)));
                }
              }}
              className="font-medium text-gray-500 hover:text-gray-700"
            >
              {selectedIds.size === activeSessions.length
                ? "Clear"
                : "Select all"}
            </button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="font-medium text-gray-500 hover:text-gray-700"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {activeSessions.length === 0 && cancelledSessions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No upcoming sessions scheduled for this class.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ${
                session.is_cancelled
                  ? "border-gray-100 bg-gray-50 opacity-60"
                  : selectMode && selectedIds.has(session.id)
                    ? "border-brand-300 bg-brand-50/60"
                    : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                {selectMode && !session.is_cancelled && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(session.id)}
                    onChange={() => toggleSelect(session.id)}
                    aria-label={`Select session on ${formatDate(session.session_date)}`}
                    className="h-4 w-4 cursor-pointer accent-brand-600"
                  />
                )}
                <span className="font-medium text-gray-900">
                  {formatDate(session.session_date)}
                </span>
                <span className="text-gray-500">
                  {formatTime(session.start_time)}
                  {session.end_time && ` – ${formatTime(session.end_time)}`}
                </span>
                {session.room_name && (
                  <span className="text-xs text-gray-400">
                    {session.room_name}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {session.confirmed_count}/{session.capacity}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {session.is_cancelled ? (
                  <CancelledTile
                    session={session}
                    onChange={(next) => {
                      setSessions((prev) =>
                        prev.map((s) =>
                          s.id === session.id ? { ...s, hours_returned: next } : s
                        )
                      );
                    }}
                  />
                ) : selectMode ? null : confirmCancel === session.id ? (
                  <div className="panel-enter flex flex-col items-stretch gap-1.5 rounded-md border border-red-200 bg-red-50/60 p-2">
                    <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason (optional, shown to members)"
                        className="min-w-0 flex-1 rounded border border-red-200 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-300"
                        autoFocus
                        maxLength={200}
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCancel(session.id)}
                          disabled={cancelling === session.id}
                          className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-red-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                        >
                          <span className="label-swap" data-pending={cancelling === session.id}>
                            {cancelling === session.id ? "Cancelling..." : "Cancel session"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmCancel(null);
                            setCancelReason("");
                            setNotifyOnCancel(true);
                          }}
                          className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 active:scale-[0.97]"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 text-[10px] text-gray-700">
                      <input
                        type="checkbox"
                        checked={notifyOnCancel}
                        onChange={(e) => setNotifyOnCancel(e.target.checked)}
                        className="h-3.5 w-3.5 accent-gray-900"
                      />
                      <span>
                        Email confirmed members about the cancellation
                        {session.confirmed_count > 0
                          ? ` (${session.confirmed_count})`
                          : ""}
                      </span>
                    </label>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingSession(session)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-brand-50 hover:text-brand-600"
                      title="Change date or time of this session"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(session.id)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500"
                      title="Cancel this session"
                    >
                      <X className="h-3 w-3" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {editingSession && (
        <SessionEditModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            // Refetch to keep instructor name, room name, and date/time
            // all in sync regardless of scope. Cheap because the list is
            // already paginated in the API.
            fetchSessions();
            setEditingSession(null);
          }}
        />
      )}

      {/* Floating action bar — appears once at least one session is checked */}
      {selectMode && selectedIds.size > 0 && !bulkConfirmOpen && !bulkEditOpen && (
        <div className="panel-enter sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur will-change-transform">
          <p className="text-sm font-medium text-gray-700">
            {selectedIds.size} session{selectedIds.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exitSelectMode}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setBulkEditOpen(true)}
              className="btn-secondary"
            >
              Edit time / instructor
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(true)}
              className="btn-danger"
            >
              Cancel {selectedIds.size} session
              {selectedIds.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {bulkEditOpen && (
        <BulkEditModal
          sessionIds={Array.from(selectedIds)}
          onClose={() => setBulkEditOpen(false)}
          onSaved={async () => {
            await fetchSessions();
            exitSelectMode();
          }}
        />
      )}

      {/* Bulk-cancel confirmation modal */}
      {bulkConfirmOpen && (
        <div
          className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !bulkSubmitting && setBulkConfirmOpen(false)}
        >
          <div
            className="modal-dialog-enter w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Cancel {selectedIds.size} session
              {selectedIds.size === 1 ? "" : "s"}?
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Affected members will be notified, and credits / pass uses
              from confirmed bookings will be refunded automatically.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Reason (optional)
              </label>
              <input
                type="text"
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="e.g. Owner vacation, Building maintenance"
                maxLength={200}
                className="input-field w-full"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Shown to members on the cancelled tile and in the
                cancellation email.
              </p>
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={bulkNotifyMembers}
                onChange={(e) => setBulkNotifyMembers(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-gray-900"
              />
              <span>
                Email confirmed members about the cancellations. Uncheck for
                silent fixes (you&apos;ll still see the cancellation in the
                schedule).
              </span>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkConfirmOpen(false)}
                className="btn-secondary"
                disabled={bulkSubmitting}
              >
                Keep
              </button>
              <button
                type="button"
                onClick={handleBulkCancel}
                className="btn-danger"
                disabled={bulkSubmitting}
              >
                <span className="label-swap" data-pending={bulkSubmitting}>
                  {bulkSubmitting
                    ? "Cancelling…"
                    : `Cancel ${selectedIds.size}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk-edit modal — applies the same time and/or instructor to every
 * selected session. Each row is updated via a parallel PUT to
 * /api/sessions/[id] with scope=single, so we don't accidentally fan a
 * series-level change out across recurrences the user didn't pick.
 *
 * UX choices:
 * - "Don't change" is the default for every field; the user opts in to
 *   each override. This avoids accidentally rewriting time or instructor
 *   when the user only intended to change the other.
 * - Notify-members defaults ON when at least one observable change is
 *   queued — same default semantics as the per-session edit modal.
 * - Progress is reported as N applied / total. We don't try to roll
 *   back partial successes; the underlying API is idempotent for time
 *   and instructor updates so re-running is safe.
 *
 * Jamie feedback 2026-04-30: "A simple way to change, update, or cancel
 * multiple sessions would be great."
 */
function BulkEditModal({
  sessionIds,
  onClose,
  onSaved,
}: {
  sessionIds: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [changeTime, setChangeTime] = useState(false);
  const [changeInstructor, setChangeInstructor] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [instructorId, setInstructorId] = useState<string>("");
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>(
    []
  );
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/instructors");
        if (!res.ok) return;
        const data = (await res.json()) as { id: string; name: string }[];
        if (!cancelled) setInstructors(data);
      } catch {
        // ignore — picker stays empty if the fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nothingToApply = !changeTime && !changeInstructor;

  async function handleApply() {
    if (nothingToApply || sessionIds.length === 0) return;
    if (changeTime && toMin(endTime) <= toMin(startTime)) {
      setError("End time must be after start time.");
      return;
    }
    setError(null);
    setSubmitting(true);
    setProgress({ done: 0, failed: 0 });

    let done = 0;
    let failed = 0;
    await Promise.all(
      sessionIds.map(async (id) => {
        const body: Record<string, unknown> = {
          scope: "single",
          notify_members: notifyMembers,
        };
        if (changeTime) {
          body.start_time = `${startTime}:00`;
          body.end_time = `${endTime}:00`;
        }
        if (changeInstructor) {
          body.instructor_id = instructorId || null;
        }
        try {
          const res = await fetch(`/api/sessions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) done += 1;
          else failed += 1;
        } catch {
          failed += 1;
        } finally {
          setProgress({ done, failed });
        }
      })
    );

    setSubmitting(false);
    if (failed === 0) {
      await onSaved();
    } else {
      setError(
        `${done} updated, ${failed} failed. Close to refresh — failed rows kept their previous values.`
      );
    }
  }

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="modal-dialog-enter w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Edit {sessionIds.length} session{sessionIds.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Pick what you want to change. Untouched fields stay as they were.
            </p>
          </div>
        </div>

        {error && (
          <div className="panel-enter mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Time */}
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                checked={changeTime}
                onChange={(e) => setChangeTime(e.target.checked)}
                className="h-4 w-4 accent-gray-900"
              />
              Change start &amp; end time
            </label>
            {changeTime && (
              <div className="panel-enter mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    Start
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    End
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Instructor */}
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                checked={changeInstructor}
                onChange={(e) => setChangeInstructor(e.target.checked)}
                className="h-4 w-4 accent-gray-900"
              />
              Change instructor
            </label>
            {changeInstructor && (
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="input-field panel-enter mt-2 w-full"
                aria-label="Instructor"
              >
                <option value="">— Unassigned —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!nothingToApply && (
            <label className="flex items-start gap-2 rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={notifyMembers}
                onChange={(e) => setNotifyMembers(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-gray-900"
              />
              <span>
                Email confirmed members about the changes. Uncheck for silent fixes.
              </span>
            </label>
          )}
        </div>

        {progress && (
          <p className="mt-3 text-xs text-gray-500">
            {progress.done} applied
            {progress.failed > 0 ? `, ${progress.failed} failed` : ""} of{" "}
            {sessionIds.length}.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={submitting}
          >
            Keep
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn-primary"
            disabled={submitting || nothingToApply}
          >
            <span className="label-swap" data-pending={submitting}>
              {submitting
                ? `Applying… ${progress?.done ?? 0}/${sessionIds.length}`
                : `Apply to ${sessionIds.length} session${sessionIds.length === 1 ? "" : "s"}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Cancelled-tile renderer with the admin-only "Return / Revoke hours"
 * affordance. The tile shows:
 *
 * - "Cancelled" badge (always)
 * - "By teacher" / "By admin" attribution badge when known
 * - When the cancellation came from the instructor and the session
 *   currently has hours_returned=false (the default), an admin-side
 *   button to grant the hours back. When already returned, a button to
 *   revoke them (in case the admin clicked Return by mistake).
 *
 * Flip is fire-and-forget — failure rolls the local state back. We don't
 * gate this on viewer permissions client-side because the API rejects
 * non-admin callers; showing the affordance to instructors who happen to
 * land on this view does no harm beyond a 403.
 */
function CancelledTile({
  session,
  onChange,
}: {
  session: {
    id: string;
    cancelled_by_role?: "owner" | "manager" | "instructor" | null;
    hours_returned?: boolean | null;
  };
  onChange: (next: boolean) => void;
}) {
  const role = session.cancelled_by_role ?? null;
  const isInstructorCancel = role === "instructor";
  // Owner + manager collapse to "admin" — members and instructors don't
  // care about that distinction.
  const attribution: "teacher" | "admin" | null = role
    ? role === "instructor"
      ? "teacher"
      : "admin"
    : null;
  const returned = session.hours_returned !== false; // null counts as "returned"
  const [busy, setBusy] = useState(false);

  async function flip(next: boolean) {
    if (busy) return;
    setBusy(true);
    const prev = returned;
    onChange(next); // optimistic
    try {
      const res = await fetch(`/api/sessions/${session.id}/hours-returned`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours_returned: next }),
      });
      if (!res.ok) {
        onChange(prev);
      }
    } catch {
      onChange(prev);
    } finally {
      setBusy(false);
    }
  }

  // Show the flip affordance for any cancelled session, not just
  // instructor-initiated ones — admins might want to revoke hours from a
  // sub-out (e.g. teacher couldn't make it but the studio cancelled on
  // their behalf), or restore hours later for any reason.
  const canFlip = role !== null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
        Cancelled
      </span>
      {attribution && (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            attribution === "teacher"
              ? "bg-amber-100 text-amber-700"
              : "bg-blue-100 text-blue-700"
          }`}
          title={
            attribution === "teacher"
              ? "The teacher cancelled this session"
              : "An admin cancelled this session"
          }
        >
          By {attribution}
        </span>
      )}
      {canFlip && (
        <>
          <span
            className={`label-swap rounded px-1.5 py-0.5 text-[10px] font-medium ${
              returned
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
            data-pending={busy}
            title={
              returned
                ? "The minutes were returned to the instructor's monthly pool."
                : "The minutes still count against the instructor's monthly allowance."
            }
          >
            {returned ? "Hours returned" : "Hours forfeited"}
          </span>
          <button
            type="button"
            onClick={() => flip(!returned)}
            disabled={busy}
            className="inline-flex min-w-[96px] items-center justify-center rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 transition-[transform,background-color,color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            <span className="label-swap" data-pending={busy}>
              {busy ? "…" : returned ? "Revoke hours" : "Return hours"}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
