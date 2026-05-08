"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { type DashboardSessionData } from "./dashboard-event-card";
import {
  type CalendarEvent,
  formatTimeShort,
  parseLocalDate,
  getDayNameShort,
} from "@/components/member/calendar/calendar-utils";

type Props = {
  currentDate: Date;
  sessions: DashboardSessionData[];
  confirmedCounts: Record<string, number>;
  events?: (CalendarEvent & { status: string })[];
};

export default function DashboardListView({
  currentDate,
  sessions,
  confirmedCounts,
  events = [],
}: Props) {
  const router = useRouter();

  // Sort sessions by date then start_time
  const sorted = [...sessions].sort((a, b) => {
    const dateComp = a.session_date.localeCompare(b.session_date);
    if (dateComp !== 0) return dateComp;
    return a.start_time.localeCompare(b.start_time);
  });

  // Group by date
  const grouped = new Map<string, DashboardSessionData[]>();
  for (const s of sorted) {
    if (!grouped.has(s.session_date)) grouped.set(s.session_date, []);
    grouped.get(s.session_date)!.push(s);
  }

  if (sorted.length === 0 && events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([dateStr, daySessions]) => {
        const date = parseLocalDate(dateStr);
        const dayLabel = date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

        return (
          <div key={dateStr}>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              {dayLabel}
            </h3>
            {events
              .filter((e) => e.start_date <= dateStr && e.end_date >= dateStr)
              .map((ev) => (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}/manage`}
                  className="mb-1 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-700 hover:bg-purple-100 transition"
                >
                  <span className="truncate">{ev.name}</span>
                  {ev.status !== "published" && (
                    <span className="ml-auto shrink-0 rounded bg-purple-200 px-1.5 py-0.5 text-[10px]">
                      {ev.status}
                    </span>
                  )}
                </Link>
              ))}
            <div className="space-y-1">
              {daySessions.map((session) => {
                const confirmed = confirmedCounts[session.id] || 0;
                const isRoomBooking = session.event_type === "room_booking";
                const isFull = !isRoomBooking && confirmed >= session.capacity;
                const remainingSpots = session.capacity - confirmed;
                const isAlmostFull =
                  !isRoomBooking &&
                  !session.is_cancelled &&
                  !isFull &&
                  confirmed > 0 &&
                  remainingSpots <= 2;
                const endMinutes =
                  parseInt(session.start_time.split(":")[0]) * 60 +
                  parseInt(session.start_time.split(":")[1]) +
                  session.duration_minutes;
                const endHour = Math.floor(endMinutes / 60);
                const endMin = endMinutes % 60;
                const endTimeStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

                const borderAccent = isRoomBooking
                  ? "border-l-4 border-l-teal-500"
                  : session.is_cancelled
                    ? "border-l-4 border-l-gray-300"
                    : !session.is_public
                      ? "border-l-4 border-l-violet-500"
                      : isFull
                        ? "border-l-4 border-l-amber-500"
                        : "border-l-4 border-l-brand-500";

                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${borderAccent} ${
                      session.is_cancelled
                        ? "border-gray-200 bg-gray-50 opacity-60"
                        : "border-gray-200 bg-white"
                    }`}
                    onClick={() =>
                      router.push(
                        isRoomBooking
                          ? `/rooms/bookings/${session.id}`
                          : `/calendar/${session.class_id}/sessions/${session.id}`
                      )
                    }
                  >
                    {/* Time */}
                    <div className="w-28 shrink-0 text-sm text-gray-500">
                      {formatTimeShort(session.start_time)} –{" "}
                      {formatTimeShort(endTimeStr)}
                    </div>

                    {/* Class info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-900">
                          {session.class_name}
                        </span>
                        {isRoomBooking && (
                          <span className="shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                            Room
                          </span>
                        )}
                        {session.is_cancelled && (
                          <span
                            className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                            title={session.cancellation_reason ?? undefined}
                          >
                            Cancelled
                          </span>
                        )}
                        {!session.is_public && !session.is_cancelled && !isRoomBooking && (
                          <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                            Private
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {session.instructor_name}
                        {session.room_name && ` \u00b7 ${session.room_name}`}
                      </div>
                      {session.is_cancelled && session.cancellation_reason && (
                        <div className="mt-0.5 text-xs italic text-gray-500">
                          Reason: {session.cancellation_reason}
                        </div>
                      )}
                    </div>

                    {/* Capacity */}
                    {!isRoomBooking && (
                      <div className="shrink-0 text-right text-sm">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                            isFull
                              ? "bg-amber-100 text-amber-800"
                              : isAlmostFull
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {isFull
                            ? "FULL"
                            : isAlmostFull
                              ? `${remainingSpots} left`
                              : `${confirmed}/${session.capacity}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
