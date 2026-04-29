"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Closure = {
  id: string;
  closure_date: string;
  label: string;
  reason: string | null;
  created_at: string;
};

export default function ClosuresClient() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [cancelSessions, setCancelSessions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const loadClosures = useCallback(async () => {
    const res = await fetch("/api/studio/closures");
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setClosures(data.closures ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClosures();
  }, [loadClosures]);

  function showToast(message: string) {
    setToast(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3000);
    setTimeout(() => setToast(null), 3300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date || !label.trim()) {
      setError("Date and label are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/studio/closures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closure_date: date,
        label: label.trim(),
        reason: reason.trim() || undefined,
        cancel_sessions: cancelSessions,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to add closure");
      return;
    }

    const result = await res.json();
    const summary =
      result.sessions_cancelled > 0
        ? `Closure added · ${result.sessions_cancelled} session(s) cancelled, ${result.bookings_cancelled} booking(s) refunded`
        : "Closure added";
    showToast(summary);
    setShowForm(false);
    setDate("");
    setLabel("");
    setReason("");
    setCancelSessions(true);
    await loadClosures();
  }

  async function handleDelete(id: string) {
    const ok = window.confirm(
      "Remove this closure? Cancelled sessions will not be restored automatically."
    );
    if (!ok) return;
    const res = await fetch(`/api/studio/closures?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Failed to remove closure");
      return;
    }
    showToast("Closure removed");
    await loadClosures();
  }

  // Today in YYYY-MM-DD for the date input min.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">
            ←
          </span>
          Settings
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        Studio Closures
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Mark holidays, vacations, or maintenance days. All classes on a
        closure date can be cancelled with one click — credits and pass uses
        are refunded automatically.
      </p>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-50 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toastOpen ? "toast-enter-top" : "toast-exit-top"
          }`}
        >
          {toast}
        </div>
      )}

      <div className="mt-6 card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Upcoming closures
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {closures.length === 0
                ? "No upcoming closures."
                : `${closures.length} upcoming day(s) marked closed.`}
            </p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setError(null);
              }}
              className="btn-primary"
            >
              + Add closure
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="panel-enter mt-4 space-y-3 rounded-lg border border-brand-200 bg-brand-50 p-4"
          >
            {error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Independence Day"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Internal note (members do not see this)"
                className="input-field w-full"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={cancelSessions}
                onChange={(e) => setCancelSessions(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Also cancel every class session on this date and refund
                affected members&apos; credits / pass uses.
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <span className="label-swap" data-pending={saving}>
                  {saving ? "Saving..." : "Add closure"}
                </span>
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : closures.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-200">
            {closures.map((c, idx) => (
              <li
                key={c.id}
                className="stagger-item flex items-center justify-between py-3"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div>
                  <p className="font-medium text-gray-900">{c.label}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(c.closure_date)}
                    {c.reason ? <> · {c.reason}</> : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-sm text-red-600 transition-colors duration-150 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : !showForm ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">
              No closures yet. Add one above when you need to close the studio
              for a holiday or vacation day.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(yyyyMmDd: string): string {
  // Render in the user's locale; closure_date is a calendar date,
  // not a timestamp, so we use UTC parsing to avoid timezone shifts.
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString(
    undefined,
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );
}
