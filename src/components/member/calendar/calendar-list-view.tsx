"use client";

import { useState } from "react";
import {
  type SessionData,
  formatTimeShort,
  parseLocalDate,
} from "./calendar-utils";
import CalendarEventCard from "./calendar-event-card";
import InstructorProfileModal from "@/components/member/instructor-profile-modal";

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
  passInfo: {
    hasPass: boolean;
    hasCapacity: boolean;
    classesUsed: number;
    maxClasses: number | null;
  };
  onBookingComplete: () => void;
};

export default function CalendarListView({
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
}: Props) {
  const [instructorModalId, setInstructorModalId] = useState<string | null>(null);

  // Sort sessions by date then start_time
  const sorted = [...sessions].sort((a, b) => {
    const dateComp = a.session_date.localeCompare(b.session_date);
    if (dateComp !== 0) return dateComp;
    return a.start_time.localeCompare(b.start_time);
  });

  // Group by date
  const grouped = new Map<string, SessionData[]>();
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
            <div className="space-y-2">
              {daySessions.map((session) => {
                const booking = bookings[session.id];
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
                    className={`rounded-lg border bg-white px-4 py-3 ${
                      session.is_cancelled
                        ? "border-gray-200 opacity-60"
                        : booking?.status === "confirmed"
                          ? "border-green-200 bg-green-50/50"
                          : booking?.status === "waitlist"
                            ? "border-amber-200 bg-amber-50/50"
                            : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {session.class_name}
                          </span>
                          {session.is_cancelled && (
                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              Cancelled
                            </span>
                          )}
                          {booking?.status === "confirmed" && (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                              Booked
                            </span>
                          )}
                          {booking?.status === "waitlist" && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Waitlisted
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {formatTimeShort(session.start_time)} –{" "}
                          {formatTimeShort(endTimeStr)}
                          {session.instructor_name && (
                            <>
                              {" \u00b7 "}
                              {session.instructor_id ? (
                                <button
                                  type="button"
                                  onClick={() => setInstructorModalId(session.instructor_id)}
                                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                                >
                                  {session.instructor_name}
                                </button>
                              ) : (
                                session.instructor_name
                              )}
                            </>
                          )}
                          {session.room_name && ` \u00b7 ${session.room_name}`}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {confirmed}/{session.capacity} spots filled
                          {isFull && !booking && " \u00b7 Full"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {instructorModalId && (
        <InstructorProfileModal
          instructorId={instructorModalId}
          onClose={() => setInstructorModalId(null)}
        />
      )}
    </div>
  );
}
