"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Ticket = {
  id: string;
  ticket_number: number;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Comment = {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
};

export default function SupportTicketDetailClient({
  ticket,
  comments: initialComments,
}: {
  ticket: Ticket;
  comments: Comment[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add comment");
      setComments((prev) => [...prev, data.comment]);
      setNewComment("");
      router.refresh();
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
        <h2 className="text-lg font-semibold text-gray-900">{ticket.subject}</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium text-gray-900">{ticket.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Priority</dt>
            <dd className="font-medium text-gray-900">{ticket.priority}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-700">{formatDate(ticket.created_at)}</dd>
          </div>
        </dl>
        {ticket.description && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <dt className="text-gray-500">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{ticket.description}</dd>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900">Conversation</h3>
        <ul className="mt-4 space-y-4">
          {comments.length === 0 ? (
            <li className="text-sm text-gray-600">No replies yet. Our team will respond here.</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="whitespace-pre-wrap text-sm text-gray-900">{c.content}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {c.created_by} · {formatDate(c.created_at)}
                </p>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={handleAddComment} className="mt-6 border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700">Add a reply</label>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Type your message..."
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="btn-primary mt-2"
          >
            {submitting ? "Sending…" : "Send reply"}
          </button>
        </form>
      </div>
    </div>
  );
}
