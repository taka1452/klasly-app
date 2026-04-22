"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FEATURE_CATEGORIES,
  FEATURE_LABELS,
  type FeatureKey,
} from "@/lib/features/feature-keys";

type FeatureInfo = {
  enabled: boolean;
  isDefault: boolean;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
};

export default function AdminStudioFeatures({
  studioId,
}: {
  studioId: string;
}) {
  const [features, setFeatures] = useState<Record<string, FeatureInfo>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    const res = await fetch(`/api/admin/studios/${studioId}/features`);
    if (res.ok) {
      setFeatures(await res.json());
    }
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  async function handleToggle(featureKey: string, currentEnabled: boolean) {
    setToggling(featureKey);
    const res = await fetch(`/api/admin/studios/${studioId}/features`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature_key: featureKey,
        enabled: !currentEnabled,
      }),
    });
    if (res.ok) {
      setFeatures((prev) => ({
        ...prev,
        [featureKey]: {
          ...prev[featureKey],
          enabled: !currentEnabled,
          isDefault: false,
        },
      }));
    }
    setToggling(null);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white">Feature Flags</h2>
        <div className="mt-4 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-brand-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="text-lg font-semibold text-white">Feature Flags</h2>
      <p className="mt-1 text-sm text-slate-400">
        Toggle features for this studio. Changes take effect immediately.
      </p>

      <div className="mt-6 space-y-6">
        {Object.entries(FEATURE_CATEGORIES).map(
          ([categoryKey, { label, keys }]) => (
            <div key={categoryKey}>
              <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
                {label}
              </h3>
              <div className="mt-2 divide-y divide-slate-700">
                {keys.map((key) => {
                  const info = features[key];
                  if (!info) return null;
                  const isToggling = toggling === key;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-200">
                          {FEATURE_LABELS[key as FeatureKey] ?? key}
                        </span>
                        {info.isDefault && (
                          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                            default
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggle(key, info.enabled)}
                        disabled={isToggling}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                          info.enabled ? "bg-emerald-500" : "bg-slate-600"
                        } ${isToggling ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            info.enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
