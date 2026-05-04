"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Toast from "@/components/ui/toast";
import ContextHelpLink from "@/components/help/context-help-link";
import { CountUp } from "@/components/ui/count-up";

type EarningItem = {
  id: string;
  gross_amount: number;
  stripe_fee: number;
  platform_fee: number;
  studio_fee: number;
  instructor_payout: number;
  status: string;
  created_at: string;
  class_sessions?: {
    session_date: string;
    start_time: string;
    classes?: { name: string };
  };
};

type Summary = {
  totalGross: number;
  totalStripeFee: number;
  totalPlatformFee: number;
  totalStudioFee: number;
  totalPayout: number;
  classCount: number;
};

type Motivation = {
  isPersonalBest: boolean;
  streakMonths: number;
};

type PassDistItem = {
  id: string;
  period_start: string;
  period_end: string;
  total_classes: number;
  total_pool_classes: number;
  gross_pool_amount: number;
  payout_amount: number;
  status: string;
  created_at: string;
};

type PassSummary = {
  totalPayout: number;
  totalClasses: number;
  count: number;
};

type StripeStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function MyEarningsPage() {
  const searchParams = useSearchParams();
  const [earnings, setEarnings] = useState<EarningItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [passDistributions, setPassDistributions] = useState<PassDistItem[]>([]);
  const [passSummary, setPassSummary] = useState<PassSummary | null>(null);
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const celebratedRef = useRef<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const fetchData = useCallback(async () => {
    setMonthLoading(true);
    try {
      const [earningsRes, statusRes] = await Promise.all([
        fetch(`/api/instructor-earnings?month=${selectedMonth}`),
        fetch("/api/stripe/connect/instructor-status"),
      ]);

      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setEarnings(data.earnings ?? []);
        setSummary(data.summary ?? null);
        setPassDistributions(data.passDistributions ?? []);
        setPassSummary(data.passSummary ?? null);
        setMotivation(data.motivation ?? null);
      } else {
        setToastMessage("Failed to load earnings data");
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStripeStatus(data);
      }
    } catch {
      setToastMessage("Failed to load data. Please try again.");
    } finally {
      setMonthLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Confetti on Personal Best — fire once per month per browser, after
  // data lands so the totals are already on screen.
  useEffect(() => {
    if (!motivation?.isPersonalBest) return;
    if (typeof window === "undefined") return;
    const seenKey = `klasly:pb-celebrated:${selectedMonth}`;
    if (celebratedRef.current === selectedMonth) return;
    if (window.localStorage.getItem(seenKey)) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) return;
    celebratedRef.current = selectedMonth;
    window.localStorage.setItem(seenKey, "1");
    void (async () => {
      const { default: confetti } = await import("canvas-confetti");
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.3 },
        colors: ["#0074c5", "#fbbf24", "#10b981", "#f472b6"],
      });
    })();
  }, [motivation, selectedMonth]);

  useEffect(() => {
    const returnParam = searchParams.get("return");
    const refreshParam = searchParams.get("refresh");
    if (returnParam === "true" || refreshParam === "true") {
      fetchData();
    }
  }, [searchParams, fetchData]);

  async function handleConnect() {
    setOnboardingLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/instructor-onboarding", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToastMessage(data.error ?? "Failed to start onboarding");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleOpenDashboard() {
    setDashboardLoading(true);
    try {
      const res = await fetch(
        "/api/stripe/connect/instructor-dashboard-link",
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setToastMessage(data.error ?? "Failed to get dashboard link");
        return;
      }
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setDashboardLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Earnings</h1>
          <ContextHelpLink href="/help/collective-mode/collective-tiers" />
        </div>
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Earnings</h1>
        <ContextHelpLink href="/help/collective-mode/collective-tiers" />
      </div>
      <p className="mt-1 text-sm text-gray-500">
        View your class earnings and Stripe account status
      </p>

      {/* Stripe Connection Status */}
      {stripeStatus && !stripeStatus.onboardingComplete && (
        <div className="mt-6 card">
          {!stripeStatus.connected ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">
                Connect Your Stripe Account
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                To receive direct payments from class bookings, connect your
                Stripe account.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={onboardingLoading}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
              >
                {onboardingLoading ? "Redirecting..." : "Connect with Stripe"}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900">
                Complete Your Stripe Setup
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Your Stripe account is created but setup is not complete.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={onboardingLoading}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
              >
                {onboardingLoading ? "Redirecting..." : "Continue Setup"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Month Selector */}
      <div className="mt-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <input
          type="month"
          disabled={monthLoading}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input-field w-auto"
        />
        {monthLoading && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              <CountUp
                value={summary.totalGross + (passSummary?.totalPayout ?? 0)}
                format={formatCents}
              />
            </p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Your Payout</p>
              {motivation?.isPersonalBest ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                  title="New all-time personal best month"
                >
                  🏆 Personal best
                </span>
              ) : motivation && motivation.streakMonths >= 3 ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"
                  title={`${motivation.streakMonths} consecutive months earning`}
                >
                  🔥 {motivation.streakMonths} mo
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">
              <CountUp
                value={summary.totalPayout + (passSummary?.totalPayout ?? 0)}
                format={formatCents}
              />
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Studio Fee</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              <CountUp value={summary.totalStudioFee} format={formatCents} />
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Classes</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              <CountUp
                value={summary.classCount + (passSummary?.totalClasses ?? 0)}
                format={(n) => Math.round(n).toString()}
              />
            </p>
          </div>
        </div>
      )}

      {/* Stripe Dashboard Link */}
      {stripeStatus?.onboardingComplete && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleOpenDashboard}
            disabled={dashboardLoading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
          >
            {dashboardLoading ? "Opening..." : "Open Stripe Dashboard"}
          </button>
        </div>
      )}

      {/* Pass Distributions */}
      {passDistributions.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Pass Distributions
          </h2>
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-gray-200">
              {passDistributions.map((d) => {
                const sharePercent = d.total_pool_classes > 0
                  ? ((d.total_classes / d.total_pool_classes) * 100).toFixed(1)
                  : "100";
                return (
                  <div key={d.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">Pass Distribution</p>
                      <p className="text-sm text-gray-500">
                        {d.total_classes} classes · {sharePercent}% share
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        {formatCents(d.payout_amount)}
                      </p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : d.status === "approved"
                          ? "bg-blue-100 text-blue-700"
                          : d.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Earnings List */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Recent Earnings
        </h2>
        {earnings.length > 0 ? (
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-gray-200">
              {earnings.map((e) => {
                const session = e.class_sessions;
                const cls = session?.classes;
                const className =
                  (cls as { name?: string } | undefined)?.name ?? "Class";
                const sessionArr = Array.isArray(session) ? session[0] : session;

                return (
                  <div key={e.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{className}</p>
                      <p className="text-sm text-gray-500">
                        {sessionArr?.session_date ?? ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        {formatCents(e.instructor_payout)}
                      </p>
                      <p className="text-xs text-gray-400">
                        of {formatCents(e.gross_amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card py-8 text-center">
            <p className="text-sm text-gray-500">
              {passDistributions.length > 0
                ? "No per-class earnings this month. Pass distributions are shown above."
                : "No earnings this month."}
            </p>
          </div>
        )}
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          variant="error"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
