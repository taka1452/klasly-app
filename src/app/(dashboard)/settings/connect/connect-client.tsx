"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import Toast from "@/components/ui/toast";
import { STRIPE_CONNECT_COUNTRIES } from "@/lib/stripe/connect-countries";

type Status = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  country: string | null;
};

type Props = {
  defaultCountry: string;
};

export default function SettingsConnectClient({ defaultCountry }: Props) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [confirmReset, setConfirmReset] = useState(false);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: selectedCountry }),
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

  async function handleDisconnect() {
    setDisconnectLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/disconnect", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToastMessage(data.error ?? "Failed to disconnect");
        return;
      }
      await fetchStatus();
      setConfirmReset(false);
    } finally {
      setDisconnectLoading(false);
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

  const countryName =
    STRIPE_CONNECT_COUNTRIES.find(
      (c) => c.code === (status.country || "").toUpperCase()
    )?.name ?? status.country;

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

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Business country
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="mt-1 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {STRIPE_CONNECT_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Choose the country where your business is registered. This
              determines the postal code, phone, and bank account formats shown
              on the Stripe form. It cannot be changed once your account is
              created.
            </p>
          </div>

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
            Your Stripe account is created
            {countryName ? ` in ${countryName}` : ""} but setup is not complete.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={onboardingLoading}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {onboardingLoading ? "Redirecting..." : "Continue Setup"}
          </button>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700">
              Wrong country?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Stripe doesn&apos;t allow changing an account&apos;s country after
              it&apos;s created. If you picked the wrong one, disconnect this
              account and start over with the correct country.
            </p>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Disconnect and start over
              </button>
            ) : (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">
                  This will unlink the current Stripe account so you can start a
                  fresh one. The old account will be abandoned on Stripe&apos;s
                  side — you can delete it from your Stripe dashboard later.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnectLoading}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {disconnectLoading ? "Disconnecting..." : "Yes, disconnect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    disabled={disconnectLoading}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 card">
          <h2 className="text-lg font-semibold text-gray-900">
            ✅ Stripe Connected
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account is ready to receive payments from members
            {countryName ? ` (${countryName})` : ""}.
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
