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

const HOUR_WIDTH = 100; // px per hour
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

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
    setCurrentDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
  }
  function handleNext() {
    setCurrentDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
  }
  function handleToday() {
    setCurrentDate(new Date());
  }

  const totalWidth = HOURS.length * HOUR_WIDTH;

  // Current time indicator
  const now = new Date();
  const isToday = dateStr === now.toISOString().split("T")[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowLeft = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_WIDTH;

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

      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No rooms configured.</p>
          <p className="mt-1 text-sm text-gray-400">
            Add rooms in Manage Rooms to see the timeline.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <div style={{ minWidth: `${totalWidth + 120}px` }}>
            {/* Header: hours */}
            <div className="flex border-b border-gray-200">
              <div className="w-[120px] shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs font-medium text-gray-500">Room</span>
              </div>
              <div className="relative flex-1">
                <div className="flex">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="shrink-0 border-r border-gray-100 px-1 py-2 text-center"
                      style={{ width: `${HOUR_WIDTH}px` }}
                    >
                      <span className="text-[10px] text-gray-400">
                        {h % 12 || 12}{h >= 12 ? "PM" : "AM"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Room rows */}
            {rooms.map((room) => {
              const roomEvents = events.filter((e) => e.room_id === room.id);

              return (
                <div key={room.id} className="flex border-b border-gray-100 last:border-b-0">
                  {/* Room name */}
                  <div className="flex w-[120px] shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate">{room.name}</p>
                      {room.capacity && (
                        <p className="text-[10px] text-gray-400">cap. {room.capacity}</p>
                      )}
                    </div>
                  </div>

                  {/* Timeline area */}
                  <div className="relative flex-1" style={{ height: "52px" }}>
                    {/* Hour grid lines */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute top-0 h-full border-r border-gray-50"
                        style={{ left: `${(h - START_HOUR) * HOUR_WIDTH}px` }}
                      />
                    ))}

                    {/* Current time line */}
                    {isToday && nowLeft > 0 && nowLeft < totalWidth && (
                      <div
                        className="absolute top-0 z-20 h-full w-0.5 bg-red-400"
                        style={{ left: `${nowLeft}px` }}
                      />
                    )}

                    {/* Events */}
                    {roomEvents.map((evt) => {
                      const startMin = parseMin(evt.start_time);
                      const endMin = parseMin(evt.end_time);
                      const left = ((startMin - START_HOUR * 60) / 60) * HOUR_WIDTH;
                      const width = ((endMin - startMin) / 60) * HOUR_WIDTH;

                      const isClass = evt.event_type === "class";
                      const bg = isClass
                        ? "bg-brand-100 border-brand-400 text-brand-900"
                        : "bg-teal-100 border-teal-400 text-teal-900";

                      return (
                        <div
                          key={evt.id}
                          className={`absolute top-1 z-10 flex items-center gap-1 overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight ${bg}`}
                          style={{
                            left: `${Math.max(left, 0)}px`,
                            width: `${Math.max(width - 2, 20)}px`,
                            height: "calc(100% - 8px)",
                          }}
                          title={`${evt.title} · ${evt.instructor_name}\n${formatShort(evt.start_time)}–${formatShort(evt.end_time)}`}
                        >
                          <span className="truncate font-medium">
                            {!isClass && (
                              <span className="mr-1 rounded bg-teal-200 px-0.5 text-[9px] font-semibold uppercase text-teal-700">
                                Room
                              </span>
                            )}
                            {evt.title}
                          </span>
                          {width > 120 && evt.instructor_name && (
                            <span className="shrink-0 truncate opacity-70">
                              · {evt.instructor_name}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty state for this room */}
                    {roomEvents.length === 0 && (
                      <div className="flex h-full items-center px-4">
                        <span className="text-[11px] text-gray-300">—</span>
                      </div>
                    )}
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
