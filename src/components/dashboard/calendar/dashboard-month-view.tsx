"use client";

import { type DashboardSessionData } from "./dashboard-event-card";
import {
  getMonthGridDates,
  isToday,
  formatYMD,
  formatTimeShort,
} from "@/components/member/calendar/calendar-utils";

type Props = {
  currentDate: Date;
  sessions: DashboardSessionData[];
  confirmedCounts: Record<string, number>;
  onDayClick: (date: Date) => void;
  isMobile: boolean;
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardMonthView({
  currentDate,
  sessions,
  confirmedCounts,
  onDayClick,
  isMobile,
}: Props) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const gridDates = getMonthGridDates(year, month);

  // Group sessions by date
  const sessionsByDate = new Map<string, DashboardSessionData[]>();
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
                className={`relative min-h-[80px] cursor-pointer border-b border-r border-gray-200 p-1.5 transition-colors hover:bg-gray-50 last:border-r-0 md:min-h-[128px] ${
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
                  {/* Mobile: dot indicators */}
                  {isMobile && daySessions.length > 0 && (
                    <span className="flex gap-0.5">
                      {daySessions.slice(0, 3).map((s, i) => {
                        let dotColor = "bg-brand-400";
                        if (s.event_type === "room_booking") dotColor = "bg-teal-400";
                        else if (s.is_cancelled) dotColor = "bg-gray-400";
                        else if (!s.is_public) dotColor = "bg-violet-400";
                        else if (confirmedCounts[s.id] >= s.capacity) dotColor = "bg-amber-400";
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
                {!isMobile && (
                  <div className="mt-1 space-y-0.5">
                    {daySessions.slice(0, maxVisible).map((session) => {
                      const isRoomBooking = session.event_type === "room_booking";
                      const confirmed = confirmedCounts[session.id] ?? 0;
                      const isFull = confirmed >= session.capacity;
                      const remainingSpots = session.capacity - confirmed;
                      // "Almost full": <= 2 spots and at least 1 booking
                      const isAlmostFull =
                        !isFull &&
                        !isRoomBooking &&
                        !session.is_cancelled &&
                        confirmed > 0 &&
                        remainingSpots <= 2;
                      let bg = "bg-brand-100 text-brand-800";
                      if (isRoomBooking) {
                        bg = "bg-teal-100 text-teal-800";
                      } else if (session.is_cancelled) {
                        bg = "bg-gray-100 text-gray-500";
                      } else if (!session.is_public) {
                        bg = "bg-violet-100 text-violet-800";
                      } else if (isFull) {
                        bg = "bg-amber-100 text-amber-800";
                      } else if (isAlmostFull) {
                        bg = "bg-orange-50 text-orange-800";
                      }
                      return (
                        <div
                          key={session.id}
                          className={`flex items-center gap-1 truncate rounded px-1.5 py-1 text-[13px] leading-snug ${bg}`}
                          title={
                            isRoomBooking || session.is_cancelled
                              ? undefined
                              : `${confirmed}/${session.capacity} booked`
                          }
                        >
                          <span className="shrink-0 font-medium">
                            {formatTimeShort(session.start_time)}
                          </span>
                          <span className="truncate">{session.class_name}</span>
                          {!isRoomBooking && !session.is_cancelled && (
                            <span
                              className={`ml-auto shrink-0 rounded-sm px-1 text-[10px] font-semibold tabular-nums ${
                                isFull
                                  ? "bg-amber-200/70 text-amber-900"
                                  : isAlmostFull
                                    ? "bg-orange-200/70 text-orange-900"
                                    : "bg-white/60 text-gray-600"
                              }`}
                            >
                              {isFull
                                ? "FULL"
                                : `${confirmed}/${session.capacity}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {remaining > 0 && (
                      <div className="px-1 text-[11px] font-medium text-gray-500">
                        +{remaining} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
