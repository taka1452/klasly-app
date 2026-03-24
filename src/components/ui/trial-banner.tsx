"use client";

import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";

type TrialBannerProps = {
  planStatus: string;
  trialEndsAt: string | null;
  hasSubscription: boolean;
};

export default function TrialBanner({
  planStatus,
  trialEndsAt,
  hasSubscription,
}: TrialBannerProps) {
  // Don't show if already subscribed
  if (hasSubscription) return null;

  // Don't show for active paid plans
  if (planStatus === "active") return null;

  const isExpired =
    planStatus === "canceled" ||
    planStatus === "expired" ||
    (planStatus === "trialing" && trialEndsAt && new Date(trialEndsAt) < new Date());

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (isExpired) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">
              Your trial has ended. Subscribe to continue managing your studio.
            </p>
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors flex-shrink-0"
          >
            Choose a plan →
          </Link>
        </div>
      </div>
    );
  }

  if (planStatus === "trialing" && daysLeft !== null) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-600 flex-shrink-0" />
            <p className="text-sm font-medium text-brand-800">
              Trial: {daysLeft} {daysLeft === 1 ? "day" : "days"} remaining
            </p>
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors flex-shrink-0"
          >
            Choose a plan →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
