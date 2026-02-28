"use client";

import { useState } from "react";
import Link from "next/link";

type Studio = Record<string, unknown> & {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan_status?: string | null;
  subscription_period?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  grace_period_ends_at?: string | null;
  admin_memo?: string | null;
};

type Usage = {
  members_active: number;
  members_paused: number;
  members_cancelled: number;
  instructors: number;
  active_classes: number;
  bookings_30d: number;
  attendance_30d: number;
  waiver_signed: number;
  waiver_total: number;
};

type Payment = {
  id: string;
  amount: number;
  type: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
};

const STATUS_CLASS: Record<string, string> = {
  trialing: "bg-blue-500/20 text-blue-300",
  active: "bg-green-500/20 text-green-300",
  past_due: "bg-orange-500/20 text-orange-300",
  grace: "bg-red-500/20 text-red-300",
  canceled: "bg-slate-500/20 text-slate-400",
};

export default function AdminStudioDetail({
  studio,
  usage,
  payments,
  stripeCustomerUrl,
  stripeSubscriptionUrl,
}: {
  studio: Studio;
  usage: Usage;
  payments: Payment[];
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
}) {
  const [memo, setMemo] = useState(studio.admin_memo ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const studioId = studio.id as string;

  const formatDate = (d: string | null) => (d ? new Date(d).toISOString().split("T")[0] : "—");
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  async function saveMemo() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/admin/studios/${studioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_memo: memo }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <h3 className="text-sm font-medium text-slate-400">Basic Info</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-slate-500">Studio Name</dt><dd className="text-white">{studio.name}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="text-white">{studio.email ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd className="text-white">{studio.phone ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Address</dt><dd className="text-white">{studio.address ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Created</dt><dd className="text-white">{formatDate(studio.created_at)}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <h3 className="text-sm font-medium text-slate-400">Owner & Stripe</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-slate-500">Owner Name</dt><dd className="text-white">{studio.owner_name ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Owner Email</dt><dd className="text-white">{studio.owner_email ?? "—"}</dd></div>
            <div>
              <dt className="text-slate-500">Stripe Customer</dt>
              <dd>
                {stripeCustomerUrl ? (
                  <a href={stripeCustomerUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                    {studio.stripe_customer_id}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Stripe Subscription</dt>
              <dd>
                {stripeSubscriptionUrl ? (
                  <a href={stripeSubscriptionUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                    {studio.stripe_subscription_id}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">Billing</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-slate-500">Plan Status</dt><dd><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[String(studio.plan_status)] ?? "bg-slate-600 text-slate-300"}`}>{String(studio.plan_status ?? "—")}</span></dd></div>
          <div><dt className="text-slate-500">Period</dt><dd className="text-white">{studio.subscription_period ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Trial Ends</dt><dd className="text-white">{formatDate(studio.trial_ends_at ?? null)}</dd></div>
          <div><dt className="text-slate-500">Current Period End</dt><dd className="text-white">{formatDate(studio.current_period_end ?? null)}</dd></div>
          <div><dt className="text-slate-500">Cancel at Period End</dt><dd className="text-white">{studio.cancel_at_period_end ? "Yes" : "No"}</dd></div>
          {studio.plan_status === "grace" && (
            <div><dt className="text-slate-500">Grace Period Ends</dt><dd className="text-white">{formatDate(studio.grace_period_ends_at ?? null)}</dd></div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">Usage</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-slate-500">Members</p><p className="text-white">Active {usage.members_active} / Paused {usage.members_paused} / Cancelled {usage.members_cancelled}</p></div>
          <div><p className="text-slate-500">Instructors</p><p className="text-white">{usage.instructors}</p></div>
          <div><p className="text-slate-500">Active Classes</p><p className="text-white">{usage.active_classes}</p></div>
          <div><p className="text-slate-500">Bookings (30d)</p><p className="text-white">{usage.bookings_30d}</p></div>
          <div><p className="text-slate-500">Attendance (30d)</p><p className="text-white">{usage.attendance_30d}</p></div>
          <div><p className="text-slate-500">Waiver Completion</p><p className="text-white">{usage.waiver_signed} / {usage.waiver_total}</p></div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">Payment History</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Stripe ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-slate-500">No payments</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700">
                    <td className="p-2 text-white">{formatDate(p.paid_at ?? p.created_at)}</td>
                    <td className="p-2 text-white">{formatCurrency(p.amount)}</td>
                    <td className="p-2 text-slate-300">{p.type}</td>
                    <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "paid" ? "bg-green-500/20 text-green-300" : "bg-slate-600 text-slate-300"}`}>{p.status}</span></td>
                    <td className="p-2">
                      {p.stripe_payment_intent_id ? (
                        <a href={`https://dashboard.stripe.com/payments/${p.stripe_payment_intent_id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                          {String(p.stripe_payment_intent_id).slice(0, 20)}…
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">Admin Memo</h3>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Internal notes..."
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={saveMemo}
            disabled={saving}
            className="rounded border border-indigo-500 bg-transparent px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
          {saved && <span className="text-sm text-green-400">Saved</span>}
        </div>
      </div>
    </div>
  );
}
