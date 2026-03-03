"use client";

import { useEffect, useState } from "react";

type Props = {
  className?: string;
};

type Setting = { key: string; value: string };

export default function AdminPlatformSettings({ className }: Props) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFeePercent, setPlatformFeePercent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/platform-settings");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setSettings(data.settings ?? []);
      const fee = (data.settings ?? []).find(
        (s: Setting) => s.key === "platform_fee_percent"
      );
      setPlatformFeePercent(fee?.value ?? "0");
    })()
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    const num = parseFloat(platformFeePercent);
    if (Number.isNaN(num) || num < 0 || num > 30) {
      alert("Platform fee must be between 0 and 30");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "platform_fee_percent",
          value: String(num),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to save");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="card">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Platform Fee</h2>
        <p className="mt-2 text-sm text-slate-600">
          The percentage fee charged on each member payment processed through
          Stripe Connect. This is deducted from the studio&apos;s revenue. Set to
          0 to charge no platform fee.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="platform-fee">
            Platform fee (%)
          </label>
          <input
            id="platform-fee"
            type="number"
            min={0}
            max={30}
            step={0.1}
            value={platformFeePercent}
            onChange={(e) => setPlatformFeePercent(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-600">%</span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && (
            <span className="text-sm font-medium text-green-600">Saved</span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Current value: {platformFeePercent}%
        </p>
      </div>
    </div>
  );
}
