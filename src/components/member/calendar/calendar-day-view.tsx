"use client";

import { useEffect, useState, useRef } from "react";
import CalendarEventCard from "./calendar-event-card";
import {
  type SessionData,
  getTimeRange,
  isToday,
  formatYMD,
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

export default function CalendarDayView({
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
  const { startHour, endHour } = getTimeRange(sessions);
  const totalHours = endHour - startHour;
  const containerRef = useRef<HTMLDivElement>(null);

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!containerRef.current) return;
    const currentHour = new Date().getHours();
    const scrollTarget = Math.max(0, (currentHour - startHour - 1) * HOUR_HEIGHT);
    containerRef.current.scrollTop = scrollTarget;
  }, [startHour]);

  // Filter sessions for this day
  const dateStr = formatYMD(currentDate);
  const daySessions = sessions.filter((s) => s.session_date === dateStr);
  const overlaps = assignOverlapColumns(daySessions);

  const today = isToday(currentDate);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showTimeLine = today && nowHour >= startHour && nowHour <= endHour;
  const timeLineTop = (nowHour - startHour) * HOUR_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-lg border border-gray-200 bg-white"
      style={{ maxHeight: "calc(100vh - 220px)" }}
    >
      {/* Time grid */}
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: "60px 1fr",
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

        {/* Day column */}
        <div className={`relative ${today ? "bg-brand-50/20" : ""}`}>
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
          {showTimeLine && (
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
            const overlap = overlaps.get(session.id) || {
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
      </div>
    </div>
  );
}
