"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import { DAY_NAMES } from "@/lib/utils";

type SessionItem = {
  id: string;
  session_date: string;
  start_time: string;
  capacity: number;
  is_cancelled: boolean;
  class_id: string;
  class_name: string;
  location?: string | null;
  booked: number;
};

export default function ScheduleView({
  sessions,
}: {
  sessions: SessionItem[];
}) {
  const [viewMode, setViewMode] = useState<"week" | "list">("week");
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekStart, weekStartStr, weekEndStr } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      weekStart: start,
      weekStartStr: start.toISOString().split("T")[0],
      weekEndStr: end.toISOString().split("T")[0],
    };
  }, [weekOffset]);

  const weekSessions = useMemo(() => {
    return sessions.filter(
      (s) => s.session_date >= weekStartStr && s.session_date <= weekEndStr
    );
  }, [sessions, weekStartStr, weekEndStr]);

  const sessionsByDay = useMemo(() => {
    const byDay: Record<string, SessionItem[]> = {};
    for (let i = 1; i <= 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + (i - 1));
      const dateStr = d.toISOString().split("T")[0];
      byDay[dateStr] = weekSessions
        .filter((s) => s.session_date === dateStr)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return byDay;
  }, [weekSessions, weekStart]);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="btn-secondary text-sm"
          >
            ← Previous Week
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="btn-secondary text-sm"
          >
            Next Week →
          </button>
        </div>
        <button
          type="button"
          onClick={() => setViewMode((m) => (m === "week" ? "list" : "week"))}
          className="btn-secondary text-sm"
        >
          {viewMode === "week" ? "List View" : "Week View"}
        </button>
      </div>

      {viewMode === "week" ? (
        <div className="card overflow-x-auto p-0">
          <div className="flex min-w-[600px]">
            {weekDates.map((d) => {
              const dateStr = d.toISOString().split("T")[0];
              const daySessions = sessionsByDay[dateStr] || [];
              const dayName = DAY_NAMES[d.getDay()] ?? "—";

              return (
                <div
                  key={dateStr}
                  className="min-w-[120px] flex-1 border-r border-gray-200 last:border-r-0"
                >
                  <div className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-600">
                    {dayName.slice(0, 3)}
                    <br />
                    {d.getDate()}/{d.getMonth() + 1}
                  </div>
                  <div className="space-y-1 p-2">
                    {daySessions.length === 0 ? (
                      <p className="py-2 text-center text-xs text-gray-400">—</p>
                    ) : (
                      daySessions.map((s) => (
                        <Link
                          key={s.id}
                          href={`/instructor/sessions/${s.id}`}
                          className={`block rounded border px-2 py-1.5 text-xs transition-colors hover:bg-emerald-50 ${
                            s.is_cancelled
                              ? "border-gray-200 bg-gray-50 text-gray-400"
                              : "border-emerald-200 bg-emerald-50/50"
                          }`}
                        >
                          <span className="font-medium">{s.class_name}</span>
                          <br />
                          {formatTime(s.start_time)}
                          <br />
                          <span className="text-gray-500">
                            {s.booked}/{s.capacity}
                          </span>
                          {s.is_cancelled && (
                            <span className="mt-1 block text-red-600">Cancelled</span>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-gray-200">
            {sessions.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No sessions found.
              </div>
            ) : (
              sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/instructor/sessions/${s.id}`}
                  className={`block px-6 py-4 transition-colors hover:bg-gray-50 ${
                    s.is_cancelled ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{s.class_name}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(s.session_date)} · {formatTime(s.start_time)}
                        {s.location && ` · ${s.location}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {s.booked}/{s.capacity}
                      </span>
                      {s.is_cancelled && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
