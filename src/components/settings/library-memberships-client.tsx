"use client";

import { useCallback, useEffect, useState } from "react";

type Member = { id: string; fullName: string; email: string };

type Membership = {
  id: string;
  member_id: string;
  member_name?: string;
  member_email?: string;
  tier: "basic" | "premium" | string;
  status: "active" | "paused" | "cancelled" | "past_due" | string;
  started_at: string;
  cancelled_at: string | null;
  price_cents: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-500 line-through",
  past_due: "bg-red-100 text-red-700",
};

export default function LibraryMembershipsClient({ members }: { members: Member[] }) {
  const [rows, setRows] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollMemberId, setEnrollMemberId] = useState(members[0]?.id || "");
  const [enrollTier, setEnrollTier] = useState<"basic" | "premium">("basic");
  const [enrollPrice, setEnrollPrice] = useState("15.00");
  const [enrolling, setEnrolling] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/library/memberships");
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load");
      return;
    }
    setRows(await res.json());
    setError(null);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  async function enroll() {
    if (!enrollMemberId) return;
    setEnrolling(true);
    setError(null);
    const priceCents = Math.round(parseFloat(enrollPrice || "0") * 100);
    const res = await fetch("/api/library/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: enrollMemberId,
        tier: enrollTier,
        price_cents: priceCents,
      }),
    });
    setEnrolling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to enroll");
      return;
    }
    await fetchRows();
  }

  async function updateRow(id: string, patch: Partial<Membership>) {
    const res = await fetch(`/api/library/memberships?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) await fetchRows();
  }

  async function cancelRow(id: string) {
    if (!confirm("Cancel this library membership?")) return;
    const res = await fetch(`/api/library/memberships?id=${id}`, { method: "DELETE" });
    if (res.ok) await fetchRows();
  }

  return (
    <div>
      <div className="card mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Enroll a member</h2>
        <p className="mt-1 text-xs text-gray-500">
          Grant library access manually. (Self-service via Stripe Checkout is
          planned — this gives you a way to comp / admin-enroll now.)
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Member
            </label>
            <select
              value={enrollMemberId}
              onChange={(e) => setEnrollMemberId(e.target.value)}
              className="input-field"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} {m.email ? `— ${m.email}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Tier
            </label>
            <select
              value={enrollTier}
              onChange={(e) =>
                setEnrollTier(e.target.value as "basic" | "premium")
              }
              className="input-field"
            >
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Monthly price ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={enrollPrice}
              onChange={(e) => setEnrollPrice(e.target.value)}
              className="input-field w-32"
            />
          </div>
          <button
            type="button"
            onClick={enroll}
            disabled={enrolling || !enrollMemberId}
            className="btn-primary"
          >
            {enrolling ? "Enrolling..." : "Enroll"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card py-10 text-center text-sm text-gray-500">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-gray-500">No library subscribers yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Member</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3">Since</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.member_name}</div>
                    <div className="text-xs text-gray-500">{r.member_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.tier}
                      onChange={(e) => updateRow(r.id, { tier: e.target.value })}
                      className="input-field text-xs"
                    >
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {r.price_cents !== null ? `$${(r.price_cents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.started_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {r.status !== "paused" && r.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => updateRow(r.id, { status: "paused" })}
                          className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Pause
                        </button>
                      )}
                      {r.status === "paused" && (
                        <button
                          type="button"
                          onClick={() => updateRow(r.id, { status: "active" })}
                          className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Resume
                        </button>
                      )}
                      {r.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => cancelRow(r.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
