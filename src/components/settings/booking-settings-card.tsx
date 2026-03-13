"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** DB の現在値: null=自動, true=常に必須, false=常に不要 */
  bookingRequiresCredits: boolean | null;
  /** Stripe Connect 完了フラグ（自動判定の説明文に使用） */
  stripeConnectComplete: boolean;
};

type SettingValue = "auto" | "always" | "never";

function toSettingValue(v: boolean | null): SettingValue {
  if (v === true) return "always";
  if (v === false) return "never";
  return "auto";
}

function toDbValue(v: SettingValue): boolean | null {
  if (v === "always") return true;
  if (v === "never") return false;
  return null;
}

export default function BookingSettingsCard({
  bookingRequiresCredits,
  stripeConnectComplete,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<SettingValue>(
    toSettingValue(bookingRequiresCredits)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自動判定の現在の動作を説明するラベル
  const autoLabel = stripeConnectComplete
    ? "Credits required (Stripe Connect is active)"
    : "Credits not required (Stripe Connect is not set up — cash studio mode)";

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/studio/booking-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_requires_credits: toDbValue(selected) }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Booking Credit Requirement
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Control whether members need credits to book classes. Credits are
          consumed when a booking is confirmed and refunded on cancellation.
        </p>
      </div>

      {/* 自動判定の現在の状態バナー */}
      {selected === "auto" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <p className="text-sm text-blue-700">
            <span className="font-medium">Auto-detected: </span>
            {autoLabel}
          </p>
        </div>
      )}

      {/* ラジオ選択 */}
      <div className="space-y-3">
        {(
          [
            {
              value: "auto" as SettingValue,
              label: "Auto (Recommended)",
              description:
                "Automatically requires credits when Stripe Connect is active. Disables the requirement for cash-based studios.",
            },
            {
              value: "always" as SettingValue,
              label: "Always require credits",
              description:
                "Members must have credits to book, regardless of payment setup. Suitable for studios that want strict credit control.",
            },
            {
              value: "never" as SettingValue,
              label: "Never require credits",
              description:
                "Members can book freely without credits. Useful for cash studios or when you manage attendance manually.",
            },
          ] as const
        ).map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
              selected === opt.value
                ? "border-brand-400 bg-brand-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="booking_requires_credits"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              className="mt-0.5 accent-brand-500"
            />
            <div>
              <p
                className={`text-sm font-medium ${
                  selected === opt.value ? "text-brand-700" : "text-gray-900"
                }`}
              >
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* エラー表示 */}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* 保存ボタン */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="text-sm font-medium text-green-600">
            Saved ✓
          </span>
        )}
      </div>
    </div>
  );
}
