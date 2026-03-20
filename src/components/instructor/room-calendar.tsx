"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Room = { id: string; name: string; capacity: number | null };
type CalEvent = {
  id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  title: string;
  is_own: boolean;
  event_type: "room_booking" | "class";
  is_public: boolean;
  recurring: boolean;
};

const HOUR_HEIGHT = 60;
const SLOT_MINUTES = 15;
const OPERATING_START = 6; // 6 AM
const OPERATING_END = 22; // 10 PM

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

function timeStr(hour: number, min: number) {
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateParam(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function InstructorRoomCalendar() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking form state
  const [showForm, setShowForm] = useState(false);
  const [formRoom, setFormRoom] = useState<Room | null>(null);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formTitle, setFormTitle] = useState("");
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [formBookingType, setFormBookingType] = useState<"one_time" | "recurring">("one_time");
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formWeeks, setFormWeeks] = useState(4);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const dateStr = formatDateParam(currentDate);

  const fetchData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/instructor/room-availability?date=${date}`);
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

  // Determine visible time range
  let gridStartHour = OPERATING_START;
  let gridEndHour = OPERATING_END;
  if (events.length > 0) {
    const allStarts = events.map((e) => parseMin(e.start_time));
    const allEnds = events.map((e) => parseMin(e.end_time));
    gridStartHour = Math.max(OPERATING_START, Math.floor(Math.min(...allStarts) / 60) - 1);
    gridEndHour = Math.min(OPERATING_END, Math.ceil(Math.max(...allEnds) / 60) + 1);
  }
  // Ensure at least a few hours shown
  if (gridEndHour - gridStartHour < 4) {
    gridEndHour = Math.min(OPERATING_END, gridStartHour + 8);
  }
  const totalHours = gridEndHour - gridStartHour;
  const gridHeight = totalHours * HOUR_HEIGHT;

  // Current time indicator
  const now = new Date();
  const isToday = dateStr === formatDateParam(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;

  // Is a slot occupied?
  function isSlotOccupied(roomId: string, slotMinute: number) {
    return events.some(
      (e) =>
        e.room_id === roomId &&
        parseMin(e.start_time) <= slotMinute &&
        parseMin(e.end_time) > slotMinute,
    );
  }

  // Click on empty slot
  function handleSlotClick(room: Room, hourMinute: number) {
    if (isSlotOccupied(room.id, hourMinute)) return;

    const h = Math.floor(hourMinute / 60);
    const m = hourMinute % 60;
    setFormRoom(room);
    setFormStartTime(timeStr(h, m));
    setFormEndTime(timeStr(h + 1, m)); // Default 1 hour
    setFormTitle("");
    setFormIsPublic(true);
    setFormNotes("");
    setFormBookingType("one_time");
    setFormDayOfWeek(currentDate.getDay());
    setFormWeeks(4);
    setFormError("");
    setShowForm(true);
  }

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRoom) return;
    setFormError("");
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/instructor/room-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: formRoom.id,
          title: formTitle,
          booking_date: formBookingType === "one_time" ? dateStr : undefined,
          start_time: formStartTime,
          end_time: formEndTime,
          is_public: formIsPublic,
          notes: formNotes || null,
          recurring: formBookingType === "recurring",
          day_of_week: formBookingType === "recurring" ? formDayOfWeek : undefined,
          weeks: formBookingType === "recurring" ? formWeeks : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create booking");
        setFormSubmitting(false);
        return;
      }

      setShowForm(false);
      setFormSubmitting(false);
      fetchData(dateStr);
      router.refresh();
    } catch {
      setFormError("Failed to create booking");
      setFormSubmitting(false);
    }
  }

  // Cancel own booking
  async function handleCancelBooking(bookingId: string) {
    if (!confirm("Cancel this booking?")) return;
    try {
      await fetch(`/api/instructor/room-bookings/${bookingId}`, { method: "DELETE" });
      fetchData(dateStr);
      router.refresh();
    } catch {
      // ignore
    }
  }

  const isPastDate = dateStr < formatDateParam(new Date());

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

      {loading && events.length === 0 && rooms.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">Loading rooms...</p>
          </div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No rooms available.</p>
          <p className="mt-1 text-sm text-gray-400">
            Ask the studio owner to add rooms.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <div className="flex" style={{ minWidth: `${60 + rooms.length * 180}px` }}>
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
            {rooms.map((room) => {
              const roomEvents = events.filter((e) => e.room_id === room.id);

              return (
                <div
                  key={room.id}
                  className="flex-1 border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: "160px" }}
                >
                  {/* Room header */}
                  <div className="flex h-10 flex-col items-center justify-center border-b border-gray-200 bg-gray-50 px-2">
                    <p className="truncate text-xs font-semibold text-gray-700">{room.name}</p>
                    {room.capacity && (
                      <p className="text-[10px] text-gray-400">Cap. {room.capacity}</p>
                    )}
                  </div>

                  {/* Time grid */}
                  <div className="relative" style={{ height: `${gridHeight}px` }}>
                    {/* Hour lines */}
                    {Array.from({ length: totalHours }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: `${i * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Clickable 15-min slots */}
                    {!isPastDate &&
                      Array.from(
                        { length: totalHours * (60 / SLOT_MINUTES) },
                        (_, i) => {
                          const slotMinute = gridStartHour * 60 + i * SLOT_MINUTES;
                          const occupied = isSlotOccupied(room.id, slotMinute);
                          const top = ((slotMinute - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                          const height = (SLOT_MINUTES / 60) * HOUR_HEIGHT;
                          return (
                            <div
                              key={i}
                              className={`absolute left-0 right-0 z-0 ${
                                occupied
                                  ? ""
                                  : "cursor-pointer hover:bg-brand-50/50 transition-colors"
                              }`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => !occupied && handleSlotClick(room, slotMinute)}
                            />
                          );
                        },
                      )}

                    {/* Current time line */}
                    {isToday && nowTop > 0 && nowTop < gridHeight && (
                      <div
                        className="absolute left-0 right-0 z-30 h-0.5 bg-red-400"
                        style={{ top: `${nowTop}px` }}
                      />
                    )}

                    {/* Event blocks */}
                    {roomEvents.map((evt) => {
                      const startMin = parseMin(evt.start_time);
                      const endMin = parseMin(evt.end_time);
                      const top = ((startMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);

                      let bg: string;
                      if (evt.is_own) {
                        bg = evt.event_type === "class"
                          ? "bg-brand-50 border-l-[3px] border-brand-500 text-brand-900"
                          : "bg-teal-50 border-l-[3px] border-teal-500 text-teal-900";
                      } else {
                        bg = "bg-gray-100 border-l-[3px] border-gray-300 text-gray-500";
                      }

                      const isCompact = height < 40;

                      return (
                        <div
                          key={evt.id}
                          className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-xs leading-tight ${bg}`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          {isCompact ? (
                            <span className="truncate font-medium">
                              {evt.is_own && evt.event_type === "room_booking" && (
                                <span className="mr-1 inline-block rounded bg-teal-200 px-0.5 text-[9px] font-semibold uppercase text-teal-700">
                                  Room
                                </span>
                              )}
                              {evt.title}
                            </span>
                          ) : (
                            <>
                              <div className="flex items-center gap-1">
                                {evt.is_own && evt.event_type === "room_booking" && (
                                  <span className="inline-block rounded bg-teal-200 px-0.5 text-[9px] font-semibold uppercase text-teal-700">
                                    Room
                                  </span>
                                )}
                                <span className="truncate font-medium">{evt.title}</span>
                              </div>
                              <div className="truncate opacity-75">
                                {formatShort(evt.start_time)} – {formatShort(evt.end_time)}
                              </div>
                              {/* Cancel button for own bookings */}
                              {evt.is_own && evt.event_type === "room_booking" && height >= 50 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelBooking(evt.id);
                                  }}
                                  className="mt-0.5 text-[10px] text-red-500 underline hover:text-red-700"
                                >
                                  Cancel
                                </button>
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

      {/* Booking form modal */}
      {showForm && formRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Book Room</h3>
                <p className="text-sm text-gray-500">
                  {formRoom.name} · {formatDateLabel(currentDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Yoga class, Private session, etc."
                  required
                  className="input-field mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start *</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    required
                    className="input-field mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End *</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    required
                    className="input-field mt-1"
                  />
                </div>
              </div>

              {/* Schedule type */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Schedule</label>
                <div className="mt-1.5 flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="schedType"
                      checked={formBookingType === "one_time"}
                      onChange={() => setFormBookingType("one_time")}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                    One-time
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="schedType"
                      checked={formBookingType === "recurring"}
                      onChange={() => setFormBookingType("recurring")}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                    Weekly recurring
                  </label>
                </div>
              </div>

              {formBookingType === "recurring" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Day</label>
                    <select
                      value={formDayOfWeek}
                      onChange={(e) => setFormDayOfWeek(parseInt(e.target.value, 10))}
                      className="input-field mt-1"
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weeks</label>
                    <input
                      type="number"
                      value={formWeeks}
                      onChange={(e) => setFormWeeks(parseInt(e.target.value, 10) || 4)}
                      min={1}
                      max={52}
                      className="input-field mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="calPublic"
                  checked={formIsPublic}
                  onChange={(e) => setFormIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                <label htmlFor="calPublic" className="text-sm text-gray-700">
                  Public <span className="text-gray-400">(visible to members)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional details..."
                  className="input-field mt-1"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={formSubmitting} className="btn-primary flex-1">
                  {formSubmitting ? "Booking..." : "Book room"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
