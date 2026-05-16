"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pass = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_classes_per_month: number | null;
  expires_on: string | null;
};

type Subscription = {
  id: string;
  studio_pass_id: string;
  status: "active" | "cancelled" | "past_due";
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  classes_used_this_period: number;
  frozen_at?: string | null;
  frozen_until?: string | null;
  total_frozen_days?: number;
};

type Props = {
  memberId: string;
  passes: Pass[];
  subscriptions: Subscription[];
};

function formatPeriodDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function MemberPasses({ memberId, passes, subscriptions }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  // Freeze UI: which subscription is being frozen + the picked end date.
  const [freezingId, setFreezingId] = useState<string | null>(null);
  const [freezeUntil, setFreezeUntil] = useState("");

  async function startFreeze(subscriptionId: string) {
    if (!freezeUntil) {
      setError("Pick a return date first.");
      return;
    }
    setLoadingId(subscriptionId);
    setError("");
    try {
      const res = await fetch("/api/member/pass-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, frozenUntil: freezeUntil }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to freeze pass");
        return;
      }
      setFreezingId(null);
      setFreezeUntil("");
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  // Gifting UI state — which subscription's gift form is open + fields.
  const [giftingId, setGiftingId] = useState<string | null>(null);
  const [giftEmail, setGiftEmail] = useState("");
  const [giftCount, setGiftCount] = useState("1");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftSuccess, setGiftSuccess] = useState<string | null>(null);

  async function sendGift(subscriptionId: string) {
    const count = parseInt(giftCount, 10);
    if (!giftEmail.trim() || !Number.isFinite(count) || count <= 0) {
      setError("Recipient email and a positive count are required");
      return;
    }
    setLoadingId(subscriptionId);
    setError("");
    setGiftSuccess(null);
    try {
      const res = await fetch("/api/member/pass-gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSubscriptionId: subscriptionId,
          recipientEmail: giftEmail.trim(),
          classCount: count,
          message: giftMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gift failed");
        return;
      }
      setGiftSuccess(`Sent ${count} class${count === 1 ? "" : "es"} to ${giftEmail.trim()}`);
      setGiftingId(null);
      setGiftEmail("");
      setGiftCount("1");
      setGiftMessage("");
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function unfreezePass(subscriptionId: string) {
    setLoadingId(subscriptionId);
    setError("");
    try {
      const res = await fetch(
        `/api/member/pass-freeze?subscriptionId=${encodeURIComponent(subscriptionId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to unfreeze");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  const subByPass = new Map<string, Subscription>();
  for (const sub of subscriptions) {
    subByPass.set(sub.studio_pass_id, sub);
  }

  async function handleSubscribe(passId: string) {
    setLoadingId(passId);
    setError("");
    try {
      const res = await fetch("/api/passes/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId, memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to subscribe.");
        return;
      }
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCancel(subscriptionId: string) {
    setLoadingId(subscriptionId);
    setError("");
    try {
      const res = await fetch("/api/passes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel.");
        return;
      }
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoadingId(null);
    }
  }

  if (passes.length === 0) {
    return (
      <div className="mt-6 card">
        <p className="text-sm text-gray-500">
          No membership passes are available at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {passes.map((pass) => {
          const sub = subByPass.get(pass.id);
          const isActive = sub?.status === "active" && !sub?.cancel_at_period_end;
          const isPendingCancel = sub?.status === "active" && sub?.cancel_at_period_end;
          const isCancelled = sub?.status === "cancelled";
          const hasSubscription = isActive || isPendingCancel || isCancelled;

          return (
            <div key={pass.id} className="card flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {pass.name}
                  </h3>
                  {isActive && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Current Plan
                    </span>
                  )}
                  {isPendingCancel && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Cancels {formatPeriodDate(sub?.current_period_end ?? null)}
                    </span>
                  )}
                  {isCancelled && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Cancelled
                    </span>
                  )}
                </div>
                {pass.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {pass.description}
                  </p>
                )}

                {/* Usage stats for active/cancelled subscriptions */}
                {hasSubscription && sub && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Classes used</span>
                      <span className="font-semibold text-gray-900">
                        {sub.classes_used_this_period}
                        {pass.max_classes_per_month !== null
                          ? ` / ${pass.max_classes_per_month}`
                          : " classes"}
                      </span>
                    </div>

                    {pass.max_classes_per_month !== null && (
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            sub.classes_used_this_period >= pass.max_classes_per_month
                              ? "bg-amber-500"
                              : "bg-brand-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (sub.classes_used_this_period / pass.max_classes_per_month) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {formatPeriodDate(sub.current_period_start)} — {formatPeriodDate(sub.current_period_end)}
                      </span>
                      {isPendingCancel ? (
                        <span className="text-amber-600">Cancels at period end</span>
                      ) : isCancelled ? (
                        <span className="text-gray-400">Expired</span>
                      ) : pass.expires_on ? (
                        <span>Expires {formatPeriodDate(pass.expires_on)}</span>
                      ) : (
                        <span>Renews {formatPeriodDate(sub.current_period_end)}</span>
                      )}
                    </div>
                  </div>
                )}

                {!hasSubscription && (
                  <div className="mt-3 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Classes/month:</span>{" "}
                      {pass.max_classes_per_month === null
                        ? "Unlimited"
                        : pass.max_classes_per_month}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xl font-bold text-gray-900">
                  ${(pass.price_cents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">
                    /month
                  </span>
                </p>

                {isActive && sub && sub.frozen_at ? (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Frozen until {formatPeriodDate(sub.frozen_until ?? null)}
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      Bookings are paused. Your expiry will be pushed forward
                      by the days you skip.
                    </p>
                    <button
                      onClick={() => unfreezePass(sub.id)}
                      disabled={loadingId === sub.id}
                      className="mt-2 w-full rounded-lg border border-blue-400 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {loadingId === sub.id ? "Resuming…" : "Resume now"}
                    </button>
                  </div>
                ) : isActive && sub ? (
                  freezingId === sub.id ? (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-800">
                        Pause until when?
                      </p>
                      <input
                        type="date"
                        value={freezeUntil}
                        onChange={(e) => setFreezeUntil(e.target.value)}
                        min={new Date(Date.now() + 24 * 60 * 60 * 1000)
                          .toISOString()
                          .slice(0, 10)}
                        max={sub.current_period_end ?? undefined}
                        className="input-field w-full"
                      />
                      <p className="text-xs text-gray-500">
                        We&apos;ll push your expiry forward by the same number
                        of days when you resume.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startFreeze(sub.id)}
                          disabled={loadingId === sub.id || !freezeUntil}
                          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {loadingId === sub.id ? "Freezing…" : "Confirm freeze"}
                        </button>
                        <button
                          onClick={() => {
                            setFreezingId(null);
                            setFreezeUntil("");
                          }}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : confirmCancelId === sub.id ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">
                        Your pass will stay active until{" "}
                        <span className="font-semibold">{formatPeriodDate(sub.current_period_end)}</span>.
                        You won&apos;t be charged again after that.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => { setConfirmCancelId(null); handleCancel(sub.id); }}
                          disabled={loadingId === sub.id}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-red-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                        >
                          {loadingId === sub.id ? "Cancelling..." : "Yes, Cancel"}
                        </button>
                        <button
                          onClick={() => setConfirmCancelId(null)}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 active:scale-[0.97]"
                        >
                          Keep Pass
                        </button>
                      </div>
                    </div>
                  ) : giftingId === sub.id ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                      <p className="text-sm font-medium text-emerald-900">
                        Gift classes to a friend
                      </p>
                      <input
                        type="email"
                        value={giftEmail}
                        onChange={(e) => setGiftEmail(e.target.value)}
                        placeholder="friend@example.com"
                        className="input-field w-full"
                      />
                      <input
                        type="number"
                        min="1"
                        value={giftCount}
                        onChange={(e) => setGiftCount(e.target.value)}
                        placeholder="How many classes"
                        className="input-field w-full"
                      />
                      <textarea
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                        rows={2}
                        placeholder="Optional message"
                        className="input-field w-full"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendGift(sub.id)}
                          disabled={loadingId === sub.id}
                          className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {loadingId === sub.id ? "Sending…" : "Send gift"}
                        </button>
                        <button
                          onClick={() => {
                            setGiftingId(null);
                            setGiftEmail("");
                            setGiftCount("1");
                            setGiftMessage("");
                          }}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {giftSuccess && (
                        <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
                          {giftSuccess}
                        </p>
                      )}
                      {pass.max_classes_per_month !== null && (
                        <button
                          onClick={() => setGiftingId(sub.id)}
                          className="w-full rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition-[transform,background-color] duration-150 ease-out hover:bg-emerald-50 active:scale-[0.97]"
                        >
                          🎁 Gift classes
                        </button>
                      )}
                      <button
                        onClick={() => setFreezingId(sub.id)}
                        className="w-full rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition-[transform,background-color] duration-150 ease-out hover:bg-blue-50 active:scale-[0.97]"
                      >
                        Pause / Vacation hold
                      </button>
                      <button
                        onClick={() => setConfirmCancelId(sub.id)}
                        className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-[transform,background-color] duration-150 ease-out hover:bg-red-50 active:scale-[0.97]"
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  )
                ) : isPendingCancel && sub ? (
                  <p className="mt-3 text-center text-sm text-amber-600">
                    Active until {formatPeriodDate(sub.current_period_end)}
                  </p>
                ) : isCancelled ? (
                  <p className="mt-3 text-center text-sm text-gray-400">
                    Subscription ended
                  </p>
                ) : (
                  <button
                    onClick={() => handleSubscribe(pass.id)}
                    disabled={loadingId === pass.id}
                    className="btn-primary mt-3 w-full transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100"
                  >
                    {loadingId === pass.id
                      ? "Subscribing..."
                      : `Subscribe $${(pass.price_cents / 100).toFixed(2)}/month`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
