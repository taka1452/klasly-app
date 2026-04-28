/**
 * Helpers for the weekly attendance streak. Storage layout:
 *  - members.current_streak_weeks: int, kept fresh by attendance
 *    trigger and decayed by /api/cron/streak-decay.
 *  - members.last_attended_week: ISO date (Monday) of the most
 *    recent week with at least one attended class.
 */

/** Returns the Monday (UTC) of the given date as YYYY-MM-DD. */
export function weekStartUTC(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export type StreakState = {
  weeks: number;
  /** True when the streak is "active" — attended this week or last week. */
  active: boolean;
  /** True when streak will break unless they attend this week. */
  atRisk: boolean;
  longest: number;
};

export function computeStreakState(
  currentStreakWeeks: number,
  lastAttendedWeek: string | null,
  longestStreakWeeks: number,
  now: Date = new Date()
): StreakState {
  if (!lastAttendedWeek || currentStreakWeeks <= 0) {
    return { weeks: 0, active: false, atRisk: false, longest: longestStreakWeeks };
  }
  const thisWeek = weekStartUTC(now);
  const lastWeekDate = new Date(thisWeek);
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
  const lastWeek = lastWeekDate.toISOString().slice(0, 10);

  if (lastAttendedWeek === thisWeek) {
    return { weeks: currentStreakWeeks, active: true, atRisk: false, longest: longestStreakWeeks };
  }
  if (lastAttendedWeek === lastWeek) {
    // Last week counted; this week missing → at risk
    return { weeks: currentStreakWeeks, active: true, atRisk: true, longest: longestStreakWeeks };
  }
  // Older than last week — streak should be 0 (cron will catch up)
  return { weeks: 0, active: false, atRisk: false, longest: longestStreakWeeks };
}
