"use client";

import { useRouter } from "next/navigation";
import { type DashboardSessionData } from "./dashboard-event-card";
import {
  formatTimeShort,
  parseLocalDate,
  getDayNameShort,
} from "@/components/member/calendar/calendar-utils";

type Props = {
  currentDate: Date;
  sessions: DashboardSessionData[];
  confirmedCounts: Record<string, number>;
};

export default function DashboardListView({
  currentDate,
  sessions,
  confirmedCounts,
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

  if (sorted.length === 0) {
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
            <div className="space-y-1">
              {daySessions.map((session) => {
                const confirmed = confirmedCounts[session.id] || 0;
                const isFull = confirmed >= session.capacity;
                const endMinutes =
                  parseInt(session.start_time.split(":")[0]) * 60 +
                  parseInt(session.start_time.split(":")[1]) +
                  session.duration_minutes;
                const endHour = Math.floor(endMinutes / 60);
                const endMin = endMinutes % 60;
                const endTimeStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${
                      session.is_cancelled
                        ? "border-gray-200 bg-gray-50 opacity-60"
                        : "border-gray-200 bg-white"
                    }`}
                    onClick={() =>
                      router.push(`/calendar/${session.class_id}/sessions/${session.id}`)
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
                        {session.is_cancelled && (
                          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            Cancelled
                          </span>
                        )}
                        {!session.is_public && !session.is_cancelled && (
                          <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                            Private
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {session.instructor_name}
                        {session.room_name && ` \u00b7 ${session.room_name}`}
                      </div>
                    </div>

                    {/* Capacity */}
                    <div className="shrink-0 text-right text-sm">
                      <span
                        className={
                          isFull ? "font-medium text-amber-600" : "text-gray-500"
                        }
                      >
                        {confirmed}/{session.capacity}
                      </span>
                    </div>
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
