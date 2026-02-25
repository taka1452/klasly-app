"use client";

import { useState } from "react";

type Props = {
  studioId: string;
  defaults: {
    drop_in_price: number;
    pack_5_price: number;
    pack_10_price: number;
    monthly_price: number;
  };
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(val: string): number {
  const parsed = parseFloat(val);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export default function PricingForm({ studioId, defaults }: Props) {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    drop_in_price: centsToDollars(defaults.drop_in_price),
    pack_5_price: centsToDollars(defaults.pack_5_price),
    pack_10_price: centsToDollars(defaults.pack_10_price),
    monthly_price: centsToDollars(defaults.monthly_price),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/settings/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId,
          drop_in_price: dollarsToCents(values.drop_in_price),
          pack_5_price: dollarsToCents(values.pack_5_price),
          pack_10_price: dollarsToCents(values.pack_10_price),
          monthly_price: dollarsToCents(values.monthly_price),
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Save failed");

      alert("Pricing saved successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 card max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Drop-in price ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.drop_in_price}
            onChange={(e) =>
              setValues((v) => ({ ...v, drop_in_price: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">1 session</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            5-Class Pack price ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.pack_5_price}
            onChange={(e) =>
              setValues((v) => ({ ...v, pack_5_price: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">5 sessions</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            10-Class Pack price ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.pack_10_price}
            onChange={(e) =>
              setValues((v) => ({ ...v, pack_10_price: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">10 sessions</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Monthly membership price ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.monthly_price}
            onChange={(e) =>
              setValues((v) => ({ ...v, monthly_price: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Unlimited per month</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-6"
      >
        {loading ? "Saving…" : "Save pricing"}
      </button>
    </form>
  );
}
