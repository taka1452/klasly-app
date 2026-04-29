/**
 * Minimal iCalendar (.ics) generator for the studio schedule feed.
 *
 * - Supports a single VCALENDAR with N VEVENT children.
 * - DTSTART/DTEND use floating local times (no TZ) when sessions are
 *   in-person — calendar clients render them in the studio's local time
 *   exactly the way they are stored. For online sessions we still use
 *   floating time; the studio's timezone is communicated via
 *   X-WR-TIMEZONE so most clients display correctly.
 * - Fold lines at 75 octets per RFC 5545.
 *
 * No external dependency on purpose: keeps cold-start fast and avoids a
 * 200KB ical-generator package for what is essentially string assembly.
 */

export type IcsEvent = {
  uid: string;                 // Unique stable id (e.g. session_<id>)
  startLocal: string;          // "YYYY-MM-DDTHH:MM:SS"
  endLocal: string;            // "YYYY-MM-DDTHH:MM:SS"
  summary: string;             // Title shown in the user's calendar
  description?: string;        // Body / notes
  location?: string;           // Address or online link
  url?: string;                // Web URL for the session
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  /** ISO timestamp of the last edit on the source row; drives DTSTAMP. */
  lastModified?: string;
};

export type IcsCalendarOptions = {
  calendarName: string;
  calendarDescription?: string;
  /** IANA timezone (e.g. "America/Los_Angeles"). Sent as X-WR-TIMEZONE. */
  timezone?: string;
  /** Refresh interval hint for clients (e.g. "PT1H"). */
  refreshInterval?: string;
  /** Stable identifier for this calendar feed. */
  prodId?: string;
};

const PROD_ID_DEFAULT = "-//Klasly//Schedule Feed 1.0//EN";

export function buildIcs(
  events: IcsEvent[],
  options: IcsCalendarOptions
): string {
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${escapeText(options.prodId ?? PROD_ID_DEFAULT)}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeText(options.calendarName)}`);
  if (options.calendarDescription) {
    lines.push(`X-WR-CALDESC:${escapeText(options.calendarDescription)}`);
  }
  if (options.timezone) {
    lines.push(`X-WR-TIMEZONE:${escapeText(options.timezone)}`);
  }
  if (options.refreshInterval) {
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${options.refreshInterval}`);
    lines.push(`X-PUBLISHED-TTL:${options.refreshInterval}`);
  }

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(ev.uid)}`);
    lines.push(`DTSTAMP:${toIcsUtc(ev.lastModified ?? new Date().toISOString())}`);
    lines.push(`DTSTART:${toIcsLocal(ev.startLocal)}`);
    lines.push(`DTEND:${toIcsLocal(ev.endLocal)}`);
    lines.push(`SUMMARY:${escapeText(ev.summary)}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    }
    if (ev.location) {
      lines.push(`LOCATION:${escapeText(ev.location)}`);
    }
    if (ev.url) {
      lines.push(`URL:${escapeText(ev.url)}`);
    }
    if (ev.status) {
      lines.push(`STATUS:${ev.status}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Fold long lines per RFC 5545 (75 octets) and join with CRLF.
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}

function foldLine(line: string): string[] {
  if (line.length <= 75) return [line];
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      out.push(line.slice(0, 75));
      i = 75;
    } else {
      out.push(" " + line.slice(i, i + 74));
      i += 74;
    }
  }
  return out;
}

function escapeText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Convert "YYYY-MM-DDTHH:MM:SS" to "YYYYMMDDTHHMMSS" (floating local). */
function toIcsLocal(local: string): string {
  // Accept both "YYYY-MM-DD HH:MM:SS" and ISO with T.
  const cleaned = local.replace("T", " ").trim();
  const [date, time = "00:00:00"] = cleaned.split(/\s+/);
  const [y, m, d] = date.split("-");
  const [hh, mm, ss = "00"] = time.split(":");
  return `${y}${m}${d}T${hh}${mm}${ss.slice(0, 2)}`;
}

/** Convert ISO string to "YYYYMMDDTHHMMSSZ" UTC. */
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return toIcsUtc(new Date().toISOString());
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
