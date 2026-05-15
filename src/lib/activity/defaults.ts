import type { AlertThresholds, DisplayPrefs } from "./types";

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  inactive_member_days: 28,
  no_show_streak: 3,
  unpaid_grace_days: 3,
  waiver_unsigned_after_days: 7,
  cancellation_rate_threshold: 40,
  follow_up_after_days: 7,
  contract_stuck_days: 7,
};

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  hide_read: false,
  default_tab: "all",
};

export function resolveThresholds(
  raw?: Partial<AlertThresholds> | null,
): AlertThresholds {
  return { ...DEFAULT_ALERT_THRESHOLDS, ...(raw ?? {}) };
}

export function resolveDisplayPrefs(
  raw?: Partial<DisplayPrefs> | null,
): DisplayPrefs {
  return { ...DEFAULT_DISPLAY_PREFS, ...(raw ?? {}) };
}
