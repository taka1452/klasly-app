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
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  // Bulk-select mode lets the owner cancel several upcoming sessions at once
  // (e.g. "skip the next four weeks of yoga"). Off by default; engaging it
  // hides the per-row edit/cancel actions in favour of checkboxes.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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
    setBulkReason("");
  }

  async function handleBulkCancel() {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    const reason = bulkReason.trim();
    const ids = Array.from(selectedIds);
    try {
      // Fire DELETEs in parallel — the per-session route already wraps the
      // booking refund flow, so we get correct credit / pass returns for each
      // cancellation without a dedicated bulk endpoint.
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/sessions/${id}`, {
            method: "DELETE",
            headers: reason ? { "Content-Type": "application/json" } : undefined,
            body: reason ? JSON.stringify({ reason }) : undefined,
          }).catch(() => null)
        )
      );
      // Refetch to pick up cancelled state + any side-effects.
      await fetchSessions();
      exitSelectMode();
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleCancel(sessionId: string) {
    setCancelling(sessionId);
    const reason = cancelReason.trim();
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: reason ? { "Content-Type": "application/json" } : undefined,
        body: reason ? JSON.stringify({ reason }) : undefined,
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
                  <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    Cancelled
                  </span>
                ) : selectMode ? null : confirmCancel === session.id ? (
                  <div className="panel-enter flex flex-col items-stretch gap-1.5 rounded-md border border-red-200 bg-red-50/60 p-2 sm:flex-row sm:items-center">
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
                        className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-red-700 active:scale-[0.95] disabled:opacity-50 disabled:active:scale-100"
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
                        }}
                        className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 active:scale-[0.95]"
                      >
                        Keep
                      </button>
                    </div>
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
      {selectMode && selectedIds.size > 0 && !bulkConfirmOpen && (
        <div className="panel-enter sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
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
              onClick={() => setBulkConfirmOpen(true)}
              className="btn-danger"
            >
              Cancel {selectedIds.size} session
              {selectedIds.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
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
