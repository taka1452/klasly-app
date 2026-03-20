"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  date: string; // YYYY-MM-DD
};

type ClassTemplate = {
  id: string;
  name: string;
  duration_minutes: number;
  capacity: number;
  is_public: boolean;
  instructor_id: string | null;
  instructors: { id: string; profiles: { full_name: string } | null } | null;
};

const HOUR_HEIGHT = 60;
const SLOT_MINUTES = 15;
const OPERATING_START = 6;
const OPERATING_END = 22;

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

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getWeekStart(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatWeekRange(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

/** Add duration_minutes to a "HH:MM" time string */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export default function InstructorRoomCalendar() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Templates
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // Booking form state
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formRoomId, setFormRoomId] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formTitle, setFormTitle] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string>("");
  const [formRepeat, setFormRepeat] = useState<"single" | "weekly">("single");
  const [formRepeatWeeks, setFormRepeatWeeks] = useState(4);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Fetch templates once
  useEffect(() => {
    if (templatesLoaded) return;
    fetch("/api/class-templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setTemplatesLoaded(true);
      })
      .catch(() => setTemplatesLoaded(true));
  }, [templatesLoaded]);

  const fetchWeek = useCallback(async (ws: Date) => {
    setLoading(true);
    const days = getWeekDays(ws);
    try {
      const results = await Promise.all(
        days.map((d) =>
          fetch(`/api/instructor/room-availability?date=${fmtDate(d)}`)
            .then((r) => (r.ok ? r.json() : { rooms: [], events: [] }))
            .catch(() => ({ rooms: [], events: [] })),
        ),
      );

      // Rooms from first non-empty response
      const firstRooms = results.find((r) => r.rooms?.length > 0)?.rooms ?? [];
      setRooms(firstRooms);

      // Collect all events with date tag
      const collected: CalEvent[] = [];
      results.forEach((r, i) => {
        for (const e of r.events ?? []) {
          collected.push({ ...e, date: fmtDate(days[i]) });
        }
      });
      setAllEvents(collected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeek(weekStart);
  }, [weekStart, fetchWeek]);

  function handlePrevWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function handleNextWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function handleToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  // Filter events by selected room
  const events = selectedRoomId === "all"
    ? allEvents
    : allEvents.filter((e) => e.room_id === selectedRoomId);

  // Time range
  let gridStartHour = OPERATING_START;
  let gridEndHour = OPERATING_END;
  if (events.length > 0) {
    const allStarts = events.map((e) => parseMin(e.start_time));
    const allEnds = events.map((e) => parseMin(e.end_time));
    gridStartHour = Math.max(OPERATING_START, Math.floor(Math.min(...allStarts) / 60) - 1);
    gridEndHour = Math.min(OPERATING_END, Math.ceil(Math.max(...allEnds) / 60) + 1);
  }
  if (gridEndHour - gridStartHour < 4) {
    gridEndHour = Math.min(OPERATING_END, gridStartHour + 8);
  }
  const totalHours = gridEndHour - gridStartHour;
  const gridHeight = totalHours * HOUR_HEIGHT;

  // Current time
  const now = new Date();
  const todayStr = fmtDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;

  // Is slot occupied on a given date?
  function isSlotOccupied(date: string, roomId: string, slotMinute: number) {
    return allEvents.some(
      (e) =>
        e.date === date &&
        e.room_id === roomId &&
        parseMin(e.start_time) <= slotMinute &&
        parseMin(e.end_time) > slotMinute,
    );
  }

  // Slot click: find first available room or the selected room
  function handleSlotClick(date: string, _dayIdx: number, slotMinute: number) {
    const targetRooms = selectedRoomId === "all" ? rooms : rooms.filter((r) => r.id === selectedRoomId);
    const availRoom = targetRooms.find((r) => !isSlotOccupied(date, r.id, slotMinute));
    if (!availRoom) return;

    const h = Math.floor(slotMinute / 60);
    const m = slotMinute % 60;
    setFormDate(date);
    setFormRoomId(availRoom.id);
    setFormStartTime(timeStr(h, m));
    setFormEndTime(timeStr(h + 1, m));
    setFormTitle("");
    setFormTemplateId("");
    setFormRepeat("single");
    setFormRepeatWeeks(4);
    setFormError("");
    setShowForm(true);
  }

  // When template changes, auto-fill duration (end_time) and title
  function handleTemplateChange(templateId: string) {
    setFormTemplateId(templateId);
    if (templateId) {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setFormEndTime(addMinutesToTime(formStartTime, tpl.duration_minutes));
        setFormTitle(tpl.name);
      }
    } else {
      // Room only — clear title, keep times
      setFormTitle("");
    }
  }

  // When start time changes, recalculate end time if template selected
  function handleStartTimeChange(newStart: string) {
    setFormStartTime(newStart);
    if (formTemplateId) {
      const tpl = templates.find((t) => t.id === formTemplateId);
      if (tpl) {
        setFormEndTime(addMinutesToTime(newStart, tpl.duration_minutes));
      }
    }
  }

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: formTemplateId || null,
          room_id: formRoomId,
          date: formDate,
          start_time: formStartTime,
          end_time: formEndTime,
          title: formTitle || undefined,
          repeat: formRepeat,
          repeat_weeks: formRepeat === "weekly" ? formRepeatWeeks : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setFormError("You need to be registered as an instructor to book rooms. Please set up your instructor profile first.");
        } else {
          setFormError(data.error || "Failed to create session");
        }
        setFormSubmitting(false);
        return;
      }

      setShowForm(false);
      setFormSubmitting(false);
      fetchWeek(weekStart);
      router.refresh();
    } catch {
      setFormError("Failed to create session");
      setFormSubmitting(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm("Cancel this session?")) return;
    try {
      await fetch(`/api/sessions/${bookingId}`, { method: "DELETE" });
      fetchWeek(weekStart);
      router.refresh();
    } catch {
      // ignore
    }
  }

  // Find room name by id
  function roomName(id: string) {
    return rooms.find((r) => r.id === id)?.name ?? "";
  }

  return (
    <div>
      {/* Header: navigation + room filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handlePrevWeek} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button type="button" onClick={handleToday} className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100">
          Today
        </button>
        <button type="button" onClick={handleNextWeek} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">
          {formatWeekRange(weekStart)}
        </span>

        {/* Room filter */}
        {rooms.length > 1 && (
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="all">All rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && allEvents.length === 0 && rooms.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16">
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">Loading rooms...</p>
          </div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No rooms available.</p>
          <p className="mt-1 text-sm text-gray-400">Ask the studio owner to add rooms.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Fixed header row */}
          <div className="flex overflow-x-auto" style={{ minWidth: "560px" }}>
            <div className="w-[52px] shrink-0 border-r border-gray-200">
              <div className="h-12 border-b border-gray-200" />
            </div>
            {weekDays.map((day, dayIdx) => {
              const dayStr2 = fmtDate(day);
              const isCurDay = dayStr2 === todayStr;
              return (
                <div
                  key={`hdr-${dayIdx}`}
                  className="flex-1 border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: "72px" }}
                >
                  <div className={`flex h-12 flex-col items-center justify-center border-b border-gray-200 px-1 ${isCurDay ? "bg-brand-50" : "bg-gray-50"}`}>
                    <p className="text-[11px] text-gray-500">{DAY_LABELS[dayIdx]}</p>
                    <p className={`text-sm font-bold ${isCurDay ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white" : "text-gray-700"}`}>
                      {day.getDate()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Scrollable time grid — max 65vh so it fits the screen */}
          <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "65vh", minWidth: "560px" }}>
          <div className="flex" style={{ minWidth: "560px" }}>
            {/* Time gutter */}
            <div className="w-[52px] shrink-0 border-r border-gray-200">
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

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const dayStr = fmtDate(day);
              const dayEvents = events.filter((e) => e.date === dayStr);
              const isCurrentDay = dayStr === todayStr;
              const isPast = dayStr < todayStr;

              return (
                <div
                  key={dayIdx}
                  className="flex-1 border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: "72px" }}
                >
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
                    {!isPast &&
                      Array.from(
                        { length: totalHours * (60 / SLOT_MINUTES) },
                        (_, i) => {
                          const slotMinute = gridStartHour * 60 + i * SLOT_MINUTES;
                          // Check if ALL filtered rooms are occupied
                          const targetRooms = selectedRoomId === "all" ? rooms : rooms.filter((r) => r.id === selectedRoomId);
                          const allOccupied = targetRooms.every((r) => isSlotOccupied(dayStr, r.id, slotMinute));
                          const top = ((slotMinute - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                          const height = (SLOT_MINUTES / 60) * HOUR_HEIGHT;
                          return (
                            <div
                              key={i}
                              className={`absolute left-0 right-0 z-0 ${
                                allOccupied ? "" : "cursor-pointer hover:bg-brand-50/50 transition-colors"
                              }`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => !allOccupied && handleSlotClick(dayStr, dayIdx, slotMinute)}
                            />
                          );
                        },
                      )}

                    {/* Current time line */}
                    {isCurrentDay && nowTop > 0 && nowTop < gridHeight && (
                      <div
                        className="absolute left-0 right-0 z-30 h-0.5 bg-red-400"
                        style={{ top: `${nowTop}px` }}
                      />
                    )}

                    {/* Event blocks */}
                    {dayEvents.map((evt) => {
                      const startMin = parseMin(evt.start_time);
                      const endMin = parseMin(evt.end_time);
                      const top = ((startMin - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);

                      let bg: string;
                      if (evt.is_own) {
                        bg = evt.event_type === "class"
                          ? "bg-brand-50 border-l-[3px] border-brand-500 text-brand-900"
                          : "bg-teal-50 border-l-[3px] border-teal-500 text-teal-900";
                      } else {
                        bg = "bg-gray-100 border-l-[3px] border-gray-300 text-gray-500";
                      }

                      const showRoom = selectedRoomId === "all";

                      return (
                        <div
                          key={evt.id}
                          className={`absolute left-0.5 right-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-[10px] leading-tight ${bg}`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          <div className="truncate font-medium">
                            {evt.is_own && evt.event_type === "room_booking" && (
                              <span className="mr-0.5 inline-block rounded bg-teal-200 px-0.5 text-[8px] font-semibold uppercase text-teal-700">
                                R
                              </span>
                            )}
                            {evt.title}
                          </div>
                          {height >= 32 && (
                            <div className="truncate opacity-70">
                              {formatShort(evt.start_time)}
                              {showRoom && ` · ${roomName(evt.room_id)}`}
                            </div>
                          )}
                          {evt.is_own && height >= 48 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelBooking(evt.id);
                              }}
                              className="text-[9px] text-red-500 underline hover:text-red-700"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </div>{/* /scrollable */}
        </div>
      )}

      {/* Session creation form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">New Session</h3>
                <p className="text-sm text-gray-500">
                  {new Date(formDate + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
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

              {/* Class Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Class Template</label>
                <select
                  value={formTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="input-field mt-1"
                >
                  <option value="">— Room only (no class) —</option>
                  {templates.map((t) => {
                    const instrName = t.instructors?.profiles
                      ? (Array.isArray(t.instructors.profiles) ? (t.instructors.profiles as unknown as { full_name: string }[])[0]?.full_name : t.instructors.profiles.full_name)
                      : null;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.duration_minutes}min){instrName ? ` — ${instrName}` : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {formTemplateId ? "Class session — members can book" : "Room-only reservation — no class attached"}
                </p>
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Room *</label>
                <select
                  value={formRoomId}
                  onChange={(e) => setFormRoomId(e.target.value)}
                  required
                  className="input-field mt-1"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.capacity ? ` (cap. ${r.capacity})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title (only for room-only) */}
              {!formTemplateId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Private session, Rehearsal, etc."
                    required
                    className="input-field mt-1"
                  />
                </div>
              )}

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start *</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
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
                    className={`input-field mt-1 ${formTemplateId ? "bg-gray-50" : ""}`}
                    readOnly={!!formTemplateId}
                  />
                  {formTemplateId && (
                    <p className="mt-0.5 text-xs text-gray-400">Auto-set from template duration</p>
                  )}
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
                      checked={formRepeat === "single"}
                      onChange={() => setFormRepeat("single")}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                    Single
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="schedType"
                      checked={formRepeat === "weekly"}
                      onChange={() => setFormRepeat("weekly")}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                    Weekly
                  </label>
                </div>
              </div>

              {formRepeat === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Number of weeks</label>
                  <input
                    type="number"
                    value={formRepeatWeeks}
                    onChange={(e) => setFormRepeatWeeks(parseInt(e.target.value, 10) || 4)}
                    min={1}
                    max={52}
                    className="input-field mt-1 w-24"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={formSubmitting} className="btn-primary flex-1">
                  {formSubmitting ? "Creating..." : formTemplateId ? "Create session" : "Book room"}
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
