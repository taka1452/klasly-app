"use client";

import { useState, useEffect } from "react";
import { useAdminLocale } from "@/lib/admin/locale-context";

type FunnelStage = { name: string; count: number; rate: number };

export default function RegistrationFunnel() {
  const { t } = useAdminLocale();
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/funnel-stats")
      .then((r) => r.json())
      .then((data: { stages: FunnelStage[] }) => setStages(data.stages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stageLabels: Record<string, string> = {
    signed_up: t("dashboard.funnel.signedUp"),
    studio_created: t("dashboard.funnel.studioCreated"),
    payment_complete: t("dashboard.funnel.paymentComplete"),
    tour_complete: t("dashboard.funnel.tourComplete"),
    active_use: t("dashboard.funnel.activeUse"),
  };

  const stageColors = [
    "bg-brand-500",
    "bg-blue-500",
    "bg-amber-500",
    "bg-green-500",
    "bg-emerald-500",
  ];

  const maxCount = stages.length > 0 ? Math.max(stages[0].count, 1) : 1;

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-300">{t("dashboard.funnel.title")}</h2>
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-700" style={{ width: `${100 - i * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h2 className="text-sm font-medium text-slate-300">{t("dashboard.funnel.title")}</h2>
      <div className="mt-4 space-y-1">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 4);
          return (
            <div key={stage.name}>
              <div className="flex items-center gap-3">
                {/* Bar */}
                <div className="flex-1">
                  <div
                    className={`${stageColors[i] ?? "bg-slate-500"} flex items-center rounded px-3 py-1.5 transition-all duration-500`}
                    style={{ width: `${widthPct}%`, minWidth: "60px" }}
                  >
                    <span className="text-sm font-bold text-white">{stage.count}</span>
                  </div>
                </div>
                {/* Label + conversion */}
                <div className="w-40 shrink-0 text-right">
                  <span className="text-sm text-slate-300">{stageLabels[stage.name] ?? stage.name}</span>
                  {i > 0 && (
                    <span className={`ml-2 text-xs ${stage.rate >= 70 ? "text-green-400" : stage.rate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {stage.rate}%
                    </span>
                  )}
                </div>
              </div>
              {/* Conversion arrow between stages */}
              {i < stages.length - 1 && (
                <div className="flex items-center gap-3 py-0.5">
                  <div className="flex-1 flex justify-center">
                    <span className="text-slate-600">↓</span>
                  </div>
                  <div className="w-40 shrink-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
