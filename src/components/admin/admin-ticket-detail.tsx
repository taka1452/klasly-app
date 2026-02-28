"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminLocale } from "@/lib/admin/locale-context";

type Ticket = {
  id: string;
  ticket_number: number;
  studio_id: string | null;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  studio_name?: string | null;
};

type Comment = {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
};

export default function AdminTicketDetail({
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
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [updatingMeta, setUpdatingMeta] = useState(false);

  const { t, formatDateTime } = useAdminLocale();
  const formatDate = (d: string) => formatDateTime(d);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}/comments`, {
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

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    setUpdatingMeta(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setUpdatingMeta(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    setPriority(newPriority);
    setUpdatingMeta(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setUpdatingMeta(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/support" className="text-sm text-slate-400 hover:text-white">
          ← {t("support.backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          #{ticket.ticket_number}
        </h1>
      </div>
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-lg font-medium text-white">{ticket.subject}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t("support.status")}</dt>
            <dd>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingMeta}
                className="mt-0.5 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
              >
                <option value="open">{t("support.open")}</option>
                <option value="in_progress">{t("support.inProgress")}</option>
                <option value="resolved">{t("support.resolved")}</option>
                <option value="closed">{t("support.closed")}</option>
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("support.priority")}</dt>
            <dd>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                disabled={updatingMeta}
                className="mt-0.5 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
              >
                <option value="low">{t("support.low")}</option>
                <option value="medium">{t("support.medium")}</option>
                <option value="high">{t("support.high")}</option>
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("support.studio")}</dt>
            <dd className="text-white">
              {ticket.studio_id ? (
                <Link href={`/admin/studios/${ticket.studio_id}`} className="text-indigo-400 hover:underline">
                  {ticket.studio_name ?? ticket.studio_id}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("support.createdBy")}</dt>
            <dd className="text-white">{ticket.created_by}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("support.createdAt")}</dt>
            <dd className="text-slate-300">{formatDate(ticket.created_at)}</dd>
          </div>
        </dl>
        {ticket.description && (
          <div className="mt-4 border-t border-slate-700 pt-4">
            <dt className="text-slate-500">{t("support.description")}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-white">{ticket.description}</dd>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">Comments</h3>
        <ul className="mt-4 space-y-4">
          {comments.length === 0 ? (
            <li className="text-sm text-slate-500">{t("common.noData")}</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded border border-slate-600 bg-slate-900/50 p-3">
                <p className="whitespace-pre-wrap text-sm text-white">{c.content}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {c.created_by} · {formatDate(c.created_at)}
                </p>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={handleAddComment} className="mt-4 border-t border-slate-700 pt-4">
          <label className="block text-sm text-slate-400">{t("support.addComment")}</label>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder={t("support.reply")}
            className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="mt-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "…" : t("support.addComment")}
          </button>
        </form>
      </div>
    </div>
  );
}
