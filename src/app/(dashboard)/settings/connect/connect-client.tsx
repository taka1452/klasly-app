"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import Toast from "@/components/ui/toast";

type Status = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

export default function SettingsConnectClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/stripe/connect/status");
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data);
  }, []);

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
  }, [fetchStatus]);

  useEffect(() => {
    const returnParam = searchParams.get("return");
    const refreshParam = searchParams.get("refresh");
    if (returnParam === "true" || refreshParam === "true") {
      fetchStatus();
    }
  }, [searchParams, fetchStatus]);

  async function handleConnect() {
    setOnboardingLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/onboarding", {
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
      const res = await fetch("/api/stripe/connect/dashboard-link", {
        method: "POST",
      });
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

  if (loading || status === null) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stripe Connect</h1>
        <p className="mt-1 text-sm text-gray-500">
          Receive payments from your members
        </p>
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Settings
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stripe Connect</h1>
          <p className="mt-1 text-sm text-gray-500">
            Receive payments from your members
          </p>
        </div>
        <FlowHintPanel flowType="stripe-connect" buttonLabel="Why Stripe Connect?" />
      </div>

      {!status.connected ? (
        <div className="mt-6 card">
          <h2 className="text-lg font-semibold text-gray-900">
            Connect Your Stripe Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            To receive payments from your members, connect your Stripe account.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={onboardingLoading}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {onboardingLoading ? "Redirecting..." : "Connect with Stripe"}
          </button>
        </div>
      ) : !status.onboardingComplete ? (
        <div className="mt-6 card">
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
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {onboardingLoading ? "Redirecting..." : "Continue Setup"}
          </button>
        </div>
      ) : (
        <div className="mt-6 card">
          <h2 className="text-lg font-semibold text-gray-900">
            ✅ Stripe Connected
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account is ready to receive payments from members.
          </p>
          <button
            type="button"
            onClick={handleOpenDashboard}
            disabled={dashboardLoading}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {dashboardLoading ? "Opening..." : "Open Stripe Dashboard"}
          </button>
        </div>
      )}
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
