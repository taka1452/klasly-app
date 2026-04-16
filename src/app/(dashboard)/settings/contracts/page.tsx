"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import ContractsHourlyPlans from "@/components/settings/contracts-hourly-plans";
import ContractsFlatFees from "@/components/settings/contracts-flat-fees";
import ContractsOverageCharges from "@/components/settings/contracts-overage-charges";

type TabKey = "hourly" | "flat" | "overage";

function ContractsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const initialTab: TabKey =
    tabParam === "flat" ? "flat" : tabParam === "overage" ? "overage" : "hourly";
  const [tab, setTab] = useState<TabKey>(initialTab);

  function selectTab(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Instructor Contracts
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Define how instructors pay for using your studio. Each instructor can
          be assigned either an <strong>hourly plan</strong> (subscription with
          hour allowance) or a <strong>flat / per-class fee</strong> (manual
          settlement). Plans are managed here; per-instructor assignment lives
          on each instructor&apos;s edit page.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Contract types">
          <button
            type="button"
            onClick={() => selectTab("hourly")}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              tab === "hourly"
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Hourly plans
          </button>
          <button
            type="button"
            onClick={() => selectTab("flat")}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              tab === "flat"
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Flat &amp; per-class fees
          </button>
          <button
            type="button"
            onClick={() => selectTab("overage")}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              tab === "overage"
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Overage charges
          </button>
        </nav>
      </div>

      {tab === "hourly" && (
        <ContractsHourlyPlans onSwitchToOverage={() => selectTab("overage")} />
      )}
      {tab === "flat" && <ContractsFlatFees />}
      {tab === "overage" && <ContractsOverageCharges />}
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
        </div>
      }
    >
      <ContractsPageInner />
    </Suspense>
  );
}
