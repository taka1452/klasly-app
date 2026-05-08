"use client";

import CalendarMonthEvent from "./calendar-month-event";
import {
  type SessionData,
  type CalendarEvent,
  type CalendarView,
  getMonthGridDates,
  isToday,
  isSameDay,
  formatYMD,
} from "./calendar-utils";

type Props = {
  currentDate: Date;
  sessions: SessionData[];
  bookings: Record<string, { id: string; status: string }>;
  events?: CalendarEvent[];
  onDayClick: (date: Date) => void;
  isMobile: boolean;
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarMonthView({
  currentDate,
  sessions,
  bookings,
  events = [],
  onDayClick,
  isMobile,
}: Props) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const gridDates = getMonthGridDates(year, month);

  // Group sessions by date
  const sessionsByDate = new Map<string, SessionData[]>();
  for (const s of sessions) {
    const key = s.session_date;
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < gridDates.length; i += 7) {
    weeks.push(gridDates.slice(i, i + 7));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="border-r border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-500 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((date, di) => {
            const dateStr = formatYMD(date);
            const daySessions = sessionsByDate.get(dateStr) || [];
            const isCurrentMonth = date.getMonth() === month;
            const today = isToday(date);
            const maxVisible = isMobile ? 0 : 3;
            const remaining = daySessions.length - maxVisible;

            return (
              <div
                key={di}
                className={`relative min-h-[80px] cursor-pointer border-b border-r border-gray-200 p-1 transition-colors hover:bg-gray-50 last:border-r-0 md:min-h-[100px] ${
                  !isCurrentMonth ? "bg-gray-50/50" : ""
                }`}
                onClick={() => onDayClick(date)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      today
                        ? "bg-brand-600 text-white"
                        : isCurrentMonth
                          ? "text-gray-900"
                          : "text-gray-400"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {/* Mobile: show dot count */}
                  {isMobile && (daySessions.length > 0 || events.some((e) => e.start_date <= dateStr && e.end_date >= dateStr)) && (
                    <span className="flex gap-0.5">
                      {events
                        .filter((e) => e.start_date <= dateStr && e.end_date >= dateStr)
                        .slice(0, 1)
                        .map((e) => (
                          <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                        ))}
                      {daySessions.slice(0, 3).map((s, i) => {
                        const b = bookings[s.id];
                        let dotColor = "bg-brand-400";
                        if (b?.status === "confirmed") dotColor = "bg-green-400";
                        else if (b?.status === "waitlist") dotColor = "bg-amber-400";
                        return (
                          <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                          />
                        );
                      })}
                      {daySessions.length > 3 && (
                        <span className="text-[9px] text-gray-400">
                          +{daySessions.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Desktop: event pills */}
                {!isMobile && (() => {
                  const dayEvents = events.filter(
                    (e) => e.start_date <= dateStr && e.end_date >= dateStr
                  );
                  const eventSlots = dayEvents.length;
                  const adjustedMax = Math.max(0, maxVisible - eventSlots);
                  const sessionRemaining = daySessions.length - adjustedMax;
                  return (
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="truncate rounded bg-purple-100 px-1 py-px text-[10px] font-medium text-purple-700"
                        >
                          📅 {ev.name}
                        </div>
                      ))}
                      {daySessions.slice(0, adjustedMax).map((session) => (
                        <CalendarMonthEvent
                          key={session.id}
                          eventName={session.class_name}
                          startTime={session.start_time}
                          bookingStatus={bookings[session.id]?.status || null}
                          isOnline={session.is_online}
                        />
                      ))}
                      {sessionRemaining > 0 && (
                        <div className="px-1 text-[10px] font-medium text-gray-500">
                          +{sessionRemaining} more
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
