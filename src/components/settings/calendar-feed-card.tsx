"use client";

import { useEffect, useState } from "react";

type Status =
  | { state: "loading" }
  | { state: "off" }
  | { state: "on"; token: string; url: string };

/**
 * Card that lets the signed-in user create / regenerate / revoke a personal
 * calendar subscription URL. Used in the studio settings page; the underlying
 * feed at /api/ical/<token> handles all roles (owner / manager / instructor /
 * member) so we can drop this card anywhere a user has a settings UI.
 */
export default function CalendarFeedCard() {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [busy, setBusy] = useState<"generate" | "regenerate" | "revoke" | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/account/calendar-feed");
    if (!res.ok) {
      setStatus({ state: "off" });
      return;
    }
    const data = (await res.json()) as { token: string | null; url: string | null };
    if (data.token && data.url) {
      setStatus({ state: "on", token: data.token, url: data.url });
    } else {
      setStatus({ state: "off" });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleGenerate(action: "generate" | "regenerate") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/account/calendar-feed", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to generate calendar feed");
        return;
      }
      const data = (await res.json()) as { token: string; url: string };
      setStatus({ state: "on", token: data.token, url: data.url });
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke() {
    if (
      !window.confirm(
        "Revoke this subscription URL? Existing calendar subscriptions will stop receiving updates."
      )
    ) {
      return;
    }
    setBusy("revoke");
    setError(null);
    try {
      const res = await fetch("/api/account/calendar-feed", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to revoke");
        return;
      }
      setStatus({ state: "off" });
    } finally {
      setBusy(null);
    }
  }

  async function copyUrl() {
    if (status.state !== "on") return;
    try {
      await navigator.clipboard.writeText(status.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy. Select the text manually.");
    }
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900">Calendar feed</h3>
      <p className="mt-2 text-sm text-gray-600">
        Subscribe to your Klasly schedule from Google Calendar, Apple
        Calendar, or any iCal-compatible app. Owners and managers see every
        session; instructors see their assigned classes; members see their
        confirmed bookings.
      </p>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {status.state === "loading" && (
        <div className="mt-4 h-9 w-48 rounded bg-gray-100 animate-pulse" />
      )}

      {status.state === "off" && (
        <button
          type="button"
          onClick={() => handleGenerate("generate")}
          disabled={busy !== null}
          className="btn-primary mt-4"
        >
          <span className="label-swap" data-pending={busy === "generate"}>
            {busy === "generate" ? "Generating…" : "Generate subscribe URL"}
          </span>
        </button>
      )}

      {status.state === "on" && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={status.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Calendar subscription URL"
              className="input-field min-w-0 flex-1 font-mono text-xs"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="btn-secondary shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleGenerate("regenerate")}
              disabled={busy !== null}
              className="btn-secondary"
            >
              <span className="label-swap" data-pending={busy === "regenerate"}>
                {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={busy !== null}
              className="text-sm font-medium text-red-600 transition-colors duration-150 hover:text-red-700 disabled:opacity-50"
            >
              <span className="label-swap" data-pending={busy === "revoke"}>
                {busy === "revoke" ? "Revoking…" : "Revoke"}
              </span>
            </button>
          </div>

          <details className="mt-1 text-xs text-gray-500">
            <summary className="cursor-pointer">
              How to subscribe in Google Calendar / Apple Calendar
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Google Calendar (web):</strong> Other calendars →
                + → From URL → paste the URL above.
              </li>
              <li>
                <strong>Apple Calendar (Mac):</strong> File → New Calendar
                Subscription → paste the URL.
              </li>
              <li>
                <strong>Apple Calendar (iPhone):</strong> Settings → Calendar
                → Accounts → Add Account → Other → Add Subscribed Calendar.
              </li>
            </ul>
            <p className="mt-2">
              Your subscription refreshes automatically (typically every hour
              — exact interval depends on the calendar app).
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
