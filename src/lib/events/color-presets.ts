/**
 * Preset color swatches for events (workshops, retreats, etc.) so they stand
 * out on the schedule. Matches Tailwind 500-shade brand families. The first
 * entry is used as the default color for new events.
 *
 * Requested by Sunrise Yoga Studio (Jamie feedback 2026-04): "Can we add a
 * color option for Events?"
 */
export const EVENT_COLOR_PRESETS = [
  { label: "Brand", value: "#0074c5" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Orange", value: "#f97316" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Pink", value: "#ec4899" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Slate", value: "#64748b" },
] as const;

export type EventColorPreset = (typeof EVENT_COLOR_PRESETS)[number];

export const DEFAULT_EVENT_COLOR = EVENT_COLOR_PRESETS[0].value;
