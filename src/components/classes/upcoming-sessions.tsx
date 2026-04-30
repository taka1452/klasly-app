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
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Upcoming Sessions ({activeSessions.length})
      </h3>

      {activeSessions.length === 0 && cancelledSessions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No upcoming sessions scheduled for this class.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                session.is_cancelled
                  ? "border-gray-100 bg-gray-50 opacity-60"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
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
                ) : confirmCancel === session.id ? (
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
    </div>
  );
}
