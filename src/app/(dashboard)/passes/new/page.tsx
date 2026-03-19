"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HelpTip from "@/components/ui/help-tip";

export default function NewPassPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [maxClasses, setMaxClasses] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Pass name is required.");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price.");
      return;
    }
    if (!unlimited) {
      const mc = parseInt(maxClasses, 10);
      if (isNaN(mc) || mc <= 0) {
        setError("Please enter a valid number of classes.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/passes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price_cents: Math.round(priceNum * 100),
          max_classes_per_month: unlimited ? null : parseInt(maxClasses, 10),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create pass.");
        return;
      }

      router.push("/passes");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Create Pass</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set up a new monthly membership pass for your members
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pass Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Elizabeth Monthly Pass"'
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="Describe what this pass includes..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Monthly Price ($)
          </label>
          <input
            type="number"
            min="0.50"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="49.99"
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Classes per month
            <HelpTip
              text="Set a monthly limit, or leave unlimited. Members see their remaining count."
              helpSlug="studio-pass"
            />
          </label>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={unlimited}
                onChange={() => setUnlimited(true)}
              />
              <span className="text-sm text-gray-700">Unlimited</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!unlimited}
                onChange={() => setUnlimited(false)}
              />
              <span className="text-sm text-gray-700">Limited</span>
            </label>
            {!unlimited && (
              <input
                type="number"
                min="1"
                value={maxClasses}
                onChange={(e) => setMaxClasses(e.target.value)}
                placeholder="e.g. 8"
                className="input-field mt-1 w-32"
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
