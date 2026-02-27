"use client";

import { useState } from "react";

type Props = {
  planStatus: string;
  subscriptionPeriod: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeSubscription: boolean;
  isYearlyWithinRefundWindow: boolean;
};

export default function BillingActions({
  planStatus,
  subscriptionPeriod,
  cancelAtPeriodEnd,
  hasStripeSubscription,
  isYearlyWithinRefundWindow,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(period: "monthly" | "yearly") {
    setLoading(`checkout-${period}`);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          successPath: "billing",
        }),
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

  async function handleCancel() {
    const message =
      planStatus === "trialing"
        ? "Cancel your trial? You will lose access immediately. No charge will be made."
        : isYearlyWithinRefundWindow
          ? "Cancel and request a refund? You may be eligible for a refund within 14 days of purchase."
          : "Cancel your subscription? You'll keep access until the end of the current billing period.";

    if (!confirm(message)) return;
    setLoading("cancel");
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTrialing: planStatus === "trialing",
          requestRefund: isYearlyWithinRefundWindow,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Cancel failed");

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleResume() {
    setLoading("resume");
    try {
      const res = await fetch("/api/stripe/resume", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Resume failed");

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleUpdatePayment() {
    setLoading("update-payment");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: subscriptionPeriod === "yearly" ? "yearly" : "monthly",
          successPath: "billing",
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleSwitchPlan(newPeriod: "monthly" | "yearly") {
    if (newPeriod === subscriptionPeriod) return;
    setLoading(`switch-${newPeriod}`);
    try {
      const res = await fetch("/api/stripe/subscription-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: newPeriod }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Update failed");

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* Trialing: Cancel Trial */}
      {planStatus === "trialing" && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={!!loading}
          className="btn-secondary border-red-200 text-red-600 hover:bg-red-50"
        >
          {loading === "cancel" ? "Cancelling…" : "Cancel Trial"}
        </button>
      )}

      {/* Active: Cancel / Resume */}
      {planStatus === "active" && hasStripeSubscription && (
        <>
          {cancelAtPeriodEnd ? (
            <button
              type="button"
              onClick={handleResume}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === "resume" ? "Resuming…" : "Resume Subscription"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              disabled={!!loading}
              className="btn-secondary border-red-200 text-red-600 hover:bg-red-50"
            >
              {loading === "cancel"
                ? "Cancelling…"
                : isYearlyWithinRefundWindow
                  ? "Cancel & Request Refund"
                  : "Cancel Subscription"}
            </button>
          )}
        </>
      )}

      {/* Past due / Grace: Update Payment */}
      {(planStatus === "past_due" || planStatus === "grace") && (
        <button
          type="button"
          onClick={async () => {
            setLoading("update-payment");
            try {
              const res = await fetch("/api/stripe/billing-portal", {
                method: "POST",
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed");
              if (data.url) window.location.href = data.url;
            } catch (err) {
              alert(err instanceof Error ? err.message : "Update failed");
            } finally {
              setLoading(null);
            }
          }}
          disabled={!!loading}
          className="btn-primary"
        >
          {loading === "update-payment" ? "Redirecting…" : "Update Payment Method"}
        </button>
      )}

      {/* Canceled: Reactivate */}
      {planStatus === "canceled" && (
        <>
          <button
            type="button"
            onClick={() => handleCheckout("monthly")}
            disabled={!!loading}
            className="btn-primary"
          >
            {loading === "checkout-monthly"
              ? "Redirecting…"
              : "Reactivate (Monthly $19/mo)"}
          </button>
          <button
            type="button"
            onClick={() => handleCheckout("yearly")}
            disabled={!!loading}
            className="btn-primary"
          >
            {loading === "checkout-yearly"
              ? "Redirecting…"
              : "Reactivate (Yearly $190/yr)"}
          </button>
        </>
      )}

      {/* Plan switch: Monthly ↔ Yearly (active, not canceling) */}
      {planStatus === "active" &&
        !cancelAtPeriodEnd &&
        hasStripeSubscription && (
          <>
            {subscriptionPeriod === "monthly" && (
              <button
                type="button"
                onClick={() => handleSwitchPlan("yearly")}
                disabled={!!loading}
                className="btn-secondary"
              >
                {loading === "switch-yearly"
                  ? "Switching…"
                  : "Switch to Yearly ($190/year - Save $38)"}
              </button>
            )}
            {subscriptionPeriod === "yearly" && (
              <button
                type="button"
                onClick={() => handleSwitchPlan("monthly")}
                disabled={!!loading}
                className="btn-secondary"
              >
                {loading === "switch-monthly"
                  ? "Switching…"
                  : "Switch to Monthly ($19/month)"}
              </button>
            )}
          </>
        )}
    </div>
  );
}
