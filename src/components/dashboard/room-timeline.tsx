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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const dateStr = currentDate.toISOString().split("T")[0];

  const fetchData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/room-usage?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms ?? []);
        setEvents(data.events ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateStr);
  }, [dateStr, fetchData]);

  function handlePrev() {
    setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  }
  function handleNext() {
    setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
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
      {/* Date navigation */}
      <div className="mb-4 flex items-center gap-3">
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
        <span className="text-sm font-medium text-gray-700">
          {formatDateLabel(currentDate)}
        </span>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No room usage on this day.</p>
          <p className="mt-1 text-sm text-gray-400">
            Navigate to another date or check the Classes calendar.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
