"use client";

import Link from "next/link";
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

export default function AdminSupportList({
  tickets,
  total,
  page,
  limit,
  currentStatus,
  currentPriority,
  currentSearch,
}: {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  currentStatus: string;
  currentPriority: string;
  currentSearch: string;
}) {
  function buildQuery(updates: { status?: string; priority?: string; search?: string; page?: number }) {
    const p = new URLSearchParams();
    const status = updates.status !== undefined ? updates.status : currentStatus;
    const priority = updates.priority !== undefined ? updates.priority : currentPriority;
    const search = updates.search !== undefined ? updates.search : currentSearch;
    const pageNum = updates.page !== undefined ? updates.page : page;
    if (status) p.set("status", status);
    if (priority) p.set("priority", priority);
    if (search) p.set("search", search);
    if (pageNum > 1) p.set("page", String(pageNum));
    return p.toString();
  }

  const { t, formatDateTime } = useAdminLocale();
  const formatDate = (d: string) => formatDateTime(d);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("support.title")}</h1>
      <p className="text-slate-400">{t("support.subtitle")}</p>
      <form
        method="get"
        action="/admin/support"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4"
      >
        <div>
          <label className="block text-xs text-slate-400">{t("support.status")}</label>
          <select
            name="status"
            defaultValue={currentStatus}
            className="mt-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
          >
            <option value="">{t("logs.all")}</option>
            <option value="open">{t("support.open")}</option>
            <option value="in_progress">{t("support.inProgress")}</option>
            <option value="resolved">{t("support.resolved")}</option>
            <option value="closed">{t("support.closed")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400">{t("support.priority")}</label>
          <select
            name="priority"
            defaultValue={currentPriority}
            className="mt-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white"
          >
            <option value="">{t("logs.all")}</option>
            <option value="low">{t("support.low")}</option>
            <option value="medium">{t("support.medium")}</option>
            <option value="high">{t("support.high")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400">{t("support.search")}</label>
          <input
            type="text"
            name="search"
            defaultValue={currentSearch}
            placeholder={t("support.searchPlaceholder")}
            className="mt-1 w-48 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white placeholder-slate-500"
          />
        </div>
        <input type="hidden" name="page" value="1" />
        <button type="submit" className="rounded bg-slate-600 px-3 py-1.5 text-sm text-white hover:bg-slate-500">
          {t("support.filter")}
        </button>
      </form>

      <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-900/50 text-left text-slate-400">
                <th className="p-3">#</th>
                <th className="p-3">{t("support.subject")}</th>
                <th className="p-3">{t("support.studio")}</th>
                <th className="p-3">{t("support.status")}</th>
                <th className="p-3">{t("support.priority")}</th>
                <th className="p-3">{t("support.createdAt")}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-500">
                    {t("support.noTickets")}
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="p-3 font-mono text-slate-400">{t.ticket_number}</td>
                    <td className="p-3">
                      <Link href={`/admin/support/${t.id}`} className="text-white hover:underline">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-300">
                      {t.studio_id ? (
                        <Link href={`/admin/studios/${t.studio_id}`} className="text-indigo-400 hover:underline">
                          {t.studio_name ?? t.studio_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          t.status === "open"
                            ? "bg-amber-500/20 text-amber-300"
                            : t.status === "resolved" || t.status === "closed"
                              ? "bg-slate-600 text-slate-300"
                              : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{t.priority}</td>
                    <td className="p-3 text-slate-400">{formatDate(t.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > limit && (
          <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2 text-sm text-slate-400">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/support?${buildQuery({ page: page - 1 })}`} className="text-indigo-400 hover:underline">
                  {t("studios.previous")}
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/admin/support?${buildQuery({ page: page + 1 })}`} className="text-indigo-400 hover:underline">
                  {t("studios.next")}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
