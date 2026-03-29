"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWidgetTheme } from "./widget-theme-provider";

type PassData = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_classes_per_month: number | null;
  billing_interval: string;
};

type PassesResponse = {
  passes: PassData[];
  studioName: string;
  currency: string;
};

export default function WidgetBuyButton({ studioId }: { studioId: string }) {
  const theme = useWidgetTheme();
  const [data, setData] = useState<PassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/widget/${studioId}/passes`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // サイレント失敗
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  // iframeリサイズ
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight;
        window.parent.postMessage(
          { type: "KLASLY_RESIZE", height: height + 20 },
          "*",
        );
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function formatPrice(cents: number, currency: string) {
    const symbol = currency === "jpy" ? "¥" : "$";
    const amount = currency === "jpy" ? cents : (cents / 100).toFixed(2);
    return `${symbol}${amount}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4">
      {/* ヘッダー */}
      {data?.studioName && (
        <div className="mb-4">
          <h2 className="text-lg font-bold" style={{ color: theme.primary }}>
            {data.studioName}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Memberships & Passes
          </p>
        </div>
      )}

      {/* パス一覧 */}
      {!data?.passes || data.passes.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-400">No passes available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.passes.map((pass) => (
            <div
              key={pass.id}
              className="rounded-xl border border-gray-100 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900">
                    {pass.name}
                  </h3>
                  {pass.description && (
                    <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                      {pass.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-base font-bold text-gray-900">
                      {formatPrice(pass.price_cents, data.currency)}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      /{pass.billing_interval === "year" ? "year" : "month"}
                    </span>
                  </div>
                  {pass.max_classes_per_month && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      {pass.max_classes_per_month} classes/month
                    </p>
                  )}
                </div>
                <a
                  href={`${baseUrl}/my-passes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                >
                  Subscribe
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* フッター */}
      <div className="mt-4 text-right">
        <span className="text-[10px] text-gray-300">Powered by Klasly</span>
      </div>
    </div>
  );
}
