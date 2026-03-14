"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

type MembershipInfo = {
  hasTier: boolean;
  tierName?: string;
  monthlyMinutes?: number;
  monthlyPrice?: number;
  subscriptionActive?: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
};

export default function InstructorMembershipPage() {
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<MembershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchInfo = useCallback(async () => {
    const res = await fetch("/api/instructor/membership");
    if (res.ok) {
      setInfo(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInfo();
    if (searchParams.get("success") === "true") {
      setSuccess("サブスクリプションが開始されました！");
    }
  }, [fetchInfo, searchParams]);

  async function handleSubscribe() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/instructor-membership-checkout", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "チェックアウトの作成に失敗しました");
        setActionLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("エラーが発生しました");
      setActionLoading(false);
    }
  }

  function formatMinutes(minutes: number) {
    if (minutes === -1) return "無制限";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  if (!info?.hasTier) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">メンバーシップ</h1>
        <div className="mt-6 card py-12 text-center">
          <p className="text-gray-500">
            メンバーシップティアが割り当てられていません。
          </p>
          <p className="mt-1 text-sm text-gray-400">
            スタジオオーナーにお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">メンバーシップ</h1>
      <p className="mt-1 text-sm text-gray-500">
        ルーム予約ティアと支払い状況
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      <div className="mt-6 card">
        <h2 className="text-lg font-semibold text-gray-900">
          {info.tierName}
        </h2>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-gray-500">月間利用時間</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatMinutes(info.monthlyMinutes ?? 0)}
            </dd>
          </div>
          {info.monthlyPrice != null && info.monthlyPrice > 0 && (
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">月額料金</dt>
              <dd className="text-sm font-medium text-gray-900">
                ${(info.monthlyPrice / 100).toFixed(2)} / 月
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-sm text-gray-500">支払いステータス</dt>
            <dd>
              {info.subscriptionActive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  有効
                </span>
              ) : info.monthlyPrice && info.monthlyPrice > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  未登録
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  無料
                </span>
              )}
            </dd>
          </div>
          {info.cancelAtPeriodEnd && info.currentPeriodEnd && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              サブスクリプションは{" "}
              {new Date(info.currentPeriodEnd).toLocaleDateString("ja-JP")} に
              キャンセルされます。
            </div>
          )}
        </dl>

        {info.monthlyPrice && info.monthlyPrice > 0 && !info.subscriptionActive && (
          <button
            onClick={handleSubscribe}
            disabled={actionLoading}
            className="btn-primary mt-6"
          >
            {actionLoading ? "処理中..." : "サブスクリプションを開始"}
          </button>
        )}
      </div>
    </div>
  );
}
