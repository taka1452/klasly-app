"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAdminLocale } from "@/lib/admin/locale-context";

type StudioRow = {
  id: string;
  name: string;
  email: string | null;
  plan_status: string;
  subscription_period: string | null;
  trial_ends_at: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  members_count: number;
};

type StatusCounts = Record<string, number>;

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past Due",
  grace: "Grace",
  canceled: "Canceled",
};

const STATUS_CLASS: Record<string, string> = {
  trialing: "bg-blue-500/20 text-blue-300",
  active: "bg-green-500/20 text-green-300",
  past_due: "bg-orange-500/20 text-orange-300",
  grace: "bg-red-500/20 text-red-300",
  canceled: "bg-slate-500/20 text-slate-400",
};

export default function AdminStudiosList({ statusCounts }: { statusCounts: StatusCounts }) {
  const { t, formatDate: formatDateLocale } = useAdminLocale();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ studios: StudioRow[]; total: number }>({ studios: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", "20");
    fetch(`/api/admin/studios?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData({ studios: d.studios ?? [], total: d.total ?? 0 });
      })
      .catch(() => setData({ studios: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [search, status, sort, page]);

  const totalPages = Math.ceil(data.total / 20) || 1;
  const formatDate = (d: string) => formatDateLocale(d);
  const trialDaysLeft = (end: string | null) => {
    if (!end) return null;
    const days = Math.ceil((new Date(end).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("studios.title")}</h1>
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder={t("studios.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex gap-1 rounded-lg border border-slate-600 bg-slate-800 p-1">
          {(["all", "trialing", "active", "past_due", "grace", "canceled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${
                status === s ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {s === "all" ? t("studios.all") : STATUS_LABELS[s] ?? s} ({statusCounts[s] ?? 0})
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="newest">{t("studios.newestFirst")}</option>
          <option value="oldest">{t("studios.oldestFirst")}</option>
          <option value="members">{t("studios.mostMembers")}</option>
          <option value="name">{t("studios.nameAZ")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t("studios.loading")}</div>
        ) : data.studios.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t("studios.noStudiosFound")}</div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-600 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">{t("studios.studioName")}</th>
                <th className="p-3 font-medium">{t("studios.ownerEmail")}</th>
                <th className="p-3 font-medium">{t("studios.planStatus")}</th>
                <th className="p-3 font-medium">{t("studios.period")}</th>
                <th className="p-3 font-medium">{t("studios.members")}</th>
                <th className="p-3 font-medium">{t("studios.created")}</th>
                <th className="p-3 font-medium">{t("studios.trialEnds")}</th>
              </tr>
            </thead>
            <tbody>
              {data.studios.map((s) => {
                const days = s.plan_status === "trialing" ? trialDaysLeft(s.trial_ends_at) : null;
                return (
                  <tr key={s.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-3">
                      <Link href={`/admin/studios/${s.id}`} className="font-medium text-white hover:text-indigo-400">
                        {s.name}
                      </Link>
                      {s.owner_name && (
                        <p className="text-xs text-slate-500">{s.owner_name}</p>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">{s.owner_email ?? "—"}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s.plan_status] ?? "bg-slate-600 text-slate-300"}`}>
                        {STATUS_LABELS[s.plan_status] ?? s.plan_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      {s.plan_status === "trialing" ? "—" : s.subscription_period ?? "—"}
                    </td>
                    <td className="p-3 text-slate-300">{s.members_count}</td>
                    <td className="p-3 text-slate-300">{formatDate(s.created_at)}</td>
                    <td className="p-3">
                      {s.plan_status === "trialing" && s.trial_ends_at ? (
                        <span className={days !== null && days <= 3 ? "text-red-400" : "text-slate-300"}>
                          {formatDate(s.trial_ends_at)}
                          {days !== null && ` (${days}d)`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {t("studios.previous")}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {t("studios.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
