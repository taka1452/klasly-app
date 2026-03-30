"use client";

import { useState, useEffect, useCallback } from "react";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import HelpTip from "@/components/ui/help-tip";
import ContextHelpLink from "@/components/help/context-help-link";

function UTMLinkBuilder() {
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (source) params.set("utm_source", source);
    if (medium) params.set("utm_medium", medium);
    if (campaign) params.set("utm_campaign", campaign);
    const qs = params.toString();
    return qs ? `${baseUrl}/schedule?${qs}` : "";
  }, [source, medium, campaign, baseUrl]);

  const generatedUrl = buildUrl();

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const presets = [
    { label: "Instagram", source: "instagram", medium: "social" },
    { label: "Facebook", source: "facebook", medium: "social" },
    { label: "Email", source: "newsletter", medium: "email" },
    { label: "Google", source: "google", medium: "cpc" },
  ];

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Link Builder</h2>
      <p className="mt-1 text-sm text-gray-500">
        Generate tracking links for your booking page.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { setSource(p.source); setMedium(p.medium); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              source === p.source
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">Source</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value.trim())}
            placeholder="instagram"
            className="input-field mt-1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Medium</label>
          <input
            type="text"
            value={medium}
            onChange={(e) => setMedium(e.target.value.trim())}
            placeholder="social"
            className="input-field mt-1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Campaign</label>
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value.trim())}
            placeholder="summer2025"
            className="input-field mt-1"
          />
        </div>
      </div>

      {generatedUrl && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500">Generated URL</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {generatedUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const analyticsEnabled = isEnabled(FEATURE_KEYS.ANALYTICS);
  const utmEnabled = isEnabled(FEATURE_KEYS.UTM_TRACKING);

  if (!analyticsEnabled) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </div>
        <p className="mt-2 text-sm text-gray-500">This feature is not enabled for your studio.</p>
      </div>
    );
  }

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
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <ContextHelpLink href="/help/analytics/view-analytics" />
      </div>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Track your studio&apos;s performance
      </p>

      {!utmEnabled ? (
        <div className="card">
          <p className="text-sm text-gray-600">
            UTM tracking is not enabled for your studio.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Enable it in <strong>Settings → Features</strong> to start tracking where your members come from.
          </p>
          <a href="/settings/features" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
            Enable UTM Tracking →
          </a>
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

          {/* UTM Link Builder */}
          <UTMLinkBuilder />
        </div>
      )}
    </div>
  );
}
