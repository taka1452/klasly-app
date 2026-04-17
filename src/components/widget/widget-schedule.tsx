"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWidgetAuth } from "./widget-auth-provider";
import { useWidgetTheme } from "./widget-theme-provider";
import WidgetSessionCard from "./widget-session-card";
import WidgetLoginModal from "./widget-login-modal";

type SessionData = {
  id: string;
  date: string;
  startTime: string;
  className: string;
  description: string;
  instructorName: string;
  durationMinutes: number;
  capacity: number;
  confirmedCount: number;
  location: string | null;
};

type ScheduleResponse = {
  studio: { name: string };
  weekStart: string;
  weekEnd: string;
  sessions: SessionData[];
};

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

type Props = {
  studioId: string;
};

type ViewMode = "week" | "day";

export default function WidgetSchedule({ studioId }: Props) {
  const theme = useWidgetTheme();
  const { user, member, bookings, refreshMemberData, supabase, signOut } =
    useWidgetAuth();
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // index into weekDates
  const bodyRef = useRef<HTMLDivElement>(null);

  // Fetch schedule data
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/widget/${studioId}/schedule?week=${weekOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        setScheduleData(data);
        // Set selected day to today if in current week
        if (weekOffset === 0 && data.weekStart) {
          const today = new Date().toISOString().split("T")[0];
          const [y, m, d] = data.weekStart.split("-").map(Number);
          const start = new Date(y, m - 1, d);
          for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            if (dateStr === today) {
              setSelectedDayIndex(i);
              break;
            }
          }
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingSchedule(false);
    }
  }, [studioId, weekOffset]);

  useEffect(() => {
    setLoadingSchedule(true);
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 30000);
    return () => clearInterval(interval);
  }, [fetchSchedule]);

  // Auto-resize
  useEffect(() => {
    if (!bodyRef.current) return;
    const observer = new ResizeObserver(() => {
      const height = document.body.scrollHeight;
      window.parent.postMessage({ type: "KLASLY_RESIZE", height }, "*");
    });
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, []);

  async function handleSignOut() {
    await signOut();
  }

  async function handleBookingAction(
    sessionId: string,
    action: "book" | "cancel" | "leave_waitlist" | "rebook"
  ) {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    if (!member) {
      setError("You are not a member of this studio.");
      return;
    }
    setBookingLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/widget/${studioId}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action, sessionId, memberId: member.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        await Promise.all([refreshMemberData(), fetchSchedule()]);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setBookingLoading(false);
    }
  }

  function getBookingForSession(sessionId: string) {
    return bookings.find((b) => b.sessionId === sessionId) || null;
  }

  function getSessionsByDay(): Record<string, SessionData[]> {
    if (!scheduleData) return {};
    const grouped: Record<string, SessionData[]> = {};
    for (const s of scheduleData.sessions) {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    }
    return grouped;
  }

  function getWeekDates(): string[] {
    if (!scheduleData?.weekStart) return [];
    const [y, m, d] = scheduleData.weekStart.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  }

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr === today;
  };

  if (loadingSchedule && !scheduleData) {
    return (
      <div ref={bodyRef} className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const weekDates = getWeekDates();
  const sessionsByDay = getSessionsByDay();

  function renderSessionCard(s: SessionData) {
    return (
      <WidgetSessionCard
        key={s.id}
        session={s}
        booking={getBookingForSession(s.id)}
        onBook={(id) => handleBookingAction(id, "book")}
        onCancel={(id) => handleBookingAction(id, "cancel")}
        onLeaveWaitlist={(id) => handleBookingAction(id, "leave_waitlist")}
        onRebook={(id) => handleBookingAction(id, "rebook")}
        isLoggedIn={!!user}
        memberCredits={member?.credits ?? 0}
        loading={bookingLoading}
      />
    );
  }

  return (
    <div ref={bodyRef} className="p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: theme.primary }}>
          {scheduleData?.studio.name || "Schedule"}
        </h2>
        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`rounded-l-lg px-2.5 py-1 transition ${viewMode === "day" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={viewMode === "day" ? { backgroundColor: theme.primary } : undefined}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`rounded-r-lg px-2.5 py-1 transition ${viewMode === "week" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={viewMode === "week" ? { backgroundColor: theme.primary } : undefined}
          >
            Week
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setWeekOffset((w) => w - 1); setSelectedDayIndex(0); }}
          className="tap-target rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label="Previous week"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {scheduleData?.weekStart
              ? `${formatDateShort(scheduleData.weekStart)} - ${formatDateShort(scheduleData.weekEnd)}`
              : ""}
          </span>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => { setWeekOffset(0); setSelectedDayIndex(0); }}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: theme.primary }}
            >
              Today
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setWeekOffset((w) => w + 1); setSelectedDayIndex(0); }}
          className="tap-target rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label="Next week"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
          <button type="button" onClick={() => setError("")} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ======= DAY VIEW ======= */}
      {viewMode === "day" && (
        <div>
          {/* Day selector strip */}
          <div className="mb-3 flex gap-1">
            {weekDates.map((date, i) => {
              const dayIdx = getDayOfWeek(date);
              const today = isToday(date);
              const selected = i === selectedDayIndex;
              const hasSessions = (sessionsByDay[date] || []).length > 0;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDayIndex(i)}
                  className={`flex-1 rounded-lg py-2 text-center transition ${
                    selected
                      ? "text-white shadow-sm"
                      : today
                        ? "bg-gray-50 font-semibold text-gray-900"
                        : "text-gray-500 hover:bg-gray-50"
                  }`}
                  style={selected ? { backgroundColor: theme.primary } : undefined}
                >
                  <div className="text-[10px] font-medium">{DAY_NAMES_SHORT[dayIdx]}</div>
                  <div className="text-sm font-semibold">{formatDateShort(date).split("/")[1]}</div>
                  {hasSessions && !selected && (
                    <div className="mx-auto mt-0.5 h-1 w-1 rounded-full" style={{ backgroundColor: theme.primary }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Day sessions */}
          {weekDates[selectedDayIndex] && (
            <div className="space-y-2">
              {(sessionsByDay[weekDates[selectedDayIndex]] || []).length > 0 ? (
                (sessionsByDay[weekDates[selectedDayIndex]] || []).map(renderSessionCard)
              ) : (
                <p className="py-8 text-center text-sm text-gray-300">
                  No classes scheduled
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======= WEEK VIEW ======= */}
      {viewMode === "week" && (
        <>
          {/* Desktop: 7-column grid */}
          <div className="hidden md:grid md:grid-cols-7 md:gap-1">
            {weekDates.map((date) => {
              const dayIdx = getDayOfWeek(date);
              const sessions = sessionsByDay[date] || [];
              const today = isToday(date);

              return (
                <div key={date} className="min-w-0">
                  <div
                    className={`mb-1.5 rounded-lg py-1.5 text-center text-[10px] font-semibold ${
                      today ? "text-white" : "bg-gray-50 text-gray-500"
                    }`}
                    style={today ? { backgroundColor: theme.primary } : undefined}
                  >
                    <div>{DAY_NAMES_SHORT[dayIdx]}</div>
                    <div className="font-normal opacity-80">{formatDateShort(date)}</div>
                  </div>
                  <div className="space-y-1.5">
                    {sessions.length > 0 ? (
                      sessions.map(renderSessionCard)
                    ) : (
                      <p className="py-4 text-center text-[10px] text-gray-200">—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: List by day */}
          <div className="space-y-3 md:hidden">
            {weekDates.map((date) => {
              const dayIdx = getDayOfWeek(date);
              const sessions = sessionsByDay[date] || [];
              const today = isToday(date);

              if (sessions.length === 0) return null;

              return (
                <div key={date}>
                  <div
                    className={`mb-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      today ? "text-white" : "bg-gray-50 text-gray-600"
                    }`}
                    style={today ? { backgroundColor: theme.primary } : undefined}
                  >
                    {DAY_NAMES_FULL[dayIdx]} · {formatDateShort(date)}
                  </div>
                  <div className="space-y-1.5">
                    {sessions.map(renderSessionCard)}
                  </div>
                </div>
              );
            })}

            {scheduleData?.sessions.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-300">
                No classes scheduled this week.
              </p>
            )}
          </div>
        </>
      )}

      {/* Footer: Auth + branding */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">{user.email}</span>
              {member && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {member.credits === -1 ? "Unlimited" : `${member.credits} credits`}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[10px] text-gray-500 hover:text-gray-600"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="rounded-lg px-4 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: theme.primary }}
            >
              Sign in to book classes
            </button>
            <a
              href="https://klasly.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-300 hover:text-gray-400"
            >
              Powered by Klasly
            </a>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <WidgetLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
    </div>
  );
}
