"use client";

import { EVENT_COLOR_PRESETS } from "@/lib/events/color-presets";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Optional inline label shown above the swatches. */
  label?: string;
};

/**
 * Small horizontal swatch strip + "Other" hex input. Used in the event
 * create/edit forms so studios can color-code their events.
 */
export default function EventColorPicker({ value, onChange, label = "Event color" }: Props) {
  const isPreset = EVENT_COLOR_PRESETS.some((p) => p.value === value);
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {EVENT_COLOR_PRESETS.map((preset) => {
          const selected = preset.value === value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              title={preset.label}
              aria-label={`${preset.label} color`}
              aria-pressed={selected}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                selected ? "border-gray-900 ring-2 ring-white ring-offset-1" : "border-white"
              }`}
              style={{ background: preset.value }}
            />
          );
        })}
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <span>Other</span>
          <input
            type="color"
            value={isPreset ? "#888888" : value || "#888888"}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-gray-200 bg-transparent p-0"
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Shown as the accent color on the schedule and event cards.
      </p>
    </div>
  );
}
