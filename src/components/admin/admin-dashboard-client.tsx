"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminLocale } from "@/lib/admin/locale-context";

type AlertItem = { type: string; studioName: string; studioId: string; extra?: string };
type ActivityItem = { at: string; icon: string; textKey: string; textParams?: Record<string, string | number> };

export default function AdminDashboardClient({
  totalStudios,
  activeCount,
  MRR,
  pastDueCount,
  trialingCount,
  trialsEnding7d,
  ARR,
  activeCouponsCount,
  alerts,
  activities,
}: {
  totalStudios: number;
  activeCount: number;
  MRR: number;
  pastDueCount: number;
  trialingCount: number;
  trialsEnding7d: number;
  ARR: number;
  activeCouponsCount: number;
  alerts: AlertItem[];
  activities: ActivityItem[];
}) {
  const { t, formatDate, formatDateTime } = useAdminLocale();
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function handleSendTestEmail() {
    const to = testEmailTo.trim();
    if (!to) {
      setTestEmailMessage({ type: "error", text: "Email is required" });
      return;
    }
    setTestEmailMessage(null);
    setTestEmailLoading(true);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestEmailMessage({ type: "error", text: data.error || "Failed to send" });
        return;
      }
      setTestEmailMessage({ type: "ok", text: `Test email sent to ${to}` });
      setTestEmailTo("");
    } finally {
      setTestEmailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("dashboard.title")}</h1>

      {/* テスト用: メール送信チェック（確認後削除） */}
      <div className="rounded-lg border border-amber-700 bg-amber-900/30 p-4">
        <h2 className="text-sm font-medium text-amber-200">Test email (temporary)</h2>
        <p className="mt-1 text-xs text-slate-400">Send a test email to verify delivery. Remove this block after testing.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            placeholder="your@email.com"
            className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500"
          />
          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={testEmailLoading}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {testEmailLoading ? "Sending…" : "Send test email"}
          </button>
        </div>
        {testEmailMessage && (
          <p className={`mt-2 text-sm ${testEmailMessage.type === "ok" ? "text-green-400" : "text-red-400"}`}>
            {testEmailMessage.text}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.totalStudios")}</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalStudios}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.active")}</p>
          <p className="mt-1 text-2xl font-bold text-white">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.mrr")}</p>
          <p className="mt-1 text-2xl font-bold text-white">${MRR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.pastDue")}</p>
          <p className={`mt-1 text-2xl font-bold ${pastDueCount > 0 ? "text-red-400" : "text-white"}`}>
            {pastDueCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.trialing")}</p>
          <p className="mt-1 text-xl font-bold text-white">{trialingCount}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.trialsEnding7d")}</p>
          <p className="mt-1 text-xl font-bold text-white">{trialsEnding7d}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.arr")}</p>
          <p className="mt-1 text-xl font-bold text-white">${ARR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.activeCoupons")}</p>
          <p className="mt-1 text-xl font-bold text-white">{activeCouponsCount}</p>
        </div>
      </div>

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
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {a.type === "past_due" && `${t("alerts.paymentFailed")}: ${a.studioName}`}
                  {a.type === "grace" && `${t("alerts.gracePeriod")}: ${a.studioName} – ${t("alerts.gracePeriodExtra", { days: parseInt(String(a.extra).replace(/\D/g, ""), 10) || 0 })}`}
                  {a.type === "trial" && `${t("alerts.trialEnding")}: ${a.studioName} – ${t("alerts.trialEndingExtra", { days: parseInt(String(a.extra).replace(/\D/g, ""), 10) || 0 })}`}
                  {a.type === "canceled" && `${t("alerts.recentlyCanceled")}: ${a.studioName}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-300">{t("dashboard.recentActivity")}</h2>
        <ul className="mt-3 space-y-2">
          {activities.length === 0 ? (
            <li className="text-sm text-slate-500">{t("dashboard.noRecentActivity")}</li>
          ) : (
            activities.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-slate-500">{formatDateTime(a.at)}</span>
                <span>{a.icon}</span>
                <span>{t(a.textKey, a.textParams)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
