"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminLocale } from "@/lib/admin/locale-context";

type PaymentRow = {
  id: string;
  studio_id: string;
  amount: number;
  type: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
};

const DEMO_MRR = 2450;
const DEMO_ARR = 29400;
const DEMO_REVENUE = 3200;
const DEMO_PASTDUE = 1;
const DEMO_PAYMENTS: PaymentRow[] = [
  { id: "demo-1", studio_id: "demo-s1", amount: 1900, type: "monthly", status: "paid", paid_at: "2026-03-15T10:00:00Z", created_at: "2026-03-15T10:00:00Z" },
  { id: "demo-2", studio_id: "demo-s2", amount: 19000, type: "yearly", status: "paid", paid_at: "2026-03-12T10:00:00Z", created_at: "2026-03-12T10:00:00Z" },
  { id: "demo-3", studio_id: "demo-s3", amount: 1900, type: "monthly", status: "paid", paid_at: "2026-03-10T10:00:00Z", created_at: "2026-03-10T10:00:00Z" },
  { id: "demo-4", studio_id: "demo-s1", amount: 1900, type: "monthly", status: "past_due", paid_at: null, created_at: "2026-03-08T10:00:00Z" },
  { id: "demo-5", studio_id: "demo-s4", amount: 1900, type: "monthly", status: "paid", paid_at: "2026-03-05T10:00:00Z", created_at: "2026-03-05T10:00:00Z" },
];
const DEMO_NAMES: Record<string, string> = {
  "demo-s1": "Sunrise Yoga Studio",
  "demo-s2": "FitLife Gym",
  "demo-s3": "Zen Wellness Center",
  "demo-s4": "FlowState Pilates",
};

export default function AdminBillingClient({
  MRR,
  ARR,
  revenueThisMonth,
  pastDueCount,
  recentPayments,
  nameById,
}: {
  MRR: number;
  ARR: number;
  revenueThisMonth: number;
  pastDueCount: number;
  recentPayments: PaymentRow[];
  nameById: Record<string, string>;
}) {
  const { t, formatDate } = useAdminLocale();
  const [demoMode, setDemoMode] = useState(false);

  const displayMRR = demoMode ? DEMO_MRR : MRR;
  const displayARR = demoMode ? DEMO_ARR : ARR;
  const displayRevenue = demoMode ? DEMO_REVENUE : revenueThisMonth;
  const displayPastDue = demoMode ? DEMO_PASTDUE : pastDueCount;
  const displayPayments = demoMode ? DEMO_PAYMENTS : recentPayments;
  const displayNames = demoMode ? DEMO_NAMES : nameById;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("billing.title")}</h1>
          <p className="text-slate-400">{t("billing.subtitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-500"
          />
          Demo
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-500 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30"
        >
          {t("billing.openStripeDashboard")} →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.mrr")}</p>
          <p className="mt-1 text-2xl font-bold text-white">${displayMRR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("kpi.arr")}</p>
          <p className="mt-1 text-2xl font-bold text-white">${displayARR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("billing.revenueThisMonth")}</p>
          <p className="mt-1 text-2xl font-bold text-white">${displayRevenue.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">{t("billing.pastDueStudios")}</p>
          <p className={`mt-1 text-2xl font-bold ${displayPastDue > 0 ? "text-red-400" : "text-white"}`}>
            {displayPastDue}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-sm font-medium text-slate-300">{t("billing.recentPayments")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-left text-slate-400">
                <th className="p-2">{t("billing.date")}</th>
                <th className="p-2">{t("billing.studio")}</th>
                <th className="p-2">{t("billing.amount")}</th>
                <th className="p-2">{t("billing.type")}</th>
                <th className="p-2">{t("billing.status")}</th>
              </tr>
            </thead>
            <tbody>
              {displayPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-slate-500">
                    {t("billing.noPayments")}
                  </td>
                </tr>
              ) : (
                displayPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700">
                    <td className="p-2 text-white">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </td>
                    <td className="p-2">
                      {demoMode ? (
                        <span className="text-indigo-400">
                          {displayNames[p.studio_id] ?? p.studio_id}
                        </span>
                      ) : (
                        <Link
                          href={`/admin/studios/${p.studio_id}`}
                          className="text-indigo-400 hover:underline"
                        >
                          {displayNames[p.studio_id] ?? p.studio_id}
                        </Link>
                      )}
                    </td>
                    <td className="p-2 text-white">${((p.amount ?? 0) / 100).toFixed(2)}</td>
                    <td className="p-2 text-slate-300">{p.type ?? "—"}</td>
                    <td className="p-2">
                      <span
                        className={
                          p.status === "paid"
                            ? "rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300"
                            : "rounded-full bg-slate-600 px-2 py-0.5 text-xs text-slate-300"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
