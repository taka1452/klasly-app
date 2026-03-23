"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAdminLocale } from "@/lib/admin/locale-context";

type JourneyStage = "signed_up" | "studio_created" | "payment_complete" | "tour_complete" | "active_use";

type UserJourneyItem = {
  profileId: string;
  email: string;
  studioId: string | null;
  studioName: string | null;
  stage: JourneyStage;
  createdAt: string;
  setupProgress: {
    hasClasses: boolean;
    hasInstructors: boolean;
    hasMembers: boolean;
    stripeConnect: boolean;
  };
};

const STAGE_COLORS: Record<JourneyStage, string> = {
  signed_up: "bg-slate-600 text-slate-200",
  studio_created: "bg-blue-900/50 text-blue-300",
  payment_complete: "bg-amber-900/50 text-amber-300",
  tour_complete: "bg-green-900/50 text-green-300",
  active_use: "bg-emerald-900/50 text-emerald-300",
};

const PAGE_SIZE = 20;

export default function UserJourneyTable() {
  const { t, formatDateTime } = useAdminLocale();
  const [users, setUsers] = useState<UserJourneyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const stageLabels: Record<string, string> = {
    signed_up: t("dashboard.funnel.signedUp"),
    studio_created: t("dashboard.funnel.studioCreated"),
    payment_complete: t("dashboard.funnel.paymentComplete"),
    tour_complete: t("dashboard.funnel.tourComplete"),
    active_use: t("dashboard.funnel.activeUse"),
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        stage: stageFilter,
      });
      const res = await fetch(`/api/admin/user-journey?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, stageFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">{t("dashboard.journey.title")}</h2>
        <select
          value={stageFilter}
          onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
          className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200"
        >
          <option value="all">{t("dashboard.journey.filterAll")}</option>
          {Object.entries(stageLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-slate-700" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t("dashboard.journey.noUsers")}</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-400">
                  <th className="pb-2 pr-4">{t("dashboard.journey.studioName")}</th>
                  <th className="pb-2 pr-4">{t("dashboard.journey.email")}</th>
                  <th className="pb-2 pr-4">{t("dashboard.journey.stage")}</th>
                  <th className="pb-2 pr-4">{t("dashboard.journey.setup")}</th>
                  <th className="pb-2 pr-4">{t("dashboard.journey.created")}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.profileId} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2.5 pr-4 text-slate-200">
                      {u.studioName ?? <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 text-xs">{u.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[u.stage]}`}>
                        {stageLabels[u.stage] ?? u.stage}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex gap-1.5">
                        <SetupDot label="C" done={u.setupProgress.hasClasses} />
                        <SetupDot label="I" done={u.setupProgress.hasInstructors} />
                        <SetupDot label="M" done={u.setupProgress.hasMembers} />
                        <SetupDot label="S" done={u.setupProgress.stripeConnect} />
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="py-2.5">
                      {u.studioId && (
                        <Link
                          href={`/admin/studios/${u.studioId}`}
                          className="text-xs text-brand-400 hover:text-brand-300"
                        >
                          {t("dashboard.journey.view")}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{total} users</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-700 disabled:opacity-40"
                >
                  ←
                </button>
                <span className="flex items-center">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-700 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SetupDot({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      title={`${label}: ${done ? "Done" : "Not yet"}`}
      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
        done ? "bg-green-900/50 text-green-400" : "bg-slate-700 text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}
