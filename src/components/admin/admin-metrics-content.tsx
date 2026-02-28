"use client";

import Link from "next/link";
import { useAdminLocale } from "@/lib/admin/locale-context";

type WebhookRow = { id: string; event_type: string; status: string; created_at: string };
type CronRow = { id: string; job_name: string; status: string; affected_count: number | null; started_at: string };

export default function AdminMetricsContent({
  totalStudios,
  activeCount,
  MRR,
  ARR,
  webhooks24h,
  webhooks7d,
  webhooksFailed7d,
  cronRuns7d,
  cronFailed7d,
  emailsSent7d,
  emailsFailed7d,
  eventCounts,
  recentWebhooks,
  recentCrons,
}: {
  totalStudios: number;
  activeCount: number;
  MRR: number;
  ARR: number;
  webhooks24h: number;
  webhooks7d: number;
  webhooksFailed7d: number;
  cronRuns7d: number;
  cronFailed7d: number;
  emailsSent7d: number;
  emailsFailed7d: number;
  eventCounts: Record<string, number>;
  recentWebhooks: WebhookRow[];
  recentCrons: CronRow[];
}) {
  const { t, formatDateTime } = useAdminLocale();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("metrics.title")}</h1>
      <p className="text-slate-400">{t("metrics.subtitle")}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("metrics.totalStudios")}</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalStudios}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.mrr")}</p>
          <p className="mt-1 text-2xl font-bold text-white">${MRR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.arr")}</p>
          <p className="mt-1 text-2xl font-bold text-white">${ARR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.active")}</p>
          <p className="mt-1 text-2xl font-bold text-white">{activeCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("metrics.webhooks24h")}</p>
          <p className="mt-1 text-xl font-bold text-white">{webhooks24h}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("metrics.webhooks7d")}</p>
          <p className="mt-1 text-xl font-bold text-white">{webhooks7d} / <span className="text-red-400">{webhooksFailed7d}</span></p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("metrics.cronRuns7d")}</p>
          <p className="mt-1 text-xl font-bold text-white">{cronRuns7d} / <span className="text-red-400">{cronFailed7d}</span></p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("metrics.emailsSent7d")}</p>
          <p className="mt-1 text-xl font-bold text-white">{emailsSent7d} / <span className="text-red-400">{emailsFailed7d}</span></p>
        </div>
      </div>

      {Object.keys(eventCounts).length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-300">Webhook events by type (7d)</h2>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm">
            {Object.entries(eventCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <li key={type} className="rounded bg-slate-700 px-2 py-1 text-slate-200">
                  {type}: {count}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t("logs.webhooks")}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-left text-slate-400">
                  <th className="p-2">{t("logs.time")}</th>
                  <th className="p-2">{t("logs.event")}</th>
                  <th className="p-2">{t("logs.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentWebhooks.length === 0 ? (
                  <tr><td colSpan={3} className="p-2 text-slate-500">{t("logs.noWebhookLogs")}</td></tr>
                ) : (
                  recentWebhooks.map((w) => (
                    <tr key={w.id} className="border-b border-slate-700">
                      <td className="p-2 text-slate-300">{formatDateTime(w.created_at)}</td>
                      <td className="p-2 text-white">{w.event_type}</td>
                      <td className="p-2">
                        <span className={w.status === "success" ? "text-green-400" : "text-red-400"}>{w.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link href="/admin/logs?tab=webhooks" className="mt-2 inline-block text-sm text-indigo-400 hover:underline">View all →</Link>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t("logs.cronJobs")}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-left text-slate-400">
                  <th className="p-2">{t("logs.time")}</th>
                  <th className="p-2">{t("logs.job")}</th>
                  <th className="p-2">{t("logs.status")}</th>
                  <th className="p-2">{t("logs.affected")}</th>
                </tr>
              </thead>
              <tbody>
                {recentCrons.length === 0 ? (
                  <tr><td colSpan={4} className="p-2 text-slate-500">{t("logs.noCronLogs")}</td></tr>
                ) : (
                  recentCrons.map((c) => (
                    <tr key={c.id} className="border-b border-slate-700">
                      <td className="p-2 text-slate-300">{formatDateTime(c.started_at)}</td>
                      <td className="p-2 text-white">{c.job_name}</td>
                      <td className="p-2">
                        <span className={c.status === "success" ? "text-green-400" : "text-red-400"}>{c.status}</span>
                      </td>
                      <td className="p-2 text-slate-300">{c.affected_count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link href="/admin/logs?tab=cron" className="mt-2 inline-block text-sm text-indigo-400 hover:underline">View all →</Link>
        </div>
      </div>
    </div>
  );
}
