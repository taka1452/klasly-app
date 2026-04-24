"use client";

import { useEffect, useState } from "react";

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
 */
export default function SessionEditModal({ session, onClose, onSaved }: Props) {
  const [sessionDate, setSessionDate] = useState(session.session_date);
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(
    (session.end_time || "").slice(0, 5) || ""
  );
  const [title, setTitle] = useState(session.title || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionDate(session.session_date);
    setStartTime(session.start_time.slice(0, 5));
    setEndTime((session.end_time || "").slice(0, 5));
    setTitle(session.title || "");
  }, [session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sessionDate) {
      setError("Date is required");
      return;
    }
    if (!endTime) {
      setError("End time is required");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
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
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
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
                onChange={(e) => setStartTime(e.target.value)}
                required
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
                required
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
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
