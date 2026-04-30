/**
 * Studio timezone helpers used by online-class displays.
 *
 * - getTimezoneAbbreviation("America/Los_Angeles") → "PT" (or "PST" / "PDT"
 *   depending on the date passed in)
 * - getViewerTimezone() returns the current browser's IANA timezone, with a
 *   safe fallback for SSR.
 * - convertWallTimeToViewer(date, hhmm, studioTz) returns the same instant
 *   re-formatted for the viewer's locale, useful for "your time: 7:00 PM ET"
 *   parentheticals on online classes.
 */

const SHORT_TZ_FALLBACK: Record<string, string> = {
  "America/Los_Angeles": "PT",
  "America/Denver": "MT",
  "America/Chicago": "CT",
  "America/New_York": "ET",
  "America/Phoenix": "MST",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HT",
  "Europe/London": "UK",
  "Europe/Paris": "CET",
  "Europe/Berlin": "CET",
  "Asia/Tokyo": "JST",
  "Asia/Seoul": "KST",
  "Asia/Shanghai": "CST",
  "Asia/Singapore": "SGT",
  "Asia/Kolkata": "IST",
  "Australia/Sydney": "AET",
  UTC: "UTC",
};

/**
 * Compact timezone abbreviation for a given IANA name on a given date.
 * Tries the browser's Intl support first; falls back to a hand-rolled map
 * for the most common studio timezones if Intl returns something unhelpful
 * like "GMT-7" or the literal IANA name.
 */
export function getTimezoneAbbreviation(
  iana: string | null | undefined,
  date: Date = new Date()
): string {
  if (!iana) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "short",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    const value = tzPart?.value ?? "";
    if (value && !/^GMT[+-]/.test(value)) return value;
  } catch {
    // ignore — fall through to the manual map
  }
  return SHORT_TZ_FALLBACK[iana] ?? iana;
}

/** Browser's IANA timezone, falling back to UTC during SSR. */
export function getViewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Convert a wall-clock time in the studio's timezone to the viewer's local
 * wall-clock time, returning a "h:mm AM/PM" string. Useful when an online
 * class is "7:00 PM PT" and we want to also show "10:00 PM ET" for an
 * east-coast viewer.
 *
 * `dateYmd` is "YYYY-MM-DD" and `timeHm` is "HH:MM"; both are in `studioTz`.
 * Returns the same instant re-formatted in `viewerTz`. Returns "" when the
 * two timezones match, when the inputs are malformed, or on Intl errors.
 */
export function convertWallTimeToViewer(
  dateYmd: string,
  timeHm: string,
  studioTz: string,
  viewerTz: string = getViewerTimezone()
): string {
  if (!studioTz || !viewerTz || studioTz === viewerTz) return "";
  try {
    const [y, m, d] = dateYmd.split("-").map(Number);
    const [hh, mm] = timeHm.split(":").map(Number);
    const candidate = new Date(
      Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
    );
    const studioOffsetMin = getTimezoneOffsetMinutes(studioTz, candidate);
    const utc = new Date(candidate.getTime() - studioOffsetMin * 60_000);

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: viewerTz,
      hour12: true,
    }).format(utc);
  } catch {
    return "";
  }
}

/**
 * Minutes east of UTC for a given IANA timezone on a given date.
 * Negative for west-of-UTC (e.g. -420 for PT during DST).
 */
function getTimezoneOffsetMinutes(iana: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const lookup: Record<string, string> = {};
    for (const p of parts) lookup[p.type] = p.value;
    const asUtc = Date.UTC(
      Number(lookup.year),
      Number(lookup.month) - 1,
      Number(lookup.day),
      Number(lookup.hour),
      Number(lookup.minute),
      Number(lookup.second)
    );
    return Math.round((asUtc - date.getTime()) / 60_000);
  } catch {
    return 0;
  }
}
