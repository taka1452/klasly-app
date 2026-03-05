"use client";

import { useState } from "react";

export type Product = {
  id: string;
  name: string;
  type: "one_time" | "subscription";
  credits: number;
  price: number;
  currency: string;
  billing_interval: string | null;
  description: string | null;
};

type Props = {
  products: Product[];
  memberId: string;
};

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatPrice(p: Product): string {
  const amount = `$${centsToDollars(p.price)}`;
  if (p.type === "subscription" && p.billing_interval) {
    return `${amount}/${p.billing_interval === "year" ? "yr" : "mo"}`;
  }
  return amount;
}

function formatCredits(credits: number): string {
  return credits === -1 ? "Unlimited" : `${credits} credits`;
}

export default function PurchaseOptions({ products, memberId }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(productId: string) {
    setLoading(productId);
    setError(null);
    try {
      const res = await fetch("/api/stripe/member-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, memberId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  if (products.length === 0) {
    return (
      <div className="mt-8 card py-8 text-center text-sm text-gray-500">
        No purchase options available at the moment. Please contact your studio.
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {products.map((product) => (
        <div key={product.id} className="card flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
          <p className="mt-1 text-2xl font-bold text-brand-600">
            {formatPrice(product)}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {formatCredits(product.credits)}
          </p>
          {product.description && (
            <p className="mt-1 text-sm text-gray-600">{product.description}</p>
          )}
          <button
            type="button"
            onClick={() => handleBuy(product.id)}
            disabled={!!loading}
            className="btn-primary mt-auto mt-4"
          >
            {loading === product.id ? "Redirecting…" : "Buy"}
          </button>
        </div>
      ))}
    </div>
    </div>
  );
}
