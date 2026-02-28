"use client";

import { useState } from "react";
import Link from "next/link";

type Ticket = {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

export default function SupportTicketsClient({
  initialTickets,
}: {
  initialTickets: Ticket[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const subj = subject.trim();
    if (!subj) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj, description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");
      setTickets((prev) => [data.ticket, ...prev]);
      setSubject("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            New support ticket
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">New ticket</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Brief summary"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="More details..."
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Submitting…" : "Submit ticket"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Your tickets</h2>
        {tickets.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">No tickets yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200">
            {tickets.map((t) => (
              <li key={t.id} className="py-3 first:pt-0">
                <Link
                  href={`/settings/support/${t.id}`}
                  className="block font-medium text-gray-900 hover:text-brand-600"
                >
                  #{t.ticket_number} – {t.subject}
                </Link>
                <p className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.status === "open"
                        ? "bg-amber-100 text-amber-800"
                        : t.status === "resolved" || t.status === "closed"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {t.status}
                  </span>
                  <span>{formatDate(t.created_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
