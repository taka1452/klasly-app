"use client";

import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/types/database";
import Toast from "@/components/ui/toast";

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(val: string): number {
  const parsed = parseFloat(val);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

type FormState = {
  name: string;
  type: "one_time" | "subscription";
  credits: number;
  creditsUnlimited: boolean;
  priceDollars: string;
  billing_interval: "month" | "year";
  description: string;
  sort_order: string;
};

const emptyForm: FormState = {
  name: "",
  type: "one_time",
  credits: 1,
  creditsUnlimited: false,
  priceDollars: "",
  billing_interval: "month",
  description: "",
  sort_order: "",
};

type ProductManagerProps = {
  initialProducts?: Product[];
};

export default function ProductManager({ initialProducts = [] }: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [creditsWarning, setCreditsWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const url = showInactive ? "/api/products" : "/api/products?active=true";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    if (initialProducts.length > 0 && !showInactive) {
      setProducts(initialProducts);
      return;
    }
    fetchProducts();
  }, [showInactive, fetchProducts, initialProducts]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setCreditsWarning(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      credits: p.credits,
      creditsUnlimited: p.credits === -1,
      priceDollars: centsToDollars(p.price),
      billing_interval: (p.billing_interval === "year" ? "year" : "month") as "month" | "year",
      description: p.description ?? "",
      sort_order: String(p.sort_order),
    });
    setError(null);
    setCreditsWarning(null);
    setModalOpen(true);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return "Name is required (1–100 characters).";
    if (form.name.trim().length > 100) return "Name must be 1–100 characters.";
    if (form.type === "one_time" && (form.creditsUnlimited || form.credits === -1)) {
      return "Unlimited credits are only allowed for Subscription type.";
    }
    const priceCents = dollarsToCents(form.priceDollars);
    if (priceCents < 1) return "Price must be at least $0.01.";
    if (form.type === "subscription" && !form.creditsUnlimited && form.credits !== -1) {
      setCreditsWarning("Subscription with limited credits is allowed (e.g. 8 classes/month).");
    } else {
      setCreditsWarning(null);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const credits = form.creditsUnlimited ? -1 : form.credits;
    const price = dollarsToCents(form.priceDollars);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      credits,
      price,
      currency: "usd",
      billing_interval: form.type === "subscription" ? form.billing_interval : null,
      description: form.description.trim() || null,
      sort_order: form.sort_order ? parseInt(form.sort_order, 10) : undefined,
    };

    if (editingId) {
      const res = await fetch(`/api/products/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setProducts((prev) => prev.map((p) => (p.id === editingId ? (data as Product) : p)));
    } else {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      setProducts((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
    }
    setModalOpen(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this product? It will no longer appear on the purchase page.")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setToastMessage(data.error ?? "Failed to deactivate");
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const displayList = showInactive ? products : products.filter((p) => p.is_active);

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Show inactive products
        </label>
        <button type="button" onClick={openCreate} className="btn-primary">
          Add Product
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="card mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Credits</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      No products yet. Click &quot;Add Product&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  displayList.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {p.type === "subscription" ? "Subscription" : "One-time"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {p.credits === -1 ? "Unlimited" : p.credits}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        ${centsToDollars(p.price)}
                        {p.type === "subscription" && p.billing_interval
                          ? `/${p.billing_interval === "year" ? "yr" : "mo"}`
                          : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Edit
                        </button>
                        {p.is_active && (
                          <>
                            <span className="mx-2 text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(p.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 id="product-modal-title" className="text-lg font-semibold text-gray-900">
              {editingId ? "Edit Product" : "Add Product"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              {creditsWarning && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{creditsWarning}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field mt-1"
                  placeholder="e.g. Drop-in, 10-Class Pack"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as "one_time" | "subscription",
                    }))
                  }
                  className="input-field mt-1"
                >
                  <option value="one_time">One-time</option>
                  <option value="subscription">Subscription</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Credits</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.creditsUnlimited}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((f) => ({
                          ...f,
                          creditsUnlimited: checked,
                          credits: checked ? -1 : (f.credits === -1 ? 1 : f.credits),
                        }));
                      }}
                      className="rounded border-gray-300 text-brand-600"
                    />
                    Unlimited
                  </label>
                  {!form.creditsUnlimited && (
                    <input
                      type="number"
                      min={1}
                      value={form.credits === -1 ? "" : form.credits}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          credits: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                      className="input-field w-24"
                    />
                  )}
                </div>
                {form.type === "one_time" && form.creditsUnlimited && (
                  <p className="mt-1 text-xs text-red-600">Unlimited is only for Subscription type.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.priceDollars}
                  onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
                  className="input-field mt-1"
                />
              </div>
              {form.type === "subscription" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Billing Interval</label>
                  <select
                    value={form.billing_interval}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        billing_interval: e.target.value as "month" | "year",
                      }))
                    }
                    className="input-field mt-1"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-field mt-1"
                  placeholder="e.g. 10 sessions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sort order (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="input-field mt-1 w-24"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
