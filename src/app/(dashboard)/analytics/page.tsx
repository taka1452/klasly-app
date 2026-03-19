"use client";

import { useState, useEffect } from "react";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import HelpTip from "@/components/ui/help-tip";

type TrafficSource = {
  name: string;
  count: number;
  percentage: number;
};

type Campaign = {
  name: string;
  count: number;
};

export default function AnalyticsPage() {
  const { isEnabled } = useFeature();
  const [sources, setSources] = useState<TrafficSource[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const utmEnabled = isEnabled(FEATURE_KEYS.UTM_TRACKING);

  useEffect(() => {
    if (!utmEnabled) {
      setLoading(false);
      return;
    }

    fetch("/api/analytics/traffic-sources")
      .then((res) => res.json())
      .then((data) => {
        setSources(data.sources || []);
        setCampaigns(data.campaigns || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [utmEnabled]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Track your studio&apos;s performance
      </p>

      {!utmEnabled ? (
        <div className="card">
          <p className="text-sm text-gray-500">
            UTM tracking is not enabled for your studio. Contact support to
            enable traffic source analytics.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Traffic Sources */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">
              Traffic Sources
              <HelpTip
                text="Add ?utm_source=instagram to your booking link to track where members come from."
                helpSlug="utm-tracking"
              />
              <span className="ml-2 text-sm font-normal text-gray-400">
                Last 30 days
              </span>
            </h2>

            {sources.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  No traffic data yet. Share your booking link with UTM
                  parameters to start tracking.
                </p>
                <div className="mt-3 rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-700">
                    💡 Tip: Add ?utm_source=instagram to your booking link when
                    sharing on social media to track where your members come from.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium text-right">Clicks</th>
                      <th className="pb-2 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => (
                      <tr key={s.name} className="border-b border-gray-100">
                        <td className="py-2 font-medium text-gray-900">
                          {s.name}
                        </td>
                        <td className="py-2 text-right text-gray-600">
                          {s.count}
                        </td>
                        <td className="py-2 text-right text-gray-400">
                          {s.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm text-gray-400">
                  Total: {total} clicks
                </p>
              </>
            )}
          </div>

          {/* Top Campaigns */}
          {campaigns.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900">
                Top Campaigns
              </h2>
              <div className="mt-4 space-y-2">
                {campaigns.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-gray-500">{c.count} clicks</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> Add{" "}
              <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">
                ?utm_source=instagram
              </code>{" "}
              to your booking link when sharing on social media to track where
              your members come from.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
