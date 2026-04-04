"use client";

import { useEffect, useState, useRef } from "react";
import DashboardEventCard, { type DashboardSessionData } from "./dashboard-event-card";
import {
  getTimeRange,
  isToday,
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

export default function DashboardDayView({
  currentDate,
  sessions,
  confirmedCounts,
  onSlotClick,
}: Props) {
  const { startHour, endHour } = getTimeRange(sessions);
  const totalHours = endHour - startHour;
  const containerRef = useRef<HTMLDivElement>(null);

  // Hover snap indicator
  const [hoverSlot, setHoverSlot] = useState<{ y: number; label: string } | null>(null);

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
  const daySessions = sessions.filter(
    (s) => s.session_date === dateStr,
  ) as DashboardSessionData[];
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
        <div
          className={`relative ${onSlotClick ? "cursor-pointer" : ""} ${today ? "bg-brand-50/20" : ""}`}
          onMouseMove={(e) => {
            if (!onSlotClick) return;
            if ((e.target as HTMLElement).closest("[data-event-card]")) { setHoverSlot(null); return; }
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hourFloat = y / HOUR_HEIGHT + startHour;
            const hour = Math.floor(hourFloat);
            const rawMin = Math.round((hourFloat - hour) * 60 / 15) * 15;
            const snappedHour = hour + (rawMin >= 60 ? 1 : 0);
            const snappedMin = rawMin % 60;
            const snappedY = (snappedHour + snappedMin / 60 - startHour) * HOUR_HEIGHT;
            const h12 = snappedHour === 0 ? 12 : snappedHour > 12 ? snappedHour - 12 : snappedHour;
            const ampm = snappedHour < 12 ? "AM" : "PM";
            const label = `${h12}:${String(snappedMin).padStart(2, "0")} ${ampm}`;
            setHoverSlot({ y: snappedY, label });
          }}
          onMouseLeave={() => setHoverSlot(null)}
          onClick={(e) => {
            if (!onSlotClick) return;
            // Only trigger if clicking on empty space (not an event card)
            if ((e.target as HTMLElement).closest("[data-event-card]")) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hourFloat = y / HOUR_HEIGHT + startHour;
            const hour = Math.floor(hourFloat);
            const minutes = Math.round((hourFloat - hour) * 60 / 15) * 15; // snap to 15 min
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

          {/* Hover snap indicator */}
          {hoverSlot && onSlotClick && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 flex items-center gap-1.5 border-t-2 border-brand-400"
              style={{ top: `${hoverSlot.y}px` }}
            >
              <span className="ml-2 rounded bg-brand-500 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm">
                ＋ {hoverSlot.label}
              </span>
            </div>
          )}

          {/* Session events */}
          {daySessions.map((session) => {
            const overlap = overlaps.get(session.id) || {
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
      </div>
    </div>
  );
}
