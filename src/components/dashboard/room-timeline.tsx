"use client";

import { useCallback, useEffect, useState } from "react";

type Room = { id: string; name: string; capacity: number | null };
type RoomEvent = {
  id: string;
  room_id: string;
  title: string;
  start_time: string;
  end_time: string;
  instructor_name: string;
  event_type: "room_booking" | "class";
  is_public: boolean;
  recurring: boolean;
};

type RoomView = "day" | "week" | "month";

const HOUR_HEIGHT = 60; // px per hour

function parseMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatShort(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m > 0 ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RoomTimeline() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<RoomView>("day");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [weekEvents, setWeekEvents] = useState<Map<string, RoomEvent[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const dateStr = currentDate.toISOString().split("T")[0];

  const fetchData = useCallback(async (d: Date, v: RoomView) => {
    setLoading(true);
    try {
      if (v === "day") {
        const date = d.toISOString().split("T")[0];
        const res = await fetch(`/api/dashboard/room-usage?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms ?? []);
          setEvents(data.events ?? []);
        }
      } else if (v === "week") {
        // Fetch 7 days (Sunday-start week)
        const dayOfWeek = d.getDay();
        const sunday = new Date(d);
        sunday.setDate(d.getDate() - dayOfWeek);
        const weekMap = new Map<string, RoomEvent[]>();
        let allRooms: Room[] = [];

        for (let i = 0; i < 7; i++) {
          const day = new Date(sunday);
          day.setDate(sunday.getDate() + i);
          const dayStr = day.toISOString().split("T")[0];
          const res = await fetch(`/api/dashboard/room-usage?date=${dayStr}`);
          if (res.ok) {
            const data = await res.json();
            weekMap.set(dayStr, data.events ?? []);
            if (data.rooms && data.rooms.length > allRooms.length) allRooms = data.rooms;
          }
        }
        setRooms(allRooms);
        setWeekEvents(weekMap);
      } else {
        // Month: fetch whole month (daily summaries)
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const weekMap = new Map<string, RoomEvent[]>();
        let allRooms: Room[] = [];

        for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
          const dayStr = day.toISOString().split("T")[0];
          const res = await fetch(`/api/dashboard/room-usage?date=${dayStr}`);
          if (res.ok) {
            const data = await res.json();
            if (data.events?.length) weekMap.set(dayStr, data.events);
            if (data.rooms && data.rooms.length > allRooms.length) allRooms = data.rooms;
          }
        }
        setRooms(allRooms);
        setWeekEvents(weekMap);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentDate, view);
  }, [currentDate, view, fetchData]);

  function handlePrev() {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (view === "day") n.setDate(n.getDate() - 1);
      else if (view === "week") n.setDate(n.getDate() - 7);
      else n.setMonth(n.getMonth() - 1);
      return n;
    });
  }
  function handleNext() {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (view === "day") n.setDate(n.getDate() + 1);
      else if (view === "week") n.setDate(n.getDate() + 7);
      else n.setMonth(n.getMonth() + 1);
      return n;
    });
  }
  function handleToday() {
    setCurrentDate(new Date());
  }

  // Only rooms that have events
  const activeRoomIds = new Set(events.map((e) => e.room_id));
  const activeRooms = rooms.filter((r) => activeRoomIds.has(r.id));

  // Time range: only hours with events (with 1h padding)
  let gridStartHour = 8;
  let gridEndHour = 18;
  if (events.length > 0) {
    const allStarts = events.map((e) => parseMin(e.start_time));
    const allEnds = events.map((e) => parseMin(e.end_time));
    gridStartHour = Math.max(0, Math.floor(Math.min(...allStarts) / 60) - 1);
    gridEndHour = Math.min(24, Math.ceil(Math.max(...allEnds) / 60) + 1);
  }
  const totalHours = gridEndHour - gridStartHour;
  const gridHeight = totalHours * HOUR_HEIGHT;

  // Current time
  const now = new Date();
  const isToday = dateStr === now.toISOString().split("T")[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <div>
      {/* Date navigation + view toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePrev} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button type="button" onClick={handleToday} className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100">
            Today
          </button>
          <button type="button" onClick={handleNext} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <span className="ml-2 text-sm font-medium text-gray-700">
            {view === "month"
              ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : formatDateLabel(currentDate)}
          </span>
        </div>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
          {(["day", "week", "month"] as RoomView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                view === v
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Week view: list summary by day */}
      {view === "week" && !loading && (
        <div className="space-y-3">
          {(() => {
            const dayOfWeek = currentDate.getDay();
            const sunday = new Date(currentDate);
            sunday.setDate(currentDate.getDate() - dayOfWeek);
            const days: string[] = [];
            for (let i = 0; i < 7; i++) {
              const d = new Date(sunday);
              d.setDate(sunday.getDate() + i);
              days.push(d.toISOString().split("T")[0]);
            }
            return days.map((dayStr) => {
              const dayEvents = weekEvents.get(dayStr) || [];
              const d = new Date(dayStr + "T00:00:00");
              return (
                <div key={dayStr}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">
                    {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </h4>
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-gray-400 ml-2">No bookings</p>
                  ) : (
                    <div className="space-y-1 ml-2">
                      {dayEvents.map((evt) => {
                        const roomName = rooms.find((r) => r.id === evt.room_id)?.name || "";
                        return (
                          <div key={evt.id} className="flex items-center gap-2 text-sm">
                            <span className={`inline-block h-2 w-2 rounded-full ${evt.event_type === "class" ? "bg-brand-500" : "bg-teal-500"}`} />
                            <span className="text-gray-500">{formatShort(evt.start_time)}–{formatShort(evt.end_time)}</span>
                            <span className="font-medium text-gray-800">{evt.title}</span>
                            <span className="text-xs text-gray-400">{roomName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Month view: calendar grid */}
      {view === "month" && !loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-r border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-500 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          {(() => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const first = new Date(year, month, 1);
            const last = new Date(year, month + 1, 0);
            const startDay = first.getDay();
            const cells: (Date | null)[] = [];
            for (let i = 0; i < startDay; i++) cells.push(null);
            for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
            while (cells.length % 7 !== 0) cells.push(null);

            const weeks: (Date | null)[][] = [];
            for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

            return weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((date, di) => {
                  const dayStr = date ? date.toISOString().split("T")[0] : "";
                  const dayEvts = date ? (weekEvents.get(dayStr) || []) : [];
                  const today = date && dayStr === new Date().toISOString().split("T")[0];
                  return (
                    <div
                      key={di}
                      className={`min-h-[70px] border-b border-r border-gray-200 p-1 last:border-r-0 ${!date ? "bg-gray-50/50" : ""} ${today ? "bg-brand-50/30" : ""}`}
                      onClick={() => date && (setCurrentDate(date), setView("day"))}
                      style={{ cursor: date ? "pointer" : "default" }}
                    >
                      {date && (
                        <>
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${today ? "bg-brand-600 text-white" : "text-gray-700"}`}>
                            {date.getDate()}
                          </span>
                          {dayEvts.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-gray-500">
                              {dayEvts.length} booking{dayEvts.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      )}

      {/* Day view */}
      {view === "day" && !loading && events.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No room usage on this day.</p>
          <p className="mt-1 text-sm text-gray-400">
            Navigate to another date or check the Classes calendar.
          </p>
        </div>
      ) : view === "day" && !loading ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <div className="flex" style={{ minWidth: `${60 + activeRooms.length * 180}px` }}>
            {/* Time gutter */}
            <div className="w-[60px] shrink-0 border-r border-gray-200">
              {/* Header spacer */}
              <div className="h-10 border-b border-gray-200" />
              {/* Hour labels */}
              <div className="relative" style={{ height: `${gridHeight}px` }}>
                {Array.from({ length: totalHours }, (_, i) => {
                  const h = gridStartHour + i;
                  return (
                    <div
                      key={h}
                      className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400"
                      style={{ top: `${i * HOUR_HEIGHT}px` }}
                    >
                      {h % 12 || 12} {h >= 12 ? "PM" : "AM"}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Room columns */}
            {activeRooms.map((room) => {
              const roomEvents = events.filter((e) => e.room_id === room.id);

              return (
                <div
                  key={room.id}
                  className="flex-1 border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: "160px" }}
                >
                  {/* Room header */}
                  <div className="flex h-10 items-center justify-center border-b border-gray-200 bg-gray-50 px-2">
                    <p className="truncate text-xs font-semibold text-gray-700">{room.name}</p>
                  </div>

                  {/* Time grid + events */}
                  <div className="relative" style={{ height: `${gridHeight}px` }}>
                    {/* Hour lines */}
                    {Array.from({ length: totalHours }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: `${i * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Current time line */}
                    {isToday && nowTop > 0 && nowTop < gridHeight && (
                      <div
                        className="absolute left-0 right-0 z-20 h-0.5 bg-red-400"
                        style={{ top: `${nowTop}px` }}
                      />
                    )}

                    {/* Event blocks */}
                    {roomEvents.map((evt) => {
                      const startMin = parseMin(evt.start_time);
                      const endMin = parseMin(evt.end_time);
                      const top = ((startMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);

                      const isClass = evt.event_type === "class";
                      const bg = isClass
                        ? "bg-brand-50 border-l-[3px] border-brand-500 text-brand-900"
                        : "bg-teal-50 border-l-[3px] border-teal-500 text-teal-900";

                      const isCompact = height < 40;

                      return (
                        <div
                          key={evt.id}
                          className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-xs leading-tight ${bg}`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          {isCompact ? (
                            <span className="truncate font-medium">
                              {!isClass && (
                                <span className="mr-1 inline-block rounded bg-teal-200 px-0.5 text-[9px] font-semibold uppercase text-teal-700">
                                  Room
                                </span>
                              )}
                              {evt.title}
                            </span>
                          ) : (
                            <>
                              <div className="truncate font-medium">
                                {!isClass && (
                                  <span className="mr-1 inline-block rounded bg-teal-200 px-0.5 text-[9px] font-semibold uppercase text-teal-700">
                                    Room
                                  </span>
                                )}
                                {evt.title}
                              </div>
                              <div className="truncate opacity-75">
                                {formatShort(evt.start_time)} – {formatShort(evt.end_time)}
                              </div>
                              {height >= 55 && evt.instructor_name && (
                                <div className="truncate opacity-60">
                                  {evt.instructor_name}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
