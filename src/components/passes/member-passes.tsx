"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pass = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_classes_per_month: number | null;
};

type Subscription = {
  id: string;
  studio_pass_id: string;
  status: "active" | "cancelled" | "past_due";
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  classes_used_this_period: number;
};

type Props = {
  memberId: string;
  passes: Pass[];
  subscriptions: Subscription[];
};

function formatPeriodDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function MemberPasses({ memberId, passes, subscriptions }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const subByPass = new Map<string, Subscription>();
  for (const sub of subscriptions) {
    subByPass.set(sub.studio_pass_id, sub);
  }

  async function handleSubscribe(passId: string) {
    setLoadingId(passId);
    setError("");
    try {
      const res = await fetch("/api/passes/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId, memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to subscribe.");
        return;
      }
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCancel(subscriptionId: string) {
    setLoadingId(subscriptionId);
    setError("");
    try {
      const res = await fetch("/api/passes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel.");
        return;
      }
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoadingId(null);
    }
  }

  if (passes.length === 0) {
    return (
      <div className="mt-6 card">
        <p className="text-sm text-gray-500">
          No membership passes are available at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {passes.map((pass) => {
          const sub = subByPass.get(pass.id);
          const isActive = sub?.status === "active" && !sub?.cancel_at_period_end;
          const isPendingCancel = sub?.status === "active" && sub?.cancel_at_period_end;
          const isCancelled = sub?.status === "cancelled";
          const hasSubscription = isActive || isPendingCancel || isCancelled;

          return (
            <div key={pass.id} className="card flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {pass.name}
                  </h3>
                  {isActive && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Current Plan
                    </span>
                  )}
                  {isPendingCancel && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Cancels {formatPeriodDate(sub?.current_period_end ?? null)}
                    </span>
                  )}
                  {isCancelled && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Cancelled
                    </span>
                  )}
                </div>
                {pass.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {pass.description}
                  </p>
                )}

                {/* Usage stats for active/cancelled subscriptions */}
                {hasSubscription && sub && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Classes used</span>
                      <span className="font-semibold text-gray-900">
                        {sub.classes_used_this_period}
                        {pass.max_classes_per_month !== null
                          ? ` / ${pass.max_classes_per_month}`
                          : " classes"}
                      </span>
                    </div>

                    {pass.max_classes_per_month !== null && (
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            sub.classes_used_this_period >= pass.max_classes_per_month
                              ? "bg-amber-500"
                              : "bg-brand-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (sub.classes_used_this_period / pass.max_classes_per_month) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {formatPeriodDate(sub.current_period_start)} — {formatPeriodDate(sub.current_period_end)}
                      </span>
                      {isPendingCancel ? (
                        <span className="text-amber-600">Cancels at period end</span>
                      ) : isCancelled ? (
                        <span className="text-gray-400">Expired</span>
                      ) : (
                        <span>Renews {formatPeriodDate(sub.current_period_end)}</span>
                      )}
                    </div>
                  </div>
                )}

                {!hasSubscription && (
                  <div className="mt-3 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Classes/month:</span>{" "}
                      {pass.max_classes_per_month === null
                        ? "Unlimited"
                        : pass.max_classes_per_month}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xl font-bold text-gray-900">
                  ${(pass.price_cents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">
                    /month
                  </span>
                </p>

                {isActive && sub ? (
                  <button
                    onClick={() => handleCancel(sub.id)}
                    disabled={loadingId === sub.id}
                    className="mt-3 w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {loadingId === sub.id ? "Cancelling..." : "Cancel Subscription"}
                  </button>
                ) : isPendingCancel && sub ? (
                  <p className="mt-3 text-center text-sm text-amber-600">
                    Active until {formatPeriodDate(sub.current_period_end)}
                  </p>
                ) : isCancelled ? (
                  <p className="mt-3 text-center text-sm text-gray-400">
                    Subscription ended
                  </p>
                ) : (
                  <button
                    onClick={() => handleSubscribe(pass.id)}
                    disabled={loadingId === pass.id}
                    className="btn-primary mt-3 w-full"
                  >
                    {loadingId === pass.id
                      ? "Subscribing..."
                      : `Subscribe $${(pass.price_cents / 100).toFixed(2)}/month`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
