"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Instructor = { id: string; fullName: string; email: string };

type Invoice = {
  id: string;
  instructor_id: string;
  instructor_name?: string;
  instructor_email?: string;
  period_start: string;
  period_end: string;
  tier_name: string | null;
  tier_charge_cents: number;
  overage_charge_cents: number;
  flat_fee_cents: number;
  adjustments_cents: number;
  adjustments_note: string | null;
  total_cents: number;
  session_count: number;
  total_minutes: number;
  status: "draft" | "sent" | "paid" | "void";
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

type Props = {
  instructors: Instructor[];
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

const STATUS_STYLE: Record<Invoice["status"], string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  void: "bg-red-100 text-red-600 line-through",
};

export default function InstructorInvoicesClient({ instructors }: Props) {
  const [month, setMonth] = useState(currentMonthKey());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/invoices?month=${month}`);
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load invoices");
      return;
    }
    const data = await res.json();
    setInvoices(data);
  }, [month]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/invoices?action=generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setGenerating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to generate invoices");
      return;
    }
    const data = await res.json();
    setInfo(
      `Generated ${data.generated} draft invoice(s) · skipped ${data.skipped} (no charges).`
    );
    await fetchInvoices();
  }

  async function runAction(invoiceId: string, action: "send" | "mark_paid" | "void") {
    setBusyId(invoiceId);
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Failed to ${action}`);
      return;
    }
    await fetchInvoices();
  }

  async function handleDelete(invoiceId: string) {
    if (!confirm("Delete this draft invoice?")) return;
    setBusyId(invoiceId);
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete");
      return;
    }
    await fetchInvoices();
  }

  const totals = useMemo(() => {
    const sum = (key: keyof Invoice) =>
      invoices.reduce((s, inv) => s + ((inv[key] as number) || 0), 0);
    return {
      total: sum("total_cents"),
      tier: sum("tier_charge_cents"),
      overage: sum("overage_charge_cents"),
      flat: sum("flat_fee_cents"),
      draft: invoices.filter((i) => i.status === "draft").length,
      sent: invoices.filter((i) => i.status === "sent").length,
      paid: invoices.filter((i) => i.status === "paid").length,
    };
  }, [invoices]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Month
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input-field"
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || instructors.length === 0}
          className="btn-primary"
          title="Creates draft invoices for every instructor for the selected month"
        >
          {generating ? "Generating..." : "Generate for all instructors"}
        </button>
        <div className="ml-auto text-xs text-gray-500">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"} for {formatMonth(month)}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {info}
        </div>
      )}

      {/* Summary tiles */}
      {invoices.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryTile label="Total billed" value={dollars(totals.total)} accent="brand" />
          <SummaryTile label="Tier" value={dollars(totals.tier)} />
          <SummaryTile label="Overage" value={dollars(totals.overage)} />
          <SummaryTile label="Flat / per-class" value={dollars(totals.flat)} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card py-10 text-center text-sm text-gray-500">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-gray-500">
            No invoices for {formatMonth(month)} yet.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Click &quot;Generate for all instructors&quot; to create draft invoices from
            this month&apos;s tier subscriptions, overage, and flat fees.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Instructor</th>
                <th className="px-4 py-3 text-right">Tier</th>
                <th className="px-4 py-3 text-right">Overage</th>
                <th className="px-4 py-3 text-right">Flat fees</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="text-sm">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{inv.instructor_name}</div>
                    <div className="text-xs text-gray-500">{inv.instructor_email}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {inv.session_count} session{inv.session_count === 1 ? "" : "s"}
                      {inv.total_minutes > 0 && ` · ${formatMinutes(inv.total_minutes)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {dollars(inv.tier_charge_cents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {dollars(inv.overage_charge_cents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {dollars(inv.flat_fee_cents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold tabular-nums text-gray-900">
                      {dollars(inv.total_cents)}
                    </div>
                    {inv.adjustments_cents !== 0 && (
                      <div className="text-xs text-gray-500">
                        adj {dollars(inv.adjustments_cents)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                    {inv.sent_at && (
                      <div className="mt-1 text-[11px] text-gray-400">
                        sent {formatDate(inv.sent_at)}
                      </div>
                    )}
                    {inv.paid_at && (
                      <div className="mt-1 text-[11px] text-green-600">
                        paid {formatDate(inv.paid_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {inv.status === "draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => runAction(inv.id, "send")}
                            disabled={busyId === inv.id}
                            className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            Send
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(inv.id)}
                            disabled={busyId === inv.id}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {inv.status === "sent" && (
                        <button
                          type="button"
                          onClick={() => runAction(inv.id, "mark_paid")}
                          disabled={busyId === inv.id}
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )}
                      {(inv.status === "draft" || inv.status === "sent") && (
                        <button
                          type="button"
                          onClick={() => runAction(inv.id, "void")}
                          disabled={busyId === inv.id}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Void
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

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "brand";
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent === "brand" ? "border-brand-200 bg-brand-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${accent === "brand" ? "text-brand-700" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
