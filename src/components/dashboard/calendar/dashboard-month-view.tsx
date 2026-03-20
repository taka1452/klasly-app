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

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
                  {/* Mobile: dot indicators */}
                  {isMobile && daySessions.length > 0 && (
                    <span className="flex gap-0.5">
                      {daySessions.slice(0, 3).map((s, i) => {
                        let dotColor = "bg-brand-400";
                        if (s.is_cancelled) dotColor = "bg-gray-400";
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
                      let bg = "bg-brand-100 text-brand-800";
                      if (session.is_cancelled) {
                        bg = "bg-gray-100 text-gray-500";
                      } else if (!session.is_public) {
                        bg = "bg-violet-100 text-violet-800";
                      } else if (confirmedCounts[session.id] >= session.capacity) {
                        bg = "bg-amber-100 text-amber-800";
                      }
                      return (
                        <div
                          key={session.id}
                          className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${bg}`}
                        >
                          <span className="font-medium">
                            {formatTimeShort(session.start_time)}
                          </span>{" "}
                          {session.class_name}
                        </div>
                      );
                    })}
                    {remaining > 0 && (
                      <div className="px-1 text-[10px] font-medium text-gray-500">
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
