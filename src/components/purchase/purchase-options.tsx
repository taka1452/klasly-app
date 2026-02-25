"use client";

import { useState } from "react";

type Pricing = {
  drop_in_price: number;
  pack_5_price: number;
  pack_10_price: number;
  monthly_price: number;
};

type Props = {
  memberId: string;
  pricing: Pricing;
};

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function PurchaseOptions({ memberId, pricing }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleBuy(purchaseType: "drop_in" | "pack_5" | "pack_10" | "monthly") {
    setLoading(purchaseType);
    try {
      const res = await fetch("/api/stripe/member-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseType, memberId }),
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

  const options = [
    {
      type: "drop_in" as const,
      title: "Drop-in",
      price: centsToDollars(pricing.drop_in_price),
      desc: "1 session",
    },
    {
      type: "pack_5" as const,
      title: "5-Class Pack",
      price: centsToDollars(pricing.pack_5_price),
      desc: "5 sessions",
    },
    {
      type: "pack_10" as const,
      title: "10-Class Pack",
      price: centsToDollars(pricing.pack_10_price),
      desc: "10 sessions",
    },
    {
      type: "monthly" as const,
      title: "Monthly Unlimited",
      price: centsToDollars(pricing.monthly_price) + "/mo",
      desc: "Unlimited",
    },
  ];

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {options.map((opt) => (
        <div key={opt.type} className="card flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900">{opt.title}</h3>
          <p className="mt-1 text-2xl font-bold text-brand-600">${opt.price}</p>
          <p className="mt-1 text-sm text-gray-500">{opt.desc}</p>
          <button
            type="button"
            onClick={() => handleBuy(opt.type)}
            disabled={!!loading}
            className="btn-primary mt-auto mt-4"
          >
            {loading === opt.type ? "Redirecting…" : "Buy"}
          </button>
        </div>
      ))}
    </div>
  );
}
