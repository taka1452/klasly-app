"use client";

import Link from "next/link";

type Payment = {
  id: string;
  amount: number;
  currency?: string;
  type: string;
  status: string;
  payment_type?: string;
  paid_at?: string | null;
  created_at?: string;
  member_id?: string | null;
  members?: unknown;
};

type Props = {
  payments: Payment[];
  typeFilter: string;
  statusFilter: string;
};

function formatDate(val: string | undefined | null): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString();
}

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function typeLabel(pt: string | undefined, t: string): string {
  const p = pt ?? t;
  if (p === "subscription") return "Studio plan";
  if (p === "monthly") return "Monthly";
  if (p === "pack_5") return "5-Pack";
  if (p === "pack_10") return "10-Pack";
  if (p === "drop_in") return "Drop-in";
  return p;
}

export default function PaymentsTable({
  payments,
  typeFilter,
  statusFilter,
}: Props) {
  function buildHref(typeVal: string, statusVal: string): string {
    const params = new URLSearchParams();
    if (typeVal !== "all") params.set("type", typeVal);
    if (statusVal !== "all") params.set("status", statusVal);
    const q = params.toString();
    return q ? `/payments?${q}` : "/payments";
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex gap-2">
          <span className="text-sm font-medium text-gray-700">Type:</span>
          {["all", "subscription", "drop_in", "class_pack", "monthly"].map(
            (t) => (
              <Link
                key={t}
                href={buildHref(t, statusFilter)}
                className={`text-sm ${typeFilter === t ? "font-semibold text-brand-600" : "text-gray-600 hover:text-gray-900"}`}
              >
                {t === "all" ? "All" : t === "class_pack" ? "Class pack" : t}
              </Link>
            )
          )}
        </div>
        <div className="flex gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {["all", "paid", "failed", "refunded", "pending"].map((s) => (
            <Link
              key={s}
              href={buildHref(typeFilter, s)}
              className={`text-sm ${statusFilter === s ? "font-semibold text-brand-600" : "text-gray-600 hover:text-gray-900"}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Member
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {p.member_id
                        ? ((m: unknown) => {
                            const obj = m as { profiles?: { full_name?: string } } | null;
                            const pf = obj?.profiles;
                            const name = Array.isArray(pf) ? pf[0]?.full_name : pf?.full_name;
                            return name ?? "—";
                          })(p.members)
                        : "Studio"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {formatAmount(p.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {typeLabel(p.payment_type, p.type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : p.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : p.status === "refunded"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
