"use client";

import { useCallback, useEffect, useState } from "react";
import CalendarHeader from "./calendar-header";
import CalendarWeekView from "./calendar-week-view";
import CalendarDayView from "./calendar-day-view";
import CalendarMonthView from "./calendar-month-view";
import CalendarListView from "./calendar-list-view";
import {
  type SessionData,
  type CalendarView,
  getDateRange,
  addDays,
  addWeeks,
  addMonths,
} from "./calendar-utils";

type Props = {
  memberId: string | null;
  memberCredits: number;
  canBook: boolean;
  requiresCredits: boolean;
  payPerClass: boolean;
  classPrice?: number;
};

export default function ScheduleCalendar({
  memberId,
  memberCredits: initialCredits,
  canBook,
  requiresCredits,
  payPerClass,
  classPrice,
}: Props) {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [bookings, setBookings] = useState<
    Record<string, { id: string; status: string }>
  >({});
  const [confirmedCounts, setConfirmedCounts] = useState<
    Record<string, number>
  >({});
  const [passInfo, setPassInfo] = useState<{
    hasPass: boolean;
    hasCapacity: boolean;
    classesUsed: number;
    maxClasses: number | null;
  }>({ hasPass: false, hasCapacity: false, classesUsed: 0, maxClasses: null });
  const [credits, setCredits] = useState(initialCredits);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (mobile) {
      setView("day");
    }
  }, []);

  // Fetch sessions
  const fetchSessions = useCallback(
    async (v: CalendarView, d: Date) => {
      setLoading(true);
      setFetchError(false);
      try {
        const { start, end } = getDateRange(v, d);
        const res = await fetch(
          `/api/member/sessions?start=${start}&end=${end}`,
        );
        if (!res.ok) {
          setFetchError(true);
          return;
        }
        const data = await res.json();
        setSessions(data.sessions ?? []);
        setBookings(data.bookings ?? {});
        setConfirmedCounts(data.confirmedCounts ?? {});
        if (data.passInfo) setPassInfo(data.passInfo);
        if (typeof data.memberCredits === "number") setCredits(data.memberCredits);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Fetch on view/date change
  useEffect(() => {
    fetchSessions(view, currentDate);
  }, [view, currentDate, fetchSessions]);

  // Navigation
  function handlePrev() {
    setCurrentDate((d: Date) => {
      if (view === "day") return addDays(d, -1);
      if (view === "week" || view === "list") return addWeeks(d, -1);
      return addMonths(d, -1);
    });
  }

  function handleNext() {
    setCurrentDate((d: Date) => {
      if (view === "day") return addDays(d, 1);
      if (view === "week" || view === "list") return addWeeks(d, 1);
      return addMonths(d, 1);
    });
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handleViewChange(v: CalendarView) {
    setView(v);
  }

  function handleMonthDayClick(date: Date) {
    setCurrentDate(date);
    setView("day");
  }

  function handleBookingComplete() {
    fetchSessions(view, currentDate);
  }

  const sharedProps = {
    currentDate,
    sessions,
    bookings,
    confirmedCounts,
    memberId,
    memberCredits: credits,
    canBook,
    requiresCredits,
    payPerClass,
    classPrice,
    passInfo,
    onBookingComplete: handleBookingComplete,
  };

  return (
    <div>
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        isMobile={isMobile}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
      />

      {fetchError && !loading ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600">
            Failed to load schedule. Please try again.
          </p>
          <button
            type="button"
            onClick={() => fetchSessions(view, currentDate)}
            className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Retry
          </button>
        </div>
      ) : loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-20">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">Loading schedule...</p>
          </div>
        </div>
      ) : (
        <>
          {view === "week" && <CalendarWeekView {...sharedProps} />}
          {view === "day" && <CalendarDayView {...sharedProps} />}
          {view === "month" && (
            <CalendarMonthView
              currentDate={currentDate}
              sessions={sessions}
              bookings={bookings}
              onDayClick={handleMonthDayClick}
              isMobile={isMobile}
            />
          )}
          {view === "list" && <CalendarListView {...sharedProps} />}

          {/* Empty state */}
          {!loading && sessions.length === 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">
                No classes scheduled for this period.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
