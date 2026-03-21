"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import { DAY_NAMES } from "@/lib/utils";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type SessionItem = {
  id: string;
  session_date: string;
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  capacity: number;
  is_cancelled: boolean;
  class_name: string;
  location?: string | null;
  room_name?: string | null;
  booked: number;
  price_cents?: number | null;
  is_public?: boolean;
  is_online?: boolean;
  online_link?: string | null;
  session_type?: "class" | "room_only";
  template_id?: string | null;
};

export default function ScheduleView({
  sessions,
}: {
  sessions: SessionItem[];
}) {
  const { isEnabled } = useFeature();
  const onlineEnabled = isEnabled(FEATURE_KEYS.ONLINE_CLASSES);

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

  const isRoomOnly = (s: SessionItem) => s.session_type === "room_only";

  function SessionCard({ s, compact }: { s: SessionItem; compact?: boolean }) {
    const roomOnly = isRoomOnly(s);
    const href = roomOnly
      ? "/instructor/room-bookings"
      : `/instructor/sessions/${s.id}`;

    const borderColor = s.is_cancelled
      ? "border-gray-200 bg-gray-50 text-gray-400"
      : roomOnly
        ? "border-teal-200 bg-teal-50/50"
        : "border-emerald-200 bg-emerald-50/50";

    return (
      <Link
        href={href}
        className={`block rounded border px-2 py-1.5 text-xs transition-colors hover:bg-emerald-50 ${borderColor}`}
      >
        <span className="font-medium">
          {roomOnly && (
            <span className="mr-1 inline-block rounded bg-teal-200 px-1 text-[9px] font-semibold uppercase text-teal-700">
              Room
            </span>
          )}
          {onlineEnabled && s.is_online && <span title="Online">📹 </span>}
          {s.class_name}
        </span>
        {s.is_public === false && !roomOnly && (
          <span className="ml-1 text-gray-400" title="Private">&#128274;</span>
        )}
        <br />
        {formatTime(s.start_time)}
        {s.end_time && ` – ${formatTime(s.end_time)}`}
        {!roomOnly && s.price_cents != null && (
          <span className="ml-1 text-emerald-700">
            ${(s.price_cents / 100).toFixed(0)}
          </span>
        )}
        {s.room_name && (
          <>
            <br />
            <span className="inline-block rounded bg-teal-100 px-1 text-[9px] font-medium text-teal-700">
              {s.room_name}
            </span>
          </>
        )}
        {!roomOnly && !compact && (
          <>
            <br />
            <span className="text-gray-500">
              {s.booked}/{s.capacity}
            </span>
          </>
        )}
        {s.is_cancelled && (
          <span className="mt-1 block text-red-600">Cancelled</span>
        )}
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
            aria-label="Previous week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
            aria-label="Next week"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="ml-1 text-sm font-semibold text-gray-900">
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" – "}
            {weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
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
                        <SessionCard key={s.id} s={s} compact />
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
              sessions.map((s) => {
                const roomOnly = isRoomOnly(s);
                const href = roomOnly
                  ? "/instructor/room-bookings"
                  : `/instructor/sessions/${s.id}`;

                return (
                  <Link
                    key={s.id}
                    href={href}
                    className={`block px-6 py-4 transition-colors hover:bg-gray-50 ${
                      s.is_cancelled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {roomOnly && (
                            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                              ROOM
                            </span>
                          )}
                          <p className="font-medium text-gray-900">
                            {onlineEnabled && s.is_online && <span title="Online">📹 </span>}
                            {s.class_name}
                          </p>
                          {onlineEnabled && s.is_online && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                              Online
                            </span>
                          )}
                          {s.is_public === false && !roomOnly && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                              Private
                            </span>
                          )}
                          {!roomOnly && s.price_cents != null && (
                            <span className="text-sm font-medium text-emerald-700">
                              ${(s.price_cents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(s.session_date)} · {formatTime(s.start_time)}
                          {s.end_time && ` – ${formatTime(s.end_time)}`}
                          {s.room_name && (
                            <span className="ml-1 inline-block rounded bg-teal-100 px-1 text-[10px] font-medium text-teal-700">
                              {s.room_name}
                            </span>
                          )}
                          {!s.room_name && s.location && ` · ${s.location}`}
                        </p>
                        {onlineEnabled && s.is_online && s.online_link && (
                          <a
                            href={s.online_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open link →
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!roomOnly && (
                          <span className="text-sm text-gray-600">
                            {s.booked}/{s.capacity}
                          </span>
                        )}
                        {s.is_cancelled && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            Cancelled
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
