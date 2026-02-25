"use client";

import { useState } from "react";

type Props = {
  plan: string;
  studioPriceId: string | undefined;
  growPriceId: string | undefined;
  hasActiveSubscription: boolean;
};

export default function BillingActions({
  plan,
  studioPriceId,
  growPriceId,
  hasActiveSubscription,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
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
    if (!confirm("Cancel your subscription? You’ll keep access until the end of the current billing period.")) return;
    setLoading("cancel");
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Cancel failed");

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {plan === "free" && studioPriceId && (
        <button
          type="button"
          onClick={() => handleCheckout(studioPriceId)}
          disabled={!!loading}
          className="btn-primary"
        >
          {loading === studioPriceId ? "Redirecting…" : "Upgrade to Studio ($19/mo)"}
        </button>
      )}
      {plan === "free" && growPriceId && (
        <button
          type="button"
          onClick={() => handleCheckout(growPriceId)}
          disabled={!!loading}
          className="btn-primary"
        >
          {loading === growPriceId ? "Redirecting…" : "Upgrade to Grow ($39/mo)"}
        </button>
      )}
      {plan === "studio" && growPriceId && (
        <button
          type="button"
          onClick={() => handleCheckout(growPriceId)}
          disabled={!!loading}
          className="btn-primary"
        >
          {loading === growPriceId ? "Redirecting…" : "Upgrade to Grow ($39/mo)"}
        </button>
      )}
      {hasActiveSubscription && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={!!loading}
          className="btn-secondary border-red-200 text-red-600 hover:bg-red-50"
        >
          {loading === "cancel" ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}
    </div>
  );
}
