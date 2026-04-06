// ============================================
// Calendar utility functions
// ============================================

export type SessionData = {
  id: string;
  class_id: string | null;
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  capacity: number;
  is_cancelled: boolean;
  class_name: string;
  duration_minutes: number;
  instructor_id: string | null;
  instructor_name: string;
  location: string | null;
  price_cents: number | null;
  room_name: string | null;
  is_online: boolean;
  online_link: string | null;
};

export type CalendarView = "day" | "week" | "month" | "list";

export const HOUR_HEIGHT = 60; // px per hour

// ─── Date helpers ───────────────────────────

/** Parse "YYYY-MM-DD" as local date (avoiding UTC shift) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Sunday-start week: get Sunday of the week containing `date` */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day); // shift to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// ─── Week helpers ───────────────────────────

/** Returns 7 Date objects for Sun–Sat of the given week */
export function getWeekDates(anchor: Date): Date[] {
  const sun = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(sun, i));
}

// ─── Month grid helpers ─────────────────────

/** Returns all dates needed for a month grid (includes padding from prev/next month) */
export function getMonthGridDates(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // Grid starts at Sunday of the week containing the 1st
  const gridStart = startOfWeek(first);
  // Grid ends at Saturday of the week containing the last day
  const lastDay = last.getDay();
  const gridEnd = lastDay === 6 ? last : addDays(last, 6 - lastDay);

  const dates: Date[] = [];
  let current = new Date(gridStart);
  while (current <= gridEnd) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ─── Time grid helpers ──────────────────────

/** Parse "HH:MM:SS" to { hours, minutes } */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(":").map(Number);
  return { hours: parts[0], minutes: parts[1] };
}

/** Calculate the visible time range from sessions (with 1hr padding) */
export function getTimeRange(sessions: SessionData[]): {
  startHour: number;
  endHour: number;
} {
  if (sessions.length === 0) {
    return { startHour: 7, endHour: 21 };
  }

  let minHour = 24;
  let maxHour = 0;

  for (const s of sessions) {
    const { hours, minutes } = parseTime(s.start_time);
    minHour = Math.min(minHour, hours);
    const endMinutes = hours * 60 + minutes + s.duration_minutes;
    maxHour = Math.max(maxHour, Math.ceil(endMinutes / 60));
  }

  return {
    startHour: Math.max(0, minHour - 1),
    endHour: Math.min(24, maxHour + 1),
  };
}

/** Convert a time string to pixel position within the grid */
export function timeToPosition(
  timeStr: string,
  gridStartHour: number,
  hourHeight: number = HOUR_HEIGHT,
): number {
  const { hours, minutes } = parseTime(timeStr);
  return (hours - gridStartHour) * hourHeight + (minutes / 60) * hourHeight;
}

/** Convert duration in minutes to pixel height */
export function durationToHeight(
  durationMinutes: number,
  hourHeight: number = HOUR_HEIGHT,
): number {
  return (durationMinutes / 60) * hourHeight;
}

// ─── Date range for fetch ───────────────────

/** Get the start/end date strings for the API call based on current view */
export function getDateRange(
  view: CalendarView,
  currentDate: Date,
): { start: string; end: string } {
  if (view === "day") {
    const d = formatYMD(currentDate);
    return { start: d, end: d };
  }
  if (view === "week" || view === "list") {
    const weekDates = getWeekDates(currentDate);
    return {
      start: formatYMD(weekDates[0]),
      end: formatYMD(weekDates[6]),
    };
  }
  // month: include padding days for the grid
  const gridDates = getMonthGridDates(
    currentDate.getFullYear(),
    currentDate.getMonth(),
  );
  return {
    start: formatYMD(gridDates[0]),
    end: formatYMD(gridDates[gridDates.length - 1]),
  };
}

// ─── Format helpers ─────────────────────────

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getDayNameShort(date: Date): string {
  return DAY_NAMES_SHORT[date.getDay()];
}

export function formatDateLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatHeaderLabel(
  view: CalendarView,
  currentDate: Date,
): string {
  if (view === "day") {
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (view === "week" || view === "list") {
    const weekDates = getWeekDates(currentDate);
    const start = weekDates[0];
    const end = weekDates[6];
    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startStr} – ${endStr}`;
  }
  // month
  return currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Format "HH:MM:SS" to "9:30 AM" */
export function formatTimeShort(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const h = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  const m = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${h}${m} ${ampm}`;
}

// ─── Overlap detection ──────────────────────

/** Detect and assign column indices for overlapping sessions in the same day */
export function assignOverlapColumns(
  sessions: SessionData[],
): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (sessions.length === 0) return result;

  // Sort by start time
  const sorted = [...sessions].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  // Build overlap groups
  type Group = SessionData[];
  const groups: Group[] = [];

  for (const session of sorted) {
    const { hours, minutes } = parseTime(session.start_time);
    const startMin = hours * 60 + minutes;
    const endMin = startMin + session.duration_minutes;

    let placed = false;
    for (const group of groups) {
      const lastInGroup = group[group.length - 1];
      const { hours: lh, minutes: lm } = parseTime(lastInGroup.start_time);
      const lastEnd = lh * 60 + lm + lastInGroup.duration_minutes;

      // Check overlap with any in group
      const overlaps = group.some((g) => {
        const { hours: gh, minutes: gm } = parseTime(g.start_time);
        const gStart = gh * 60 + gm;
        const gEnd = gStart + g.duration_minutes;
        return startMin < gEnd && endMin > gStart;
      });

      if (overlaps) {
        group.push(session);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([session]);
    }
  }

  for (const group of groups) {
    const totalCols = group.length;
    group.forEach((session, col) => {
      result.set(session.id, { col, totalCols });
    });
  }

  return result;
}
