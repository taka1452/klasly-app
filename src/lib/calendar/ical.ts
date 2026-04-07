/**
 * Generate iCalendar format content
 */

type ICalEvent = {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes?: number;
  location?: string;
};

function formatICalDate(date: string, time: string): string {
  // Convert YYYY-MM-DD and HH:MM to YYYYMMDDTHHMMSS
  const d = date.replace(/-/g, "");
  const t = time.replace(/:/g, "") + "00";
  return `${d}T${t}`;
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateICalEvent(event: ICalEvent): string {
  const dtstart = formatICalDate(event.dtstart, event.startTime);
  const duration = event.durationMinutes || 60;
  const endHour = parseInt(event.startTime.split(":")[0]) + Math.floor((parseInt(event.startTime.split(":")[1]) + duration) / 60);
  const endMin = (parseInt(event.startTime.split(":")[1]) + duration) % 60;
  const dtend = formatICalDate(
    event.dtstart,
    `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`
  );

  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICalText(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function generateICalFeed(
  calendarName: string,
  events: ICalEvent[]
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Klasly//EN",
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(generateICalEvent(event));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
