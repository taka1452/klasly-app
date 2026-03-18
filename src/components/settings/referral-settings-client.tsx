"use client";

import { useState } from "react";
import Toast from "@/components/ui/toast";

type ReferralRewardItem = {
  id: string;
  studioName: string;
  status: "pending" | "completed" | "expired";
  completedAt: string | null;
  createdAt: string;
};

type Props = {
  initialCode: string | null;
  rewards: ReferralRewardItem[];
  completedCount: number;
  savedAmount: number;
};

export default function ReferralSettingsClient({
  initialCode,
  rewards,
  completedCount,
  savedAmount,
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function ensureCode() {
    if (code) return code;
    setLoading(true);
    try {
      const res = await fetch("/api/referral/code");
      const data = await res.json();
      if (data.code) {
        setCode(data.code);
        return data.code as string;
      }
    } finally {
      setLoading(false);
    }
    return null;
  }

  async function handleCopy() {
    const c = await ensureCode();
    if (!c) return;
    const url = `${window.location.origin}/ref/${c}`;
    await navigator.clipboard.writeText(url);
    setToastMessage("Referral link copied!");
  }

  const referralUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.klasly.app"}/ref/${code}`
    : null;

  function statusBadge(status: string) {
    if (status === "completed") {
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          Completed
        </span>
      );
    }
    if (status === "expired") {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Pending
      </span>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Referral Link */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Your Referral Link</h2>
        <p className="mt-2 text-sm text-gray-600">
          Share your link with another studio owner. When they sign up and make
          their first payment, you both get 1 month free — no limits.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
            <p className="truncate text-sm font-mono text-gray-700">
              {referralUrl ?? "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading}
            className="btn-primary shrink-0"
          >
            {loading ? "Loading…" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {rewards.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand-600">{completedCount}</p>
            <p className="mt-1 text-xs text-gray-500">Referrals completed</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">${savedAmount}</p>
            <p className="mt-1 text-xs text-gray-500">Total saved</p>
          </div>
        </div>
      )}

      {/* Referral History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Referral History</h2>
        {rewards.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No referrals yet. Share your link to get started!
          </p>
        ) : (
          <div className="mt-4 divide-y divide-gray-100">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {r.studioName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(r.status)}
                  {r.completedAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(r.completedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
