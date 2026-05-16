"use client";

import { useCallback, useEffect, useState } from "react";

type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  scope: "all" | "class" | "event" | "membership" | "contract";
  member_tag: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  one_time_per_member: boolean;
  is_active: boolean;
  created_at: string;
};

const SCOPE_LABEL: Record<DiscountCode["scope"], string> = {
  all: "All purchases",
  class: "Class bookings",
  event: "Event bookings",
  membership: "Memberships",
  contract: "Contract invoices",
};

function formatValue(c: DiscountCode): string {
  return c.discount_type === "percent"
    ? `${c.discount_value}% off`
    : `$${(c.discount_value / 100).toFixed(2)} off`;
}

export default function DiscountCodesClient() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchCodes = useCallback(async () => {
    setError("");
    const res = await fetch("/api/discount-codes");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load codes");
      return;
    }
    setCodes(await res.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCodes().finally(() => setLoading(false));
  }, [fetchCodes]);

  async function deleteCode(id: string) {
    if (!confirm("Delete this discount code? This can't be undone.")) return;
    const res = await fetch(`/api/discount-codes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete");
      return;
    }
    fetchCodes();
  }

  async function toggleActive(c: DiscountCode) {
    const res = await fetch(`/api/discount-codes/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    if (res.ok) fetchCodes();
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="btn-primary text-sm"
        >
          + New code
        </button>
      </div>

      {(creating || editing) && (
        <CodeForm
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            fetchCodes();
          }}
        />
      )}

      {loading ? (
        <div className="card">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="card py-8 text-center">
          <p className="text-sm text-gray-500">No discount codes yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Click &quot;New code&quot; to create your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {codes.map((c) => {
            const expired =
              c.expires_at && new Date(c.expires_at).getTime() < Date.now();
            const exhausted =
              c.usage_limit !== null && c.used_count >= c.usage_limit;
            return (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-base font-semibold text-gray-900">
                      {c.code}
                    </p>
                    {c.description && (
                      <p className="mt-1 text-xs text-gray-500">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!c.is_active ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        Inactive
                      </span>
                    ) : expired ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        Expired
                      </span>
                    ) : exhausted ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Exhausted
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Active
                      </span>
                    )}
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Discount</dt>
                    <dd className="font-medium text-gray-900">
                      {formatValue(c)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Applies to</dt>
                    <dd className="text-gray-700">{SCOPE_LABEL[c.scope]}</dd>
                  </div>
                  {c.member_tag && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Auto-apply tag</dt>
                      <dd className="text-gray-700">{c.member_tag}</dd>
                    </div>
                  )}
                  {c.usage_limit !== null && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Uses</dt>
                      <dd className="text-gray-700">
                        {c.used_count} / {c.usage_limit}
                      </dd>
                    </div>
                  )}
                  {c.expires_at && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Expires</dt>
                      <dd className="text-gray-700">
                        {new Date(c.expires_at).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleActive(c)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {c.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCode(c.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CodeForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: DiscountCode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    initial?.discount_type ?? "percent"
  );
  const [discountValueDisplay, setDiscountValueDisplay] = useState(
    initial
      ? initial.discount_type === "percent"
        ? String(initial.discount_value)
        : (initial.discount_value / 100).toFixed(2)
      : ""
  );
  const [scope, setScope] = useState<DiscountCode["scope"]>(
    initial?.scope ?? "all"
  );
  const [memberTag, setMemberTag] = useState(initial?.member_tag ?? "");
  const [expiresAt, setExpiresAt] = useState(
    initial?.expires_at ? initial.expires_at.slice(0, 10) : ""
  );
  const [usageLimit, setUsageLimit] = useState(
    initial?.usage_limit !== null && initial?.usage_limit !== undefined
      ? String(initial.usage_limit)
      : ""
  );
  const [oneTime, setOneTime] = useState(initial?.one_time_per_member ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const raw = parseFloat(discountValueDisplay);
    if (!Number.isFinite(raw) || raw <= 0) {
      setError("Enter a positive discount amount.");
      setSaving(false);
      return;
    }
    const discount_value =
      discountType === "percent" ? Math.round(raw) : Math.round(raw * 100);
    if (discountType === "percent" && discount_value > 100) {
      setError("Percent must be 100 or less.");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      code: code.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value,
      scope,
      member_tag: memberTag.trim() || null,
      expires_at: expiresAt ? `${expiresAt}T23:59:59` : null,
      usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
      one_time_per_member: oneTime,
    };

    const url = initial
      ? `/api/discount-codes/${initial.id}`
      : "/api/discount-codes";
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <div className="card mb-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {initial ? "Edit code" : "New code"}
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VETS10"
              required
              className="input-field mt-1 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="10% off for veterans"
              className="input-field mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Type
            </label>
            <div className="mt-2 flex gap-2">
              {(["percent", "fixed"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDiscountType(t)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    discountType === t
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {t === "percent" ? "% off" : "$ off"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <div className="relative mt-1">
              {discountType === "fixed" && (
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  $
                </span>
              )}
              <input
                type="number"
                min={discountType === "percent" ? "1" : "0.01"}
                max={discountType === "percent" ? "100" : undefined}
                step={discountType === "percent" ? "1" : "0.01"}
                value={discountValueDisplay}
                onChange={(e) => setDiscountValueDisplay(e.target.value)}
                required
                className={`input-field ${
                  discountType === "fixed" ? "pl-7" : ""
                } ${
                  discountType === "percent" ? "pr-8" : ""
                }`}
              />
              {discountType === "percent" && (
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  %
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Applies to
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as DiscountCode["scope"])}
            className="input-field mt-1"
          >
            <option value="all">All purchases</option>
            <option value="class">Class bookings only</option>
            <option value="event">Event bookings only</option>
            <option value="membership">Memberships only</option>
            <option value="contract">Contract invoices only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Auto-apply for member tag{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={memberTag}
            onChange={(e) => setMemberTag(e.target.value)}
            placeholder="veteran"
            className="input-field mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">
            When set, the code auto-applies for any member whose tags include
            this value (set tags on the member profile). Leave blank to make
            it a regular type-it-in coupon.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Expires on{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Total usage limit{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="No limit"
              className="input-field mt-1"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={oneTime}
            onChange={(e) => setOneTime(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          One use per member
        </label>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary text-sm"
          >
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? "Saving…" : initial ? "Save changes" : "Create code"}
          </button>
        </div>
      </form>
    </div>
  );
}
