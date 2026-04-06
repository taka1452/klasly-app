"use client";

import { useEffect, useState, useRef } from "react";
import CalendarEventCard from "./calendar-event-card";
import BookingButton from "@/components/bookings/booking-button";
import {
  type SessionData,
  getWeekDates,
  getTimeRange,
  isToday,
  isSameDay,
  getDayNameShort,
  formatDateLabel,
  formatYMD,
  formatTimeShort,
  parseTime,
  assignOverlapColumns,
  HOUR_HEIGHT,
} from "./calendar-utils";

type Props = {
  currentDate: Date;
  sessions: SessionData[];
  bookings: Record<string, { id: string; status: string }>;
  confirmedCounts: Record<string, number>;
  memberId: string | null;
  memberCredits: number;
  canBook: boolean;
  requiresCredits: boolean;
  payPerClass: boolean;
  classPrice?: number;
  passInfo?: { hasPass: boolean; hasCapacity: boolean; classesUsed: number; maxClasses: number | null };
  onBookingComplete: () => void;
  showFavorites?: boolean;
  favoriteClassIds?: Set<string>;
  favoriteInstructorIds?: Set<string>;
};

export default function CalendarWeekView({
  currentDate,
  sessions,
  bookings,
  confirmedCounts,
  memberId,
  memberCredits,
  canBook,
  requiresCredits,
  payPerClass,
  classPrice,
  passInfo,
  onBookingComplete,
  showFavorites = false,
  favoriteClassIds = new Set(),
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

  // Auto-scroll to current time or first session on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const currentHour = new Date().getHours();
    const scrollTarget = Math.max(0, (currentHour - startHour - 1) * HOUR_HEIGHT);
    containerRef.current.scrollTop = scrollTarget;
  }, [startHour]);

  // Group sessions by date string
  const sessionsByDate = new Map<string, SessionData[]>();
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

  // Current time line position
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showTimeLine = nowHour >= startHour && nowHour <= endHour;
  const timeLineTop = (nowHour - startHour) * HOUR_HEIGHT;

  // Check if today is in the week
  const todayInWeek = weekDates.findIndex((d) => isToday(d));

  // Build sorted sessions by day for mobile view
  const weekSessionsByDay: { date: Date; dateStr: string; sessions: SessionData[] }[] = [];
  for (const date of weekDates) {
    const dateStr = formatYMD(date);
    const daySessions = (sessionsByDate.get(dateStr) || []).sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );
    weekSessionsByDay.push({ date, dateStr, sessions: daySessions });
  }

  return (
    <>
    {/* ===== Mobile: Card list by day ===== */}
    <div className="space-y-4 md:hidden">
      {weekSessionsByDay.map(({ date, dateStr, sessions: daySessions }) => {
        const today = isToday(date);
        const dayLabel = date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        if (daySessions.length === 0) return null;

        return (
          <div key={dateStr}>
            <div className={`sticky top-0 z-10 px-1 py-1.5 text-sm font-semibold ${today ? "text-brand-700" : "text-gray-700"}`}>
              {dayLabel}
              {today && <span className="ml-2 text-xs font-normal text-brand-500">Today</span>}
            </div>
            <div className="space-y-2">
              {daySessions.map((session) => {
                const bk = bookings[session.id] || null;
                const count = confirmedCounts[session.id] || 0;
                const isFull = count >= session.capacity;

                let borderColor = "border-l-brand-500";
                if (bk?.status === "confirmed") borderColor = "border-l-green-500";
                else if (bk?.status === "waitlist") borderColor = "border-l-amber-500";

                return (
                  <div
                    key={session.id}
                    className={`rounded-lg border border-gray-200 border-l-[3px] ${borderColor} bg-white p-3`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-gray-900 truncate">
                          {session.class_name}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-600">
                          {formatTimeShort(session.start_time)} · {session.duration_minutes}min
                        </p>
                        <p className="text-sm text-gray-500">
                          {session.instructor_name}
                          {(session.room_name || session.location) && ` · ${session.room_name || session.location}`}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {count}/{session.capacity} booked
                          {isFull && <span className="ml-1 text-amber-600">(Full)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <BookingButton
                        sessionId={session.id}
                        capacity={session.capacity}
                        memberId={memberId}
                        existingBooking={bk}
                        memberCredits={memberCredits}
                        confirmedCount={count}
                        canBook={canBook}
                        requiresCredits={requiresCredits}
                        payPerClass={payPerClass}
                        classPrice={session.price_cents ?? classPrice}
                        passInfo={passInfo}
                        onSuccess={onBookingComplete}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state for mobile */}
      {weekSessionsByDay.every(({ sessions: s }) => s.length === 0) && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No classes this week.</p>
        </div>
      )}
    </div>

    {/* ===== Desktop: Time grid ===== */}
    <div
      ref={containerRef}
      className="hidden overflow-auto rounded-lg border border-gray-200 bg-white md:block"
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
                  today
                    ? "bg-brand-600 text-white"
                    : "text-gray-900"
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
              className={`relative border-r border-gray-200 ${
                today ? "bg-brand-50/20" : ""
              }`}
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
                  <CalendarEventCard
                    key={session.id}
                    session={session}
                    booking={bookings[session.id] || null}
                    confirmedCount={confirmedCounts[session.id] || 0}
                    gridStartHour={startHour}
                    colIndex={overlap.col}
                    totalCols={overlap.totalCols}
                    memberId={memberId}
                    memberCredits={memberCredits}
                    canBook={canBook}
                    requiresCredits={requiresCredits}
                    payPerClass={payPerClass}
                    classPrice={classPrice}
                    passInfo={passInfo}
                    onBookingComplete={onBookingComplete}
                    showFavorites={showFavorites}
                    isFavorited={!!session.class_id && favoriteClassIds.has(session.class_id)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
