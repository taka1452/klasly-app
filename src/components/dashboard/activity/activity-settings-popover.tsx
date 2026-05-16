"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_DISPLAY_PREFS,
} from "@/lib/activity/defaults";
import type {
  AlertThresholds,
  DisplayPrefs,
} from "@/lib/activity/types";
import { csrfFetch } from "@/lib/api/csrf-client";

interface Props {
  initialThresholds: AlertThresholds;
  initialDisplayPrefs: DisplayPrefs;
  canEditThresholds: boolean;
}

export function ActivitySettingsPopover({
  initialThresholds,
  initialDisplayPrefs,
  canEditThresholds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [prefs, setPrefs] = useState(initialDisplayPrefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/activity/settings", {
        method: "POST",
        body: JSON.stringify({
          thresholds: canEditThresholds ? thresholds : undefined,
          displayPrefs: prefs,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save settings");
      }
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (canEditThresholds) setThresholds(DEFAULT_ALERT_THRESHOLDS);
    setPrefs(DEFAULT_DISPLAY_PREFS);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 motion-safe:transition motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-gray-100 hover:text-gray-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
        aria-label="Activity settings"
        aria-expanded={open}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.27 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
          />
          <circle cx="12" cy="12" r="2.625" />
        </svg>
      </button>
      {open && (
        <div
          className="popover-in absolute right-0 top-10 z-20 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
          style={{ "--popover-origin": "top right" } as React.CSSProperties}
        >
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Activity settings
          </h3>
          {canEditThresholds && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Alert thresholds
              </p>
              <div className="space-y-2">
                <ThresholdRow
                  label="Inactive member"
                  value={thresholds.inactive_member_days}
                  unit="days"
                  onChange={(v) =>
                    setThresholds((t) => ({ ...t, inactive_member_days: v }))
                  }
                />
                <ThresholdRow
                  label="No-show streak"
                  value={thresholds.no_show_streak}
                  unit="x"
                  onChange={(v) =>
                    setThresholds((t) => ({ ...t, no_show_streak: v }))
                  }
                />
                <ThresholdRow
                  label="Unpaid grace"
                  value={thresholds.unpaid_grace_days}
                  unit="days"
                  onChange={(v) =>
                    setThresholds((t) => ({ ...t, unpaid_grace_days: v }))
                  }
                />
                <ThresholdRow
                  label="Waiver unsigned after"
                  value={thresholds.waiver_unsigned_after_days}
                  unit="days"
                  onChange={(v) =>
                    setThresholds((t) => ({
                      ...t,
                      waiver_unsigned_after_days: v,
                    }))
                  }
                />
                <ThresholdRow
                  label="High cancellation rate"
                  value={thresholds.cancellation_rate_threshold}
                  unit="%"
                  onChange={(v) =>
                    setThresholds((t) => ({
                      ...t,
                      cancellation_rate_threshold: v,
                    }))
                  }
                />
                <ThresholdRow
                  label="New member follow-up"
                  value={thresholds.follow_up_after_days}
                  unit="days"
                  onChange={(v) =>
                    setThresholds((t) => ({ ...t, follow_up_after_days: v }))
                  }
                />
                <ThresholdRow
                  label="Contract awaiting"
                  value={thresholds.contract_stuck_days}
                  unit="days"
                  onChange={(v) =>
                    setThresholds((t) => ({ ...t, contract_stuck_days: v }))
                  }
                />
                <ThresholdRow
                  label="Tier limit warning"
                  value={thresholds.tier_limit_warning_pct}
                  unit="%"
                  onChange={(v) =>
                    setThresholds((t) => ({
                      ...t,
                      tier_limit_warning_pct: Math.min(99, Math.max(50, v)),
                    }))
                  }
                />
              </div>
            </div>
          )}
          <div className={canEditThresholds ? "mt-4 border-t border-gray-200 pt-3" : ""}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Display
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={prefs.hide_read}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, hide_read: e.target.checked }))
                }
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Hide read items
            </label>
          </div>
          {error && (
            <p className="mt-3 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetDefaults}
              className="rounded text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Reset defaults
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-brand-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:active:scale-100"
            >
              {saving && (
                <svg
                  className="h-3 w-3 motion-safe:animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThresholdRow({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            onChange(Number.isNaN(next) ? 0 : next);
          }}
          className="w-14 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <span className="w-8 text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  );
}
