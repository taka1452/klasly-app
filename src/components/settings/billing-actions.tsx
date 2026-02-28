"use client";

import { useState } from "react";

export type PaymentMethodInfo = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
} | null;

type Props = {
  planStatus: string;
  subscriptionPeriod: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeSubscription: boolean;
  isYearlyWithinRefundWindow: boolean;
  appliedCouponCode?: string | null;
  paymentMethod?: PaymentMethodInfo | null;
};

export default function BillingActions({
  planStatus,
  subscriptionPeriod,
  cancelAtPeriodEnd,
  hasStripeSubscription,
  isYearlyWithinRefundWindow,
  appliedCouponCode = null,
  paymentMethod = null,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [switchModal, setSwitchModal] = useState<"monthly" | "yearly" | null>(null);

  async function openBillingPortal() {
    setLoading("billing-portal");
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open billing portal");
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
      setSwitchModal(null);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
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

  async function handleCheckout(period: "monthly" | "yearly") {
    setLoading(`checkout-${period}`);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, successPath: "billing" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleApplyPromoCode() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoError(null);
    setLoading("apply-promo");
    try {
      const res = await fetch("/api/stripe/apply-promotion-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotion_code: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply code");
      window.location.reload();
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Failed to apply code");
    } finally {
      setLoading(null);
    }
  }

  const showSwitchPlan =
    hasStripeSubscription &&
    planStatus === "active" &&
    !cancelAtPeriodEnd;

  const showPaymentMethod = hasStripeSubscription && planStatus !== "canceled";
  const isPastDue = planStatus === "past_due" || planStatus === "grace";

  const cardBrand =
    paymentMethod?.brand
      ? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1).toLowerCase()
      : "Card";
  const expStr =
    paymentMethod &&
    `${String(paymentMethod.exp_month).padStart(2, "0")}/${paymentMethod.exp_year}`;

  return (
    <>
      {/* Switch Plan — only when active, not trialing */}
      {showSwitchPlan && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Switch Plan</h2>
          {subscriptionPeriod === "yearly" ? (
            <>
              <p className="mt-2 text-sm text-gray-600">
                💡 Switch to Monthly ($19/month)
              </p>
              <button
                type="button"
                onClick={() => setSwitchModal("monthly")}
                disabled={!!loading}
                className="btn-secondary mt-3"
              >
                Switch to Monthly
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">
                💰 Save 17% with Yearly ($190/year)
              </p>
              <button
                type="button"
                onClick={() => setSwitchModal("yearly")}
                disabled={!!loading}
                className="btn-secondary mt-3"
              >
                Switch to Yearly - Save $38/year
              </button>
            </>
          )}
        </div>
      )}

      {/* Payment Method — when Stripe linked, not canceled */}
      {showPaymentMethod && (
        <div className={`card ${isPastDue ? "border-amber-300 bg-amber-50/50" : ""}`}>
          <h2 className="text-lg font-semibold text-gray-900">Payment Method</h2>
          {paymentMethod ? (
            <>
              <p className="mt-2 text-sm text-gray-700">
                💳 {cardBrand} ending in {paymentMethod.last4}
              </p>
              <p className="text-xs text-gray-500">Expires {expStr}</p>
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={!!loading}
                className="btn-secondary mt-3"
              >
                {loading === "billing-portal" ? "Redirecting…" : "Manage Payment Method →"}
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">No payment method on file</p>
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={!!loading}
                className="btn-primary mt-3"
              >
                {loading === "billing-portal" ? "Redirecting…" : "Add Payment Method →"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Promotion Code */}
      {hasStripeSubscription && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Promotion Code</h2>
          {appliedCouponCode ? (
            <p className="mt-2 text-sm text-green-600">
              Applied: <strong>{appliedCouponCode}</strong>
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleApplyPromoCode}
                  disabled={!!loading || !promoCode.trim()}
                  className="btn-secondary"
                >
                  {loading === "apply-promo" ? "Applying…" : "Apply"}
                </button>
              </div>
              {promoError && (
                <p className="mt-1 text-sm text-red-600">{promoError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Cancel / Resume / Resubscribe — only when there is an action */}
      {(planStatus === "trialing" ||
        (planStatus === "active" && hasStripeSubscription) ||
        planStatus === "past_due" ||
        planStatus === "grace" ||
        planStatus === "canceled") && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Cancel</h2>
          {planStatus === "trialing" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={!!loading}
              className="mt-3 text-sm text-red-600 hover:underline"
            >
              {loading === "cancel" ? "Cancelling…" : "Cancel Trial"}
            </button>
          )}

        {planStatus === "active" && hasStripeSubscription && (
          <>
            {cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={handleResume}
                disabled={!!loading}
                className="btn-primary mt-3"
              >
                {loading === "resume" ? "Resuming…" : "Resume Subscription"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                disabled={!!loading}
                className="mt-3 text-sm text-red-600 hover:underline"
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

        {(planStatus === "past_due" || planStatus === "grace") && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={!!loading}
            className="mt-3 text-sm text-red-600 hover:underline"
          >
            {loading === "cancel" ? "Cancelling…" : "Cancel Subscription"}
          </button>
        )}

        {planStatus === "canceled" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCheckout("monthly")}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === "checkout-monthly"
                ? "Redirecting…"
                : "Resubscribe (Monthly $19/mo)"}
            </button>
            <button
              type="button"
              onClick={() => handleCheckout("yearly")}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === "checkout-yearly"
                ? "Redirecting…"
                : "Resubscribe (Yearly $190/yr)"}
            </button>
          </div>
        )}
        </div>
      )}

      {/* Switch plan confirmation modals */}
      {switchModal === "yearly" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Switch to Yearly Plan?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              You&apos;ll be charged $190/year (save 17% compared to monthly).
              The change takes effect at the end of your current billing period.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSwitchModal(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPlan("yearly")}
                disabled={!!loading}
                className="btn-primary"
              >
                {loading === "switch-yearly" ? "Switching…" : "Confirm Switch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {switchModal === "monthly" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Switch to Monthly Plan?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              You&apos;ll be charged $19/month starting at the end of your
              current yearly period. You&apos;ll lose the yearly discount of
              ~17%.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSwitchModal(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPlan("monthly")}
                disabled={!!loading}
                className="btn-primary"
              >
                {loading === "switch-monthly" ? "Switching…" : "Confirm Switch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
