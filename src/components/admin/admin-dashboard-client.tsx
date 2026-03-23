"use client";

import Link from "next/link";
import { useAdminLocale } from "@/lib/admin/locale-context";
import RegistrationFunnel from "./RegistrationFunnel";
import UserJourneyTable from "./UserJourneyTable";

type AlertItem = { type: string; studioName: string; studioId: string; extra?: string };
type ActivityItem = { at: string; type: "signed_up" | "paid" | "failed" | "canceled"; textKey: string; textParams?: Record<string, string | number> };

export default function AdminDashboardClient({
  totalStudios,
  activeCount,
  MRR,
  ARR,
  pastDueCount,
  trialingCount,
  trialsEnding7d,
  newSignupsToday,
  newSignupsWeek,
  revenueThisMonth,
  revenueLastMonth,
  alerts,
  activities,
}: {
  totalStudios: number;
  activeCount: number;
  MRR: number;
  ARR: number;
  pastDueCount: number;
  trialingCount: number;
  trialsEnding7d: number;
  newSignupsToday: number;
  newSignupsWeek: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  alerts: AlertItem[];
  activities: ActivityItem[];
}) {
  const { t, formatDateTime } = useAdminLocale();

  const revenueGrowth = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("dashboard.title")}</h1>

      {/* ── Row 1: Revenue & Core KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("kpi.totalStudios")} value={totalStudios} />
        <KpiCard label={t("kpi.active")} value={activeCount} />
        <KpiCard label={t("kpi.mrr")} value={`$${MRR.toFixed(0)}`} />
        <KpiCard label={t("kpi.arr")} value={`$${ARR.toFixed(0)}`} />
      </div>

      {/* ── Row 2: Revenue actuals + Trial/Payment KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* 売上実体 - 今月 */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Revenue (this month)</p>
          <p className="mt-1 text-2xl font-bold text-white">
            ${(revenueThisMonth / 100).toFixed(0)}
          </p>
          {revenueLastMonth > 0 && (
            <p className={`mt-1 text-xs ${revenueGrowth >= 0 ? "text-green-400" : "text-red-400"}`}>
              {revenueGrowth >= 0 ? "↑" : "↓"} {Math.abs(revenueGrowth)}% vs last month
            </p>
          )}
        </div>

        <KpiCard
          label={t("kpi.pastDue")}
          value={pastDueCount}
          highlight={pastDueCount > 0 ? "red" : undefined}
        />
        <KpiCard label={t("kpi.trialing")} value={trialingCount} />
        <KpiCard label={t("kpi.trialsEnding7d")} value={trialsEnding7d} />
      </div>

      {/* ── Row 3: New Signups ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 lg:col-span-2">
          <p className="text-sm text-slate-400">{t("kpi.newSignups")}</p>
          <div className="mt-1 flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-bold text-white">{newSignupsToday}</span>
              <span className="ml-1 text-xs text-slate-500">{t("kpi.today")}</span>
            </div>
            <div>
              <span className="text-xl font-bold text-slate-300">{newSignupsWeek}</span>
              <span className="ml-1 text-xs text-slate-500">{t("kpi.thisWeek")}</span>
            </div>
          </div>
        </div>
        {/* 先月売上 */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 lg:col-span-2">
          <p className="text-sm text-slate-400">Revenue (last month)</p>
          <p className="mt-1 text-2xl font-bold text-slate-300">
            ${(revenueLastMonth / 100).toFixed(0)}
          </p>
        </div>
      </div>

      {/* ── Registration Funnel ── */}
      <RegistrationFunnel />

      {/* ── User Journey Table ── */}
      <UserJourneyTable />

      {/* ── Alerts ── */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-300">{t("alerts.title")}</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-green-400">{t("alerts.allClear")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((a) => (
              <li key={`${a.studioId}-${a.type}`}>
                <Link
                  href={`/admin/studios/${a.studioId}`}
                  className={`block rounded px-3 py-2 text-sm ${
                    a.type === "past_due" || a.type === "grace"
                      ? "bg-red-900/50 text-red-200 hover:bg-red-900/70"
                      : a.type === "trial"
                        ? "bg-yellow-900/50 text-yellow-200 hover:bg-yellow-900/70"
                        : a.type === "stale"
                          ? "bg-amber-900/50 text-amber-200 hover:bg-amber-900/70"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {a.type === "past_due" && `${t("alerts.paymentFailed")}: ${a.studioName}`}
                  {a.type === "grace" && `${t("alerts.gracePeriod")}: ${a.studioName} – ${t("alerts.gracePeriodExtra", { days: parseInt(String(a.extra).replace(/\D/g, ""), 10) || 0 })}`}
                  {a.type === "trial" && `${t("alerts.trialEnding")}: ${a.studioName} – ${t("alerts.trialEndingExtra", { days: parseInt(String(a.extra).replace(/\D/g, ""), 10) || 0 })}`}
                  {a.type === "canceled" && `${t("alerts.recentlyCanceled")}: ${a.studioName}`}
                  {a.type === "stale" && `${t("alerts.stale")}: ${a.studioName} – ${t("alerts.staleExtra", { days: parseInt(a.extra ?? "0", 10) })}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Recent Activity ── */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-300">{t("dashboard.recentActivity")}</h2>
        <ul className="mt-3 space-y-2">
          {activities.length === 0 ? (
            <li className="text-sm text-slate-500">{t("dashboard.noRecentActivity")}</li>
          ) : (
            activities.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-slate-500">{formatDateTime(a.at)}</span>
                <span
                  className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                    a.type === "signed_up"
                      ? "bg-slate-600 text-slate-200"
                      : a.type === "paid"
                        ? "bg-green-900/50 text-green-300"
                        : a.type === "failed"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {a.type === "signed_up" ? "New" : a.type === "paid" ? "Paid" : a.type === "failed" ? "Failed" : "Canceled"}
                </span>
                <span>{t(a.textKey, a.textParams)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "red" | "green";
}) {
  const textColor = highlight === "red" && Number(value) > 0
    ? "text-red-400"
    : highlight === "green"
      ? "text-green-400"
      : "text-white";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
