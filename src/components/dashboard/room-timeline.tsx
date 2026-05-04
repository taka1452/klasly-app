"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Room = { id: string; name: string; capacity: number | null };
type RoomEvent = {
  id: string;
  room_id: string;
  session_date?: string;
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

// Static class strings so Tailwind keeps them in the final bundle.
type RoomColor = {
  bg: string;
  border: string;
  dot: string;
  text: string;
  badge: string;
  header: string;
};
const ROOM_PALETTE: RoomColor[] = [
  { bg: "bg-brand-50", border: "border-brand-500", dot: "bg-brand-500", text: "text-brand-900", badge: "bg-brand-100 text-brand-800", header: "bg-brand-100 text-brand-800" },
  { bg: "bg-teal-50", border: "border-teal-500", dot: "bg-teal-500", text: "text-teal-900", badge: "bg-teal-100 text-teal-800", header: "bg-teal-100 text-teal-800" },
  { bg: "bg-violet-50", border: "border-violet-500", dot: "bg-violet-500", text: "text-violet-900", badge: "bg-violet-100 text-violet-800", header: "bg-violet-100 text-violet-800" },
  { bg: "bg-amber-50", border: "border-amber-500", dot: "bg-amber-500", text: "text-amber-900", badge: "bg-amber-100 text-amber-800", header: "bg-amber-100 text-amber-800" },
  { bg: "bg-rose-50", border: "border-rose-500", dot: "bg-rose-500", text: "text-rose-900", badge: "bg-rose-100 text-rose-800", header: "bg-rose-100 text-rose-800" },
  { bg: "bg-emerald-50", border: "border-emerald-500", dot: "bg-emerald-500", text: "text-emerald-900", badge: "bg-emerald-100 text-emerald-800", header: "bg-emerald-100 text-emerald-800" },
  { bg: "bg-sky-50", border: "border-sky-500", dot: "bg-sky-500", text: "text-sky-900", badge: "bg-sky-100 text-sky-800", header: "bg-sky-100 text-sky-800" },
  { bg: "bg-fuchsia-50", border: "border-fuchsia-500", dot: "bg-fuchsia-500", text: "text-fuchsia-900", badge: "bg-fuchsia-100 text-fuchsia-800", header: "bg-fuchsia-100 text-fuchsia-800" },
];

function colorIndexFor(roomId: string, rooms: Room[]): number {
  const idx = rooms.findIndex((r) => r.id === roomId);
  return idx >= 0 ? idx % ROOM_PALETTE.length : 0;
}

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

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function RoomTimeline() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<RoomView>("day");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [eventsByDate, setEventsByDate] = useState<Record<string, RoomEvent[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  const dateStr = ymd(currentDate);

  const fetchData = useCallback(async (d: Date, v: RoomView) => {
    setLoading(true);
    try {
      if (v === "day") {
        const res = await fetch(`/api/dashboard/room-usage?date=${ymd(d)}`);
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms ?? []);
          setEvents(data.events ?? []);
        }
      } else {
        // Week / month: single range fetch (was N sequential requests).
        let start: Date, end: Date;
        if (v === "week") {
          const dayOfWeek = d.getDay();
          start = new Date(d);
          start.setDate(d.getDate() - dayOfWeek);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
        } else {
          start = new Date(d.getFullYear(), d.getMonth(), 1);
          end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        }
        const res = await fetch(
          `/api/dashboard/room-usage?start=${ymd(start)}&end=${ymd(end)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms ?? []);
          setEventsByDate(data.eventsByDate ?? {});
        }
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
  const isToday = dateStr === ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;

  // Rooms that actually have at least one booking somewhere in view (for legend).
  const roomsInView = useMemo(() => {
    if (view === "day") {
      const ids = new Set(events.map((e) => e.room_id));
      return rooms.filter((r) => ids.has(r.id));
    }
    const ids = new Set<string>();
    Object.values(eventsByDate).forEach((evts) =>
      evts.forEach((e) => ids.add(e.room_id)),
    );
    return rooms.filter((r) => ids.has(r.id));
  }, [view, rooms, events, eventsByDate]);

  return (
    <div>
      {/* Date navigation + view toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePrev} className="tap-target rounded-lg border border-gray-300 hover:bg-gray-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button type="button" onClick={handleToday} className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100">
            Today
          </button>
          <button type="button" onClick={handleNext} className="tap-target rounded-lg border border-gray-300 hover:bg-gray-100">
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

      {/* Room color legend */}
      {!loading && roomsInView.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Rooms
          </span>
          {roomsInView.map((r) => {
            const c = ROOM_PALETTE[colorIndexFor(r.id, rooms)];
            return (
              <span
                key={r.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${c.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                {r.name}
              </span>
            );
          })}
        </div>
      )}

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
              days.push(ymd(d));
            }
            return days.map((day) => {
              const dayEvents = eventsByDate[day] || [];
              const d = new Date(day + "T00:00:00");
              return (
                <div key={day}>
                  <h4 className="mb-1 text-sm font-semibold text-gray-700">
                    {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </h4>
                  {dayEvents.length === 0 ? (
                    <p className="ml-2 text-xs text-gray-400">No bookings</p>
                  ) : (
                    <div className="ml-2 space-y-1.5">
                      {dayEvents.map((evt) => {
                        const roomName = rooms.find((r) => r.id === evt.room_id)?.name || "";
                        const c = ROOM_PALETTE[colorIndexFor(evt.room_id, rooms)];
                        const isClass = evt.event_type === "class";
                        return (
                          <div
                            key={evt.id}
                            className={`flex items-center gap-2 rounded-md border-l-[3px] ${c.border} ${c.bg} px-2 py-1.5`}
                          >
                            <span className="shrink-0 text-xs tabular-nums text-gray-600">
                              {formatShort(evt.start_time)}–{formatShort(evt.end_time)}
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isClass
                                  ? "bg-white/70 text-gray-700"
                                  : "bg-white text-gray-700 ring-1 ring-gray-200"
                              }`}
                            >
                              {isClass ? "Class" : "Room"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                              {evt.title}
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.badge}`}>
                              {roomName}
                            </span>
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

      {/* Month view: calendar grid with colored dots */}
      {view === "month" && !loading && (
        <p className="mb-2 text-xs text-gray-400">Click any day to switch to Day view.</p>
      )}
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
                  const day = date ? ymd(date) : "";
                  const dayEvts = date ? eventsByDate[day] || [] : [];
                  const today = date && day === ymd(new Date());
                  // One badge per unique room booked on this day, up to 4
                  const uniqueRoomIds = Array.from(
                    new Set(dayEvts.map((e) => e.room_id)),
                  );
                  return (
                    <div
                      key={di}
                      className={`min-h-[88px] border-b border-r border-gray-200 p-1.5 last:border-r-0 ${!date ? "bg-gray-50/50" : ""} ${today ? "bg-brand-50/30" : ""}`}
                      onClick={() => date && (setCurrentDate(date), setView("day"))}
                      style={{ cursor: date ? "pointer" : "default" }}
                    >
                      {date && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${today ? "bg-brand-600 text-white" : "text-gray-700"}`}>
                              {date.getDate()}
                            </span>
                            {dayEvts.length > 0 && (
                              <span className="text-[10px] tabular-nums text-gray-400">
                                {dayEvts.length}
                              </span>
                            )}
                          </div>
                          {uniqueRoomIds.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {uniqueRoomIds.slice(0, 4).map((rid) => {
                                const c = ROOM_PALETTE[colorIndexFor(rid, rooms)];
                                const room = rooms.find((r) => r.id === rid);
                                return (
                                  <span
                                    key={rid}
                                    title={room?.name}
                                    className={`h-2 w-2 rounded-full ${c.dot}`}
                                  />
                                );
                              })}
                              {uniqueRoomIds.length > 4 && (
                                <span className="text-[9px] text-gray-400">
                                  +{uniqueRoomIds.length - 4}
                                </span>
                              )}
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
              <div className="h-10 border-b border-gray-200" />
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
              const c = ROOM_PALETTE[colorIndexFor(room.id, rooms)];

              return (
                <div
                  key={room.id}
                  className="flex-1 border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: "160px" }}
                >
                  {/* Room header — colored per room */}
                  <div className={`flex h-10 items-center justify-center border-b border-gray-200 px-2 ${c.header}`}>
                    <p className="truncate text-xs font-semibold">{room.name}</p>
                  </div>

                  {/* Time grid + events */}
                  <div className="relative" style={{ height: `${gridHeight}px` }}>
                    {Array.from({ length: totalHours }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: `${i * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {isToday && nowTop > 0 && nowTop < gridHeight && (
                      <div
                        className="absolute left-0 right-0 z-20 h-0.5 bg-red-400"
                        style={{ top: `${nowTop}px` }}
                      />
                    )}

                    {roomEvents.map((evt) => {
                      const startMin = parseMin(evt.start_time);
                      const endMin = parseMin(evt.end_time);
                      const top = ((startMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);

                      const isClass = evt.event_type === "class";
                      const isCompact = height < 48;

                      return (
                        <div
                          key={evt.id}
                          className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-[13px] leading-snug ${c.bg} ${c.border} ${c.text}`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          {isCompact ? (
                            <span className="flex items-center gap-1 truncate font-medium">
                              <span className={`shrink-0 rounded px-1 text-[10px] font-semibold uppercase tracking-wider ${
                                isClass ? "bg-white/70 text-gray-700" : "bg-white text-gray-700 ring-1 ring-gray-200"
                              }`}>
                                {isClass ? "Class" : "Room"}
                              </span>
                              <span className="truncate">{evt.title}</span>
                            </span>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 truncate font-medium">
                                <span className={`shrink-0 rounded px-1 text-[10px] font-semibold uppercase tracking-wider ${
                                  isClass ? "bg-white/70 text-gray-700" : "bg-white text-gray-700 ring-1 ring-gray-200"
                                }`}>
                                  {isClass ? "Class" : "Room"}
                                </span>
                                <span className="truncate">{evt.title}</span>
                              </div>
                              <div className="truncate opacity-75">
                                {formatShort(evt.start_time)} – {formatShort(evt.end_time)}
                              </div>
                              {height >= 60 && evt.instructor_name && (
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
