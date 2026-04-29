"use client";

import { useEffect, useMemo, useState } from "react";

type Session = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  title?: string | null;
};

type Props = {
  session: Session;
  onClose: () => void;
  onSaved: (updated: {
    session_date: string;
    start_time: string;
    end_time: string;
    title?: string | null;
  }) => void;
};

/**
 * Single-session edit modal. Lets owners/managers change an individual
 * class session's date, start time, end time and title without having to
 * cancel it and schedule a new one.
 *
 * Jamie feedback 2026-04: "I added a class... but accidentally put the wrong
 * day of the week. Right now, my only option is to cancel every session and
 * then re-add the correct day."
 *
 * Jamie feedback 2026-04-28 ("Editing error"): native HTML5 `required`
 * combined with a possibly-empty `end_time` produced a persistent
 * "Invalid value" tooltip from the browser even when the entered time was
 * fine. We now drop `required`, default a missing `end_time` to start+60m,
 * and surface our own validation errors inline.
 */
export default function SessionEditModal({ session, onClose, onSaved }: Props) {
  // Always normalise to HH:MM (5 chars) so <input type="time"> always
  // receives a value its UI can render — never an empty string mid-edit.
  const initialStart = useMemo(
    () => session.start_time.slice(0, 5),
    [session.start_time]
  );
  const initialEnd = useMemo(
    () => normaliseEnd(session.end_time, initialStart),
    [session.end_time, initialStart]
  );

  const [sessionDate, setSessionDate] = useState(session.session_date);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [title, setTitle] = useState(session.title || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const start = session.start_time.slice(0, 5);
    setSessionDate(session.session_date);
    setStartTime(start);
    setEndTime(normaliseEnd(session.end_time, start));
    setTitle(session.title || "");
    setError(null);
  }, [session]);

  // Auto-shift end-time when start-time moves forward past the current end.
  // Mirrors Google Calendar behaviour: keeps the duration sensible without
  // forcing the user to retype the end.
  function handleStartChange(next: string) {
    setStartTime(next);
    if (next && endTime && toMinutes(next) >= toMinutes(endTime)) {
      setEndTime(addMinutesHHMM(next, 60));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sessionDate) {
      setError("Date is required");
      return;
    }
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      setError("Start time is required");
      return;
    }
    if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
      setError("End time is required");
      return;
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setError("End time must be after start time");
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_date: sessionDate,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        title: title.trim() || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update session");
      return;
    }

    onSaved({
      session_date: sessionDate,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      title: title.trim() || null,
    });
  }

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="modal-dialog-enter w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit session</h2>
            <p className="mt-1 text-xs text-gray-500">
              Change this single session&apos;s date and time. Other sessions in the series stay as they are.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors duration-150 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="panel-enter mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartChange(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
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

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use the class name"
              className="input-field w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
                {loading ? "Saving..." : "Save changes"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- helpers ---

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function addMinutesHHMM(hhmm: string, minutes: number): string {
  const total = toMinutes(hhmm) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

/**
 * Normalise an end-time coming from the DB. If it's null, empty, or not a
 * valid HH:MM, default to start+60m so the time picker never opens with a
 * blank value (which is what triggered the browser's "Invalid value"
 * tooltip in Jamie's feedback).
 */
function normaliseEnd(rawEnd: string | null, start: string): string {
  const candidate = (rawEnd || "").slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(candidate)) return candidate;
  if (/^\d{2}:\d{2}$/.test(start)) return addMinutesHHMM(start, 60);
  return "";
}
