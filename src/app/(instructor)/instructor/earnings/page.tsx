"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

type StripeStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InstructorEarningsPage() {
  const searchParams = useSearchParams();
  const [earnings, setEarnings] = useState<EarningItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const fetchData = useCallback(async () => {
    const [earningsRes, statusRes] = await Promise.all([
      fetch(`/api/instructor-earnings?month=${selectedMonth}`),
      fetch("/api/stripe/connect/instructor-status"),
    ]);

    if (earningsRes.ok) {
      const data = await earningsRes.json();
      setEarnings(data.earnings ?? []);
      setSummary(data.summary ?? null);
    }
    if (statusRes.ok) {
      const data = await statusRes.json();
      setStripeStatus(data);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

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
        alert(data.error ?? "Failed to start onboarding");
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
        alert(data.error ?? "Failed to get dashboard link");
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
        <h1 className="text-2xl font-bold text-gray-900">My Earnings</h1>
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Earnings</h1>
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
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input-field w-auto"
        />
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatCents(summary.totalGross)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Your Payout</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCents(summary.totalPayout)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Studio Fee</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatCents(summary.totalStudioFee)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Classes</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.classCount}
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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {dashboardLoading ? "Opening..." : "Open Stripe Dashboard"}
          </button>
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
            <p className="text-sm text-gray-500">No earnings this month.</p>
          </div>
        )}
      </div>
    </div>
  );
}
