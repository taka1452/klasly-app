"use client";

import { useCallback, useEffect, useState } from "react";
import CalendarHeader from "@/components/member/calendar/calendar-header";
import DashboardWeekView from "./dashboard-week-view";
import DashboardDayView from "./dashboard-day-view";
import DashboardMonthView from "./dashboard-month-view";
import DashboardListView from "./dashboard-list-view";
import { type DashboardSessionData } from "./dashboard-event-card";
import {
  type CalendarView,
  getDateRange,
  addDays,
  addWeeks,
  addMonths,
} from "@/components/member/calendar/calendar-utils";

type DashboardCalendarProps = {
  onSlotClick?: (date: string, startTime: string) => void;
};

export default function DashboardCalendar({ onSlotClick }: DashboardCalendarProps = {}) {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<DashboardSessionData[]>([]);
  const [confirmedCounts, setConfirmedCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

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
          `/api/dashboard/sessions?start=${start}&end=${end}`,
        );
        if (!res.ok) {
          setFetchError(true);
          return;
        }
        const data = await res.json();
        setSessions(data.sessions ?? []);
        setConfirmedCounts(data.confirmedCounts ?? {});
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

  const filteredSessions = showCancelled
    ? sessions
    : sessions.filter((s) => !s.is_cancelled);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1">
          <CalendarHeader
            currentDate={currentDate}
            view={view}
            isMobile={isMobile}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            onViewChange={handleViewChange}
          />
        </div>
        <div className="flex cursor-pointer items-center gap-2 text-sm text-gray-600" onClick={() => setShowCancelled((v) => !v)}>
          <button
            type="button"
            role="switch"
            aria-checked={showCancelled}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              showCancelled ? "bg-gray-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                showCancelled ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
          <span>Show cancelled</span>
        </div>
      </div>

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
          {view === "week" && (
            <DashboardWeekView
              currentDate={currentDate}
              sessions={filteredSessions}
              confirmedCounts={confirmedCounts}
              onSlotClick={onSlotClick}
            />
          )}
          {view === "day" && (
            <DashboardDayView
              currentDate={currentDate}
              sessions={filteredSessions}
              confirmedCounts={confirmedCounts}
              onSlotClick={onSlotClick}
            />
          )}
          {view === "month" && (
            <DashboardMonthView
              currentDate={currentDate}
              sessions={filteredSessions}
              confirmedCounts={confirmedCounts}
              onDayClick={handleMonthDayClick}
              isMobile={isMobile}
            />
          )}
          {view === "list" && (
            <DashboardListView
              currentDate={currentDate}
              sessions={filteredSessions}
              confirmedCounts={confirmedCounts}
            />
          )}

          {/* Empty state */}
          {!loading && filteredSessions.length === 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">
                No sessions scheduled for this period.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
