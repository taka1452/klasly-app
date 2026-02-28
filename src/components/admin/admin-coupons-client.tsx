"use client";

import { useState, useEffect } from "react";

type Coupon = {
  id: string;
  stripe_coupon_id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  duration: string;
  duration_months: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  promotion_codes: { id: string; code: string; times_redeemed: number; max_redemptions: number | null; expires_at: string | null; is_active: boolean }[];
  redemption_count: number;
};

export default function AdminCouponsPageClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [showCreatePromo, setShowCreatePromo] = useState<string | null>(null);

  async function fetchCoupons() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCoupons(data.coupons ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCoupons();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons</h1>
          <p className="mt-1 text-slate-400">Create and manage coupons and promotion codes</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateCoupon(true)}
          className="rounded-lg border border-indigo-500 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30"
        >
          Create Coupon
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {coupons.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center text-slate-400">
              No coupons yet. Create one to get started.
            </div>
          ) : (
            coupons.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-700 bg-slate-800 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-medium text-white">{c.name}</h2>
                    <p className="text-sm text-slate-400">
                      {c.discount_type === "percent"
                        ? `${c.discount_value}% off`
                        : `$${(c.discount_value / 100).toFixed(2)} off`}{" "}
                      · {c.duration}
                      {c.duration === "repeating" && c.duration_months ? ` (${c.duration_months} mo)` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "active" ? "bg-green-500/20 text-green-300" : "bg-slate-600 text-slate-400"
                      }`}
                    >
                      {c.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreatePromo(showCreatePromo === c.id ? null : c.id)}
                      className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Add promotion code
                    </button>
                    <CouponStatusToggle couponId={c.id} status={c.status} onToggle={fetchCoupons} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{c.notes || "—"}</p>
                <p className="mt-1 text-xs text-slate-500">Redemptions: {c.redemption_count}</p>

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h3 className="text-sm font-medium text-slate-400">Promotion codes</h3>
                  {c.promotion_codes.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">None</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {c.promotion_codes.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <code className="rounded bg-slate-700 px-2 py-0.5 text-white">{p.code}</code>
                          <span className="text-slate-400">
                            redeemed {p.times_redeemed}
                            {p.max_redemptions != null ? ` / ${p.max_redemptions}` : ""}
                          </span>
                          {p.expires_at && (
                            <span className="text-slate-500">exp {new Date(p.expires_at).toLocaleDateString()}</span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-green-500/20 text-green-300" : "bg-slate-600 text-slate-400"}`}
                          >
                            {p.is_active ? "active" : "inactive"}
                          </span>
                          <PromoActiveToggle promoId={p.id} isActive={p.is_active} onToggle={fetchCoupons} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {showCreatePromo === c.id && (
                  <CreatePromoForm
                    couponId={c.id}
                    onDone={() => {
                      setShowCreatePromo(null);
                      fetchCoupons();
                    }}
                    onCancel={() => setShowCreatePromo(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showCreateCoupon && (
        <CreateCouponForm
          onDone={() => {
            setShowCreateCoupon(false);
            fetchCoupons();
          }}
          onCancel={() => setShowCreateCoupon(false)}
        />
      )}
    </div>
  );
}

function CouponStatusToggle({
  couponId,
  status,
  onToggle,
}: {
  couponId: string;
  status: string;
  onToggle: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const next = status === "active" ? "inactive" : "active";
  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) onToggle();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
    >
      Set {next}
    </button>
  );
}

function PromoActiveToggle({
  promoId,
  isActive,
  onToggle,
}: {
  promoId: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const [loading, setLoading] = useState(false);
  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/promotion-codes/${promoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (res.ok) onToggle();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="text-xs text-indigo-400 hover:underline disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}

function CreateCouponForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [duration, setDuration] = useState<"forever" | "once" | "repeating">("once");
  const [durationMonths, setDurationMonths] = useState("3");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const val = discountType === "percent" ? parseFloat(discountValue) : parseFloat(discountValue) * 100;
    if (isNaN(val) || (discountType === "percent" && (val <= 0 || val > 100)) || (discountType === "amount" && val <= 0)) {
      setErr("Invalid discount value");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          discount_type: discountType,
          discount_value: discountType === "amount" ? val : parseFloat(discountValue),
          duration,
          duration_months: duration === "repeating" ? parseInt(durationMonths, 10) || 3 : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-white">Create coupon</h3>
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-slate-400">Discount type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
                className="mt-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              >
                <option value="percent">Percent</option>
                <option value="amount">Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">{discountType === "percent" ? "Percent" : "Amount (USD)"}</label>
              <input
                type="number"
                step={discountType === "percent" ? 0.1 : 0.01}
                min={discountType === "percent" ? 0.01 : 0.01}
                max={discountType === "percent" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
                className="mt-1 w-24 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as "forever" | "once" | "repeating")}
              className="mt-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            >
              <option value="once">Once</option>
              <option value="forever">Forever</option>
              <option value="repeating">Repeating</option>
            </select>
          </div>
          {duration === "repeating" && (
            <div>
              <label className="block text-xs text-slate-400">Months</label>
              <input
                type="number"
                min={1}
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                className="mt-1 w-20 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="rounded border border-slate-500 px-4 py-2 text-sm text-slate-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePromoForm({
  couponId,
  onDone,
  onCancel,
}: {
  couponId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [firstTimeOnly, setFirstTimeOnly] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!code.trim()) {
      setErr("Code is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}/promotion-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          max_redemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : undefined,
          expires_at: expiresAt || undefined,
          first_time_only: firstTimeOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-slate-600 bg-slate-900/50 p-4">
      <h4 className="text-sm font-medium text-slate-300">New promotion code</h4>
      {err && <p className="mt-1 text-sm text-red-400">{err}</p>}
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-400">Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SAVE20"
            className="mt-1 w-32 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400">Max redemptions</label>
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            className="mt-1 w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400">Expires at</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={firstTimeOnly} onChange={(e) => setFirstTimeOnly(e.target.checked)} />
          First-time only
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {loading ? "…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
