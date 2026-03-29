/**
 * Generate a Google Calendar event URL.
 * Opens Google Calendar "create event" page with pre-filled data.
 * No API keys or OAuth required.
 */

type CalendarEventParams = {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (if omitted, same as startDate)
  startTime?: string; // HH:MM (24h) — omit for all-day events
  endTime?: string; // HH:MM (24h)
  location?: string;
  description?: string;
};

/**
 * Format date for Google Calendar URL.
 * All-day events: YYYYMMDD
 * Timed events: YYYYMMDDTHHmmSS
 */
function formatCalDate(date: string, time?: string): string {
  const d = date.replace(/-/g, "");
  if (!time) return d;
  const t = time.replace(/:/g, "");
  return `${d}T${t}00`;
}

export function generateGoogleCalendarUrl(params: CalendarEventParams): string {
  const {
    title,
    startDate,
    endDate,
    startTime,
    endTime,
    location,
    description,
  } = params;

  const isAllDay = !startTime;

  let dates: string;
  if (isAllDay) {
    // All-day: end date should be day AFTER the last day (Google Calendar convention)
    const end = endDate || startDate;
    const endPlusOne = new Date(end + "T00:00:00");
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    const endStr = endPlusOne.toISOString().slice(0, 10);
    dates = `${formatCalDate(startDate)}/${formatCalDate(endStr)}`;
  } else {
    const start = formatCalDate(startDate, startTime);
    const end = formatCalDate(endDate || startDate, endTime || startTime);
    dates = `${start}/${end}`;
  }

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", dates);
  if (location) url.searchParams.set("location", location);
  if (description) url.searchParams.set("details", description);

  return url.toString();
}

/**
 * Convenience: generate URL for a class session booking.
 */
export function generateClassCalendarUrl(params: {
  className: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  instructorName?: string;
  location?: string;
  studioName?: string;
}): string {
  const { className, date, startTime, durationMinutes, instructorName, location, studioName } = params;

  // Calculate end time
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const parts = [className];
  if (instructorName) parts.push(`with ${instructorName}`);
  if (studioName) parts.push(`at ${studioName}`);

  return generateGoogleCalendarUrl({
    title: className,
    startDate: date,
    startTime,
    endTime,
    location,
    description: parts.join(" "),
  });
}
