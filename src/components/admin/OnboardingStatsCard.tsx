"use client";

import { useEffect, useState } from "react";

type OnboardingStats = {
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  avgCompletionMinutes: number;
  dropOffCount: number;
};

export default function OnboardingStatsCard() {
  const [stats, setStats] = useState<OnboardingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/onboarding-stats");
        if (!res.ok) {
          if (!cancelled) setError("Failed to load stats");
          return;
        }
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setError("Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="text-lg font-semibold text-white">
          Onboarding Tour
        </h2>
        <p className="mt-4 text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="text-lg font-semibold text-white">
          Onboarding Tour
        </h2>
        <p className="mt-4 text-sm text-amber-400">{error ?? "No data"}</p>
      </div>
    );
  }

  const cards = [
    {
      label: "Started",
      value: stats.totalStarted,
      sub: "users began tour",
    },
    {
      label: "Completed",
      value: stats.totalCompleted,
      sub: "finished tour",
    },
    {
      label: "Completion Rate",
      value: `${stats.completionRate}%`,
      sub: stats.totalStarted > 0 ? "of who started" : "—",
    },
    {
      label: "Avg. Time",
      value: stats.avgCompletionMinutes > 0 ? `${stats.avgCompletionMinutes} min` : "—",
      sub: "to complete",
    },
    {
      label: "Drop-offs",
      value: stats.dropOffCount,
      sub: "started but not completed",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
      <h2 className="text-lg font-semibold text-white">
        Onboarding Tour
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Completion rate, avg time, drop-off
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-600 bg-slate-900/50 p-4"
          >
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
            <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
