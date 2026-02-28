"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminLocale } from "@/lib/admin/locale-context";

type Studio = Record<string, unknown> & {
  id: string;
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

const PLAN_STATUSES = ["trialing", "active", "past_due", "grace", "canceled"] as const;

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
  appliedCoupon = null,
}: {
  studio: Studio;
  usage: Usage;
  payments: Payment[];
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
  appliedCoupon?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [memo, setMemo] = useState(studio.admin_memo ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [planStatus, setPlanStatus] = useState(studio.plan_status ?? "");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(!!studio.cancel_at_period_end);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [applyCouponCode, setApplyCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const studioId = studio.id as string;
  const hasSubscription = !!studio.stripe_subscription_id;
  const { t, formatDate: formatDateLocale } = useAdminLocale();

  const formatDate = (d: string | null) => (d ? formatDateLocale(d) : "—");
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

  async function handlePlanStatusChange(newStatus: string) {
    setError(null);
    const res = await fetch(`/api/admin/studios/${studioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_status: newStatus }),
    });
    if (res.ok) {
      setPlanStatus(newStatus);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update");
    }
  }

  async function handleCancelAtPeriodEndToggle() {
    setError(null);
    const next = !cancelAtPeriodEnd;
    const res = await fetch(`/api/admin/studios/${studioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_period_end: next }),
    });
    if (res.ok) {
      setCancelAtPeriodEnd(next);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update");
    }
  }

  async function runAction(
    key: string,
    url: string,
    body: Record<string, unknown>,
    onSuccess?: () => void
  ) {
    setActionLoading(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      onSuccess?.();
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  function doExtendTrial() {
    runAction("extend", `/api/admin/studios/${studioId}/extend-trial`, { days: extendDays }, () => setShowExtendModal(false));
  }

  function doResetTrial() {
    runAction("reset", `/api/admin/studios/${studioId}/reset-trial`, {}, () => setShowResetConfirm(false));
  }

  function doSendEmail() {
    runAction("email", `/api/admin/studios/${studioId}/send-email`, { subject: emailSubject, body: emailBody }, () => {
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
    });
  }

  function doCancelSubscription() {
    runAction("cancel", `/api/admin/studios/${studioId}/cancel`, { immediate: cancelImmediate }, () => setShowCancelConfirm(false));
  }

  function doDeleteStudio() {
    if (deleteConfirmName.trim() !== studio.name) {
      setError(t("studioDetail.studioNameMismatch"));
      return;
    }
    runAction("delete", `/api/admin/studios/${studioId}/delete`, { confirm_name: deleteConfirmName.trim() }, () => {
      setShowDeleteConfirm(false);
      setDeleteConfirmName("");
      router.push("/admin/studios");
    });
  }

  async function doRemoveCoupon() {
    setCouponLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studios/${studioId}/remove-coupon`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else setError(data.error ?? "Failed to remove coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  async function doApplyCoupon() {
    const code = applyCouponCode.trim();
    if (!code) return;
    setCouponLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studios/${studioId}/apply-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotion_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApplyCouponCode("");
        router.refresh();
      } else setError(data.error ?? "Failed to apply coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.basicInfo")}</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-slate-500">{t("studioDetail.studioNameLabel")}</dt><dd className="text-white">{studio.name}</dd></div>
            <div><dt className="text-slate-500">{t("studioDetail.email")}</dt><dd className="text-white">{studio.email ?? "—"}</dd></div>
            <div><dt className="text-slate-500">{t("studioDetail.phone")}</dt><dd className="text-white">{studio.phone ?? "—"}</dd></div>
            <div><dt className="text-slate-500">{t("studioDetail.address")}</dt><dd className="text-white">{studio.address ?? "—"}</dd></div>
            <div><dt className="text-slate-500">{t("studios.created")}</dt><dd className="text-white">{formatDate(studio.created_at)}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
          <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.ownerAndStripe")}</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-slate-500">{t("studioDetail.ownerName")}</dt><dd className="text-white">{studio.owner_name ?? "—"}</dd></div>
            <div><dt className="text-slate-500">{t("studios.ownerEmail")}</dt><dd className="text-white">{studio.owner_email ?? "—"}</dd></div>
            <div>
              <dt className="text-slate-500">{t("studioDetail.stripeCustomer")}</dt>
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
              <dt className="text-slate-500">{t("studioDetail.stripeSubscription")}</dt>
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
        <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.billingInfo")}</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate-500">{t("studioDetail.planStatus")}</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[String(planStatus)] ?? "bg-slate-600 text-slate-300"}`}>
                {String(planStatus || "—")}
              </span>
              <select
                value={planStatus}
                onChange={(e) => handlePlanStatusChange(e.target.value)}
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </dd>
          </div>
          <div><dt className="text-slate-500">{t("studioDetail.period")}</dt><dd className="text-white">{studio.subscription_period ?? "—"}</dd></div>
          <div>
            <dt className="text-slate-500">{t("studios.trialEnds")}</dt>
            <dd className="flex items-center gap-2">
              <span className="text-white">{formatDate(studio.trial_ends_at ?? null)}</span>
              <button
                type="button"
                onClick={() => setShowExtendModal(true)}
                className="rounded border border-slate-500 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                {t("studioDetail.extend")}
              </button>
            </dd>
          </div>
          <div><dt className="text-slate-500">{t("studioDetail.currentPeriodEnd")}</dt><dd className="text-white">{formatDate(studio.current_period_end ?? null)}</dd></div>
          <div>
            <dt className="text-slate-500">{t("studioDetail.cancelAtPeriodEnd")}</dt>
            <dd className="flex items-center gap-2">
              <span className="text-white">{cancelAtPeriodEnd ? t("studioDetail.yes") : t("studioDetail.no")}</span>
              {hasSubscription && (
                <button
                  type="button"
                  onClick={handleCancelAtPeriodEndToggle}
                  className={`rounded px-2 py-0.5 text-xs ${cancelAtPeriodEnd ? "bg-orange-500/20 text-orange-300" : "bg-slate-600 text-slate-300"} hover:opacity-90`}
                >
                  {cancelAtPeriodEnd ? t("studioDetail.revert") : t("studioDetail.set")}
                </button>
              )}
            </dd>
          </div>
          {studio.plan_status === "grace" && (
            <div><dt className="text-slate-500">{t("studioDetail.gracePeriodEnds")}</dt><dd className="text-white">{formatDate(studio.grace_period_ends_at ?? null)}</dd></div>
          )}
        </dl>
        <div className="mt-4 border-t border-slate-700 pt-4">
          <dt className="text-slate-500">{t("studioDetail.appliedCoupon")}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            {appliedCoupon ? (
              <>
                <span className="rounded bg-green-500/20 px-2 py-0.5 text-sm text-green-300">{appliedCoupon.name}</span>
                <button
                  type="button"
                  onClick={doRemoveCoupon}
                  disabled={couponLoading}
                  className="rounded border border-red-500/50 px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  {couponLoading ? "…" : t("studioDetail.remove")}
                </button>
              </>
            ) : (
              <span className="text-slate-500">{t("studioDetail.none")}</span>
            )}
            {hasSubscription && (
              <span className="flex items-center gap-2">
                <input
                  type="text"
                  value={applyCouponCode}
                  onChange={(e) => setApplyCouponCode(e.target.value.toUpperCase())}
                  placeholder={t("studioDetail.promoCode")}
                  className="w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={doApplyCoupon}
                  disabled={couponLoading || !applyCouponCode.trim()}
                  className="rounded border border-indigo-500 px-2 py-1 text-xs text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  {t("studioDetail.applyCoupon")}
                </button>
              </span>
            )}
          </dd>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.managementActions")}</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowExtendModal(true)}
            disabled={!!actionLoading}
            className="rounded border border-slate-500 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {actionLoading === "extend" ? "…" : t("studioDetail.extendTrial")}
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={!!actionLoading}
            className="rounded border border-slate-500 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {actionLoading === "reset" ? "…" : t("studioDetail.resetToTrial")}
          </button>
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            disabled={!!actionLoading}
            className="rounded border border-slate-500 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {actionLoading === "email" ? "…" : t("studioDetail.sendEmail")}
          </button>
          {hasSubscription && (
            <>
              <button
                type="button"
                onClick={() => { setCancelImmediate(false); setShowCancelConfirm(true); }}
                disabled={!!actionLoading}
                className="rounded border border-orange-500/50 px-3 py-1.5 text-sm text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
              >
                {actionLoading === "cancel" ? "…" : t("studioDetail.cancelSubscription")}
              </button>
              <button
                type="button"
                onClick={() => { setCancelImmediate(true); setShowCancelConfirm(true); }}
                disabled={!!actionLoading}
                className="rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                {actionLoading === "cancel" ? "…" : t("studioDetail.immediatelyCancel")}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!!actionLoading}
            className="rounded border border-red-600 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            {actionLoading === "delete" ? "…" : t("studioDetail.deleteStudio")}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.usageStats")}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-slate-500">{t("studioDetail.totalMembers")}</p><p className="text-white">{t("studioDetail.membersActivePaused", { active: usage.members_active, paused: usage.members_paused, cancelled: usage.members_cancelled })}</p></div>
          <div><p className="text-slate-500">{t("studioDetail.totalInstructors")}</p><p className="text-white">{usage.instructors}</p></div>
          <div><p className="text-slate-500">{t("studioDetail.activeClasses")}</p><p className="text-white">{usage.active_classes}</p></div>
          <div><p className="text-slate-500">{t("studioDetail.bookings30d")}</p><p className="text-white">{usage.bookings_30d}</p></div>
          <div><p className="text-slate-500">{t("studioDetail.attendance30d")}</p><p className="text-white">{usage.attendance_30d}</p></div>
          <div><p className="text-slate-500">{t("studioDetail.waiverCompletion")}</p><p className="text-white">{usage.waiver_signed} / {usage.waiver_total}</p></div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.paymentHistory")}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-left text-slate-400">
                <th className="p-2">{t("common.date")}</th>
                <th className="p-2">{t("common.amount")}</th>
                <th className="p-2">{t("common.type")}</th>
                <th className="p-2">{t("common.status")}</th>
                <th className="p-2">{t("common.stripeId")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-slate-500">{t("studioDetail.noPayments")}</td></tr>
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
        <h3 className="text-sm font-medium text-slate-400">{t("studioDetail.adminNotes")}</h3>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder={t("studioDetail.internalNotes")}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={saveMemo}
            disabled={saving}
            className="rounded border border-indigo-500 bg-transparent px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {saving ? t("studioDetail.saving") : t("studioDetail.saveNote")}
          </button>
          {saved && <span className="text-sm text-green-400">{t("studioDetail.saved")}</span>}
        </div>
      </div>

      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowExtendModal(false)}>
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-medium text-white">{t("studioDetail.extendTrial")}</h4>
            <p className="mt-1 text-xs text-slate-400">{t("studioDetail.addDaysToTrial")}</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value, 10) || 7)}
                className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white"
              />
              <span className="text-slate-400">{t("studioDetail.days")}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowExtendModal(false)} className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-300">{t("common.cancel")}</button>
              <button type="button" onClick={doExtendTrial} disabled={!!actionLoading} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">{t("studioDetail.extend")}</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowResetConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-medium text-white">{t("studioDetail.resetToTrial")}</h4>
            <p className="mt-1 text-xs text-slate-400">{t("studioDetail.resetTrialConfirm")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowResetConfirm(false)} className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-300">{t("common.cancel")}</button>
              <button type="button" onClick={doResetTrial} disabled={!!actionLoading} className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-500 disabled:opacity-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowEmailModal(false)}>
          <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-medium text-white">{t("studioDetail.sendEmailToOwner")}</h4>
            <p className="mt-1 text-xs text-slate-400">To: {String(studio.owner_email)}</p>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={t("studioDetail.subject")}
              className="mt-3 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500"
            />
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder={t("studioDetail.bodyPlaceholder")}
              rows={5}
              className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowEmailModal(false)} className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-300">{t("common.cancel")}</button>
              <button type="button" onClick={doSendEmail} disabled={!!actionLoading || !emailSubject.trim() || !emailBody.trim()} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">{t("studioDetail.send")}</button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-medium text-white">{cancelImmediate ? t("studioDetail.cancelImmediateTitle") : t("studioDetail.cancelConfirmTitle")}</h4>
            <p className="mt-1 text-xs text-slate-400">
              {cancelImmediate ? t("studioDetail.cancelImmediateDesc") : t("studioDetail.cancelConfirmDesc")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-300">{t("common.cancel")}</button>
              <button type="button" onClick={doCancelSubscription} disabled={!!actionLoading} className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500 disabled:opacity-50">{t("common.confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-medium text-red-400">{t("studioDetail.deleteConfirmTitle")}</h4>
            <p className="mt-1 text-xs text-slate-400">{t("studioDetail.deleteConfirmDesc")}</p>
            <p className="mt-2 text-xs font-medium text-white">{studio.name}</p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={t("studioDetail.typeStudioName")}
              className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-300">{t("common.cancel")}</button>
              <button type="button" onClick={doDeleteStudio} disabled={!!actionLoading || deleteConfirmName.trim() !== studio.name} className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500 disabled:opacity-50">{t("common.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
