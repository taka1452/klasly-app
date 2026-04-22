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
  const CALENDAR_VIEW_KEY = "klasly:member:calendar-view";
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(CALENDAR_VIEW_KEY);
      if (saved === "week" || saved === "day" || saved === "month" || saved === "list") return saved;
      if (window.innerWidth < 768) return "day";
    }
    return "month";
  });
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
  const [showTip, setShowTip] = useState(false);

  // Detect mobile on mount + show tip once
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (mobile && !localStorage.getItem(CALENDAR_VIEW_KEY)) {
      setView("day");
    }
    if (!localStorage.getItem("klasly:member:schedule-tip-dismissed")) {
      setShowTip(true);
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
    localStorage.setItem(CALENDAR_VIEW_KEY, v);
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
      {showTip && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="flex-1">
            Switch to <strong>List view</strong> for a simple date-by-date list of all upcoming classes.
          </p>
          <button
            type="button"
            onClick={() => { setShowTip(false); localStorage.setItem("klasly:member:schedule-tip-dismissed", "1"); }}
            className="shrink-0 tap-target rounded text-brand-400 hover:bg-brand-100 hover:text-brand-700"
            aria-label="Dismiss tip"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
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
