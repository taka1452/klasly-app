"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Price IDs are looked up server-side by period type

export default function OnboardingPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);
  const trialEndStr = trialEndDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/onboarding/status");
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (data.redirectToLogin) {
          router.push("/login");
          return;
        }

        if (!data.hasStudio) {
          router.push("/onboarding");
          return;
        }

        if (!data.needsPlan) {
          router.push("/dashboard");
          return;
        }
      } catch {
        if (!cancelled) router.push("/onboarding");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [router]);

  async function handleSelect(period: "monthly" | "yearly") {
    setLoading(period);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, successPath: "onboarding" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-700">Klasly</h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Choose your plan
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Card required. You won&apos;t be charged during the trial. Your
            trial ends on {trialEndStr}.
          </p>
        </div>

        <div className="mt-6 rounded-xl border-2 border-green-200 bg-green-50 px-5 py-4 text-center">
          <p className="text-base font-semibold text-green-800">
            ✓ 30-day free trial — Cancel within 30 days and you pay nothing.
          </p>
          <p className="mt-1 text-sm text-green-700">
            No charge until {trialEndStr}. Cancel anytime before then.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="card flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900">Monthly</h3>
            <p className="mt-2 text-2xl font-bold text-brand-600">
              $19<span className="text-sm font-normal text-gray-500">/month</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">Billed monthly after trial</p>
            <button
              type="button"
              onClick={() => handleSelect("monthly")}
              disabled={!!loading}
              className="btn-primary mt-auto mt-6"
            >
              {loading === "monthly" ? "Redirecting…" : "Start trial"}
            </button>
          </div>

          <div className="card relative flex flex-col border-brand-500">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">
              BEST VALUE
            </span>
            <h3 className="text-lg font-semibold text-gray-900">Yearly</h3>
            <p className="mt-2 text-2xl font-bold text-brand-600">
              $190<span className="text-sm font-normal text-gray-500">/year</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Save $38 • Billed yearly after trial
            </p>
            <button
              type="button"
              onClick={() => handleSelect("yearly")}
              disabled={!!loading}
              className="btn-primary mt-auto mt-6"
            >
              {loading === "yearly" ? "Redirecting…" : "Start trial"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Cancel anytime during the trial. No charge until {trialEndStr}.
        </p>

        {/* DEV ONLY: Skip to dashboard without Stripe. Hidden in production. */}
        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/dev/skip-onboarding", {
                method: "POST",
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.redirect) {
                window.location.href = data.redirect;
              } else {
                alert(data.error || "Skip failed");
              }
            }}
            className="fixed bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/90 text-amber-900 shadow-lg hover:bg-amber-500/90"
            title="Skip to dashboard (dev only)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
