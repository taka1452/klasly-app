"use client";

import { useState, useEffect, Fragment } from "react";
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
  instructors_count: number;
  classes_count: number;
  bookings_30d: number;
  revenue_30d: number;
  stripe_connect_onboarding_complete?: boolean;
  currency?: string;
  payout_model?: string;
  is_demo?: boolean;
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
  const [data, setData] = useState<{ studios: StudioRow[]; total: number; platformFeePercent: number }>({ studios: [], total: 0, platformFeePercent: 0.5 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", "20");
    params.set("show_demo", "true"); // デモスタジオも常に表示（KPI集計からは除外済み）
    fetch(`/api/admin/studios?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData({ studios: d.studios ?? [], total: d.total ?? 0, platformFeePercent: d.platformFeePercent ?? 0.5 });
      })
      .catch(() => setData({ studios: [], total: 0, platformFeePercent: 0.5 }))
      .finally(() => setLoading(false));
  }, [search, status, sort, page]);

  const totalPages = Math.ceil(data.total / 20) || 1;
  const formatDate = (d: string) => formatDateLocale(d);
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const formatCurrencyFull = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const trialDaysLeft = (end: string | null) => {
    if (!end) return null;
    const days = Math.ceil((new Date(end).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days;
  };

  // Summary: all studios total
  const totalMembers = data.studios.reduce((s, st) => s + st.members_count, 0);
  const totalRevenue30d = data.studios.reduce((s, st) => s + st.revenue_30d, 0);
  const totalFee30d = Math.round(totalRevenue30d * data.platformFeePercent / 100);

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
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex gap-1 rounded-lg border border-slate-600 bg-slate-800 p-1">
          {(["all", "trialing", "active", "past_due", "grace", "canceled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.95] ${
                status === s ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
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
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="newest">{t("studios.newestFirst")}</option>
          <option value="oldest">{t("studios.oldestFirst")}</option>
          <option value="members">{t("studios.mostMembers")}</option>
          <option value="name">{t("studios.nameAZ")}</option>
        </select>
      </div>

      {/* Revenue Summary Bar */}
      {!loading && data.studios.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Total Members</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-white">{totalMembers}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">30d Revenue (all)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-white">{formatCurrencyFull(totalRevenue30d)}</p>
          </div>
          <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">30d Platform Fee ({data.platformFeePercent}%)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-300">{formatCurrencyFull(totalFee30d)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Proj. Annual Fee</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-white">{formatCurrencyFull(totalFee30d * 12)}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t("studios.loading")}</div>
        ) : data.studios.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t("studios.noStudiosFound")}</div>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-600 text-left text-xs text-slate-400">
                <th className="w-8 p-3"></th>
                <th className="p-3 font-medium">{t("studios.studioName")}</th>
                <th className="p-3 font-medium">{t("studios.planStatus")}</th>
                <th className="p-3 font-medium">Stripe</th>
                <th className="p-3 font-medium text-right">{t("studios.members")}</th>
                <th className="p-3 font-medium text-right">Inst.</th>
                <th className="p-3 font-medium text-right">Classes</th>
                <th className="p-3 font-medium text-right">30d Book</th>
                <th className="p-3 font-medium text-right">30d Rev</th>
                <th className="p-3 font-medium text-right">Fee</th>
                <th className="p-3 font-medium">{t("studios.created")}</th>
              </tr>
            </thead>
            <tbody>
              {data.studios.map((s) => {
                const days = s.plan_status === "trialing" ? trialDaysLeft(s.trial_ends_at) : null;
                const isExpanded = expandedId === s.id;
                return (
                  <Fragment key={s.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className={`cursor-pointer border-b border-slate-700 transition-colors duration-150 ease-out ${
                      isExpanded ? "bg-slate-700/70" :
                      s.is_demo
                        ? "bg-amber-900/10 hover:bg-amber-900/20"
                        : "hover:bg-slate-700/50"
                    }`}
                  >
                    <td className="p-3 text-slate-500">
                      <svg className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/studios/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-white transition-colors duration-150 hover:text-brand-400">
                          {s.name}
                        </Link>
                        {s.is_demo && (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                            Demo
                          </span>
                        )}
                      </div>
                      {s.owner_name && (
                        <p className="text-xs text-slate-500">{s.owner_name}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s.plan_status] ?? "bg-slate-600 text-slate-300"}`}>
                        {STATUS_LABELS[s.plan_status] ?? s.plan_status}
                      </span>
                      {days !== null && days <= 3 && (
                        <span className="ml-1 text-xs text-red-400">{days}d</span>
                      )}
                    </td>
                    <td className="p-3">
                      {s.stripe_connect_onboarding_complete ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-300">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          Connected
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-600/50 px-2 py-0.5 text-xs text-slate-400">
                          Not set
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-300">{s.members_count}</td>
                    <td className="p-3 text-right tabular-nums text-slate-300">{s.instructors_count}</td>
                    <td className="p-3 text-right tabular-nums text-slate-300">{s.classes_count}</td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={s.bookings_30d > 0 ? "text-white" : "text-slate-500"}>
                        {s.bookings_30d}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={s.revenue_30d > 0 ? "text-white" : "text-slate-500"}>
                        {s.revenue_30d > 0 ? formatCurrency(s.revenue_30d) : "—"}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={s.revenue_30d > 0 ? "text-emerald-400" : "text-slate-500"}>
                        {s.revenue_30d > 0 ? formatCurrencyFull(Math.round(s.revenue_30d * data.platformFeePercent / 100)) : "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{formatDate(s.created_at)}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-slate-700 bg-slate-800/80">
                      <td colSpan={11} className="px-6 py-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs font-medium text-slate-500">{t("studios.ownerEmail")}</p>
                            <p className="mt-0.5 text-sm text-white">{s.owner_email ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">{t("studios.period")}</p>
                            <p className="mt-0.5 text-sm text-white">
                              {s.plan_status === "trialing" ? "Trial" : s.subscription_period ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">{t("studios.trialEnds")}</p>
                            <p className="mt-0.5 text-sm text-white">
                              {s.plan_status === "trialing" && s.trial_ends_at ? (
                                <span className={days !== null && days <= 3 ? "text-red-400" : ""}>
                                  {formatDate(s.trial_ends_at)}
                                  {days !== null && ` (${days}d left)`}
                                </span>
                              ) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">Currency</p>
                            <p className="mt-0.5 text-sm uppercase text-white">{s.currency ?? "usd"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">Payout Model</p>
                            <p className="mt-0.5 text-sm text-white">
                              {s.payout_model === "instructor_direct" ? (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">Collective</span>
                              ) : (
                                <span className="text-slate-300">Studio</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">30d Revenue</p>
                            <p className="mt-0.5 text-sm text-white">
                              {s.revenue_30d > 0 ? formatCurrencyFull(s.revenue_30d) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">30d Fee ({data.platformFeePercent}%)</p>
                            <p className="mt-0.5 text-sm text-emerald-400">
                              {s.revenue_30d > 0 ? formatCurrencyFull(Math.round(s.revenue_30d * data.platformFeePercent / 100)) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">Proj. Annual Fee</p>
                            <p className="mt-0.5 text-sm text-white">
                              {s.revenue_30d > 0 ? formatCurrencyFull(Math.round(s.revenue_30d * data.platformFeePercent / 100) * 12) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">Resources</p>
                            <p className="mt-0.5 text-sm text-white">
                              {s.members_count} members · {s.instructors_count} instructors · {s.classes_count} classes
                            </p>
                          </div>
                          <div className="flex items-end">
                            <Link
                              href={`/admin/studios/${s.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-brand-500/50 px-3 py-1.5 text-xs font-medium text-brand-400 transition-colors duration-150 hover:bg-brand-500/20"
                            >
                              Full Detail
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
