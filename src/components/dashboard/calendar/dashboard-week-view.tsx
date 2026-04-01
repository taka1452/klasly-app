"use client";

import { useEffect, useState, useRef } from "react";
import DashboardEventCard, { type DashboardSessionData } from "./dashboard-event-card";
import {
  getWeekDates,
  getTimeRange,
  isToday,
  getDayNameShort,
  formatYMD,
  assignOverlapColumns,
  HOUR_HEIGHT,
} from "@/components/member/calendar/calendar-utils";

type Props = {
  currentDate: Date;
  sessions: DashboardSessionData[];
  confirmedCounts: Record<string, number>;
  onSlotClick?: (date: string, startTime: string) => void;
};

export default function DashboardWeekView({
  currentDate,
  sessions,
  confirmedCounts,
  onSlotClick,
}: Props) {
  const weekDates = getWeekDates(currentDate);
  const { startHour, endHour } = getTimeRange(sessions);
  const totalHours = endHour - startHour;
  const containerRef = useRef<HTMLDivElement>(null);

  // Current time indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to current time
  useEffect(() => {
    if (!containerRef.current) return;
    const currentHour = new Date().getHours();
    const scrollTarget = Math.max(0, (currentHour - startHour - 1) * HOUR_HEIGHT);
    containerRef.current.scrollTop = scrollTarget;
  }, [startHour]);

  // Group sessions by date
  const sessionsByDate = new Map<string, DashboardSessionData[]>();
  for (const s of sessions) {
    const key = s.session_date;
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  }

  // Compute overlaps per day
  const overlapsByDate = new Map<string, Map<string, { col: number; totalCols: number }>>();
  sessionsByDate.forEach((daySessions, date) => {
    overlapsByDate.set(date, assignOverlapColumns(daySessions));
  });

  // Current time line
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showTimeLine = nowHour >= startHour && nowHour <= endHour;
  const timeLineTop = (nowHour - startHour) * HOUR_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-lg border border-gray-200 bg-white"
      style={{ maxHeight: "calc(100vh - 220px)" }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 grid border-b border-gray-200 bg-white"
        style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
      >
        <div className="border-r border-gray-200" />
        {weekDates.map((date, i) => {
          const today = isToday(date);
          return (
            <div
              key={i}
              className={`border-r border-gray-200 px-1 py-2 text-center ${
                today ? "bg-brand-50" : ""
              }`}
            >
              <div className="text-xs font-medium text-gray-500">
                {getDayNameShort(date)}
              </div>
              <div
                className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  today ? "bg-brand-600 text-white" : "text-gray-900"
                }`}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: "60px repeat(7, 1fr)",
          height: `${totalHours * HOUR_HEIGHT}px`,
        }}
      >
        {/* Time gutter */}
        <div className="relative border-r border-gray-200">
          {Array.from({ length: totalHours }, (_, i) => {
            const hour = startHour + i;
            const label =
              hour === 0
                ? "12 AM"
                : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                    ? "12 PM"
                    : `${hour - 12} PM`;
            return (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-gray-400"
                style={{ top: `${i * HOUR_HEIGHT}px` }}
              >
                {i > 0 ? label : ""}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        {weekDates.map((date, dayIdx) => {
          const dateStr = formatYMD(date);
          const daySessions = sessionsByDate.get(dateStr) || [];
          const dayOverlaps = overlapsByDate.get(dateStr) || new Map();
          const today = isToday(date);

          return (
            <div
              key={dayIdx}
              className={`relative cursor-pointer border-r border-gray-200 ${
                today ? "bg-brand-50/20" : ""
              }`}
              onClick={(e) => {
                if (!onSlotClick) return;
                if ((e.target as HTMLElement).closest("[data-event-card]")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
                const hourFloat = y / HOUR_HEIGHT + startHour;
                const hour = Math.floor(hourFloat);
                const minutes = Math.round((hourFloat - hour) * 60 / 15) * 15;
                const timeStr = `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
                onSlotClick(dateStr, timeStr);
              }}
            >
              {/* Hour grid lines */}
              {Array.from({ length: totalHours }, (_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-t border-gray-100"
                  style={{ top: `${i * HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Half-hour lines */}
              {Array.from({ length: totalHours }, (_, i) => (
                <div
                  key={`half-${i}`}
                  className="absolute w-full border-t border-gray-50"
                  style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                />
              ))}

              {/* Current time indicator */}
              {today && showTimeLine && (
                <div
                  className="absolute left-0 right-0 z-30"
                  style={{ top: `${timeLineTop}px` }}
                >
                  <div className="relative">
                    <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-[2px] bg-red-500" />
                  </div>
                </div>
              )}

              {/* Session events */}
              {daySessions.map((session) => {
                const overlap = dayOverlaps.get(session.id) || {
                  col: 0,
                  totalCols: 1,
                };
                return (
                  <DashboardEventCard
                    key={session.id}
                    session={session}
                    confirmedCount={confirmedCounts[session.id] || 0}
                    gridStartHour={startHour}
                    colIndex={overlap.col}
                    totalCols={overlap.totalCols}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
