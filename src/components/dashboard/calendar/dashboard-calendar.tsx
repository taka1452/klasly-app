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

const CALENDAR_VIEW_KEY = "klasly:calendar-view";

export default function DashboardCalendar({ onSlotClick }: DashboardCalendarProps = {}) {
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(CALENDAR_VIEW_KEY);
      if (saved === "week" || saved === "day" || saved === "month" || saved === "list") return saved;
      // Default to day on mobile, month on desktop
      if (window.innerWidth < 768) return "day";
    }
    return "month";
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<DashboardSessionData[]>([]);
  const [confirmedCounts, setConfirmedCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");

  // Detect mobile on mount
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (mobile && !localStorage.getItem(CALENDAR_VIEW_KEY)) {
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
    localStorage.setItem(CALENDAR_VIEW_KEY, v);
  }

  function handleMonthDayClick(date: Date) {
    setCurrentDate(date);
    setView("day");
  }

  // Build the unique room list from sessions currently in view (id + name).
  // Includes a synthetic "no-room" bucket for sessions with no room assigned,
  // so users can isolate those too.
  const roomOptions = (() => {
    const map = new Map<string, string>();
    let hasUnassigned = false;
    for (const s of sessions) {
      if (s.room_id && s.room_name) {
        map.set(s.room_id, s.room_name);
      } else {
        hasUnassigned = true;
      }
    }
    const opts = Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (hasUnassigned) opts.push({ id: "__none__", name: "No room" });
    return opts;
  })();

  // If the previously selected room disappears (user navigates to a week
  // where it has no sessions), reset to "all" so nothing looks empty.
  useEffect(() => {
    if (
      selectedRoomId !== "all" &&
      !roomOptions.some((r) => r.id === selectedRoomId)
    ) {
      setSelectedRoomId("all");
    }
  }, [roomOptions, selectedRoomId]);

  const filteredSessions = sessions
    .filter((s) => (showCancelled ? true : !s.is_cancelled))
    .filter((s) => {
      if (selectedRoomId === "all") return true;
      if (selectedRoomId === "__none__") return !s.room_id;
      return s.room_id === selectedRoomId;
    });

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
        <div className="flex flex-wrap items-center gap-3">
          {roomOptions.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Room
              </span>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                aria-label="Filter by room"
              >
                <option value="all">All rooms</option>
                {roomOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div
            className="flex cursor-pointer items-center gap-2 text-sm text-gray-600"
            onClick={() => setShowCancelled((v) => !v)}
          >
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
