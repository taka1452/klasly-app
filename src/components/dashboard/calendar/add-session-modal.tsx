"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, CalendarPlus, AlertTriangle } from "lucide-react";

type Template = {
  id: string;
  name: string;
  duration_minutes: number;
  capacity: number;
  instructor_id: string | null;
  instructor_name: string | null;
  room_id: string | null;
};

type Room = {
  id: string;
  name: string;
};

type Instructor = {
  id: string;
  name: string;
};

type RoomConflict = {
  title: string;
  start_time: string;
  end_time: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultTemplateId?: string;
  defaultDate?: string;
  defaultStartTime?: string;
};

export default function AddSessionModal({ open, onClose, onCreated, defaultTemplateId, defaultDate, defaultStartTime }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [templateId, setTemplateId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [roomId, setRoomId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [repeat, setRepeat] = useState<"single" | "weekly">("single");
  const [repeatEnd, setRepeatEnd] = useState<"weeks" | "never">("weeks");
  const [repeatWeeks, setRepeatWeeks] = useState(4);

  // Room conflict check state
  const [roomConflict, setRoomConflict] = useState<RoomConflict | null>(null);
  const [checkingRoom, setCheckingRoom] = useState(false);
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch templates, rooms, and instructors
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setSuccess("");

    Promise.all([
      fetch("/api/class-templates").then((r) =>
        r.ok ? r.json() : Promise.reject("Failed to load classes")
      ),
      fetch("/api/dashboard/rooms").then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/dashboard/instructors").then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([templatesData, roomsData, instructorsData]) => {
        const mapped: Template[] = (
          Array.isArray(templatesData) ? templatesData : []
        )
          .filter((t: Record<string, unknown>) => t.is_active)
          .map((t: Record<string, unknown>) => {
            const instr = t.instructors as {
              id?: string;
              profiles?: { full_name?: string } | { full_name?: string }[];
            } | null;
            let instrName: string | null = null;
            if (instr?.profiles) {
              const p = Array.isArray(instr.profiles)
                ? instr.profiles[0]
                : instr.profiles;
              instrName = p?.full_name || null;
            }
            return {
              id: t.id as string,
              name: t.name as string,
              duration_minutes: t.duration_minutes as number,
              capacity: t.capacity as number,
              instructor_id: (t.instructor_id as string) || null,
              instructor_name: instrName,
              room_id: (t.room_id as string) || null,
            };
          });
        setTemplates(mapped);

        const roomsList: Room[] = (
          Array.isArray(roomsData) ? roomsData : roomsData?.rooms || []
        ).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
        }));
        setRooms(roomsList);

        const instrList: Instructor[] = (
          Array.isArray(instructorsData) ? instructorsData : []
        ).map((i: Record<string, unknown>) => ({
          id: i.id as string,
          name: i.name as string,
        }));
        setInstructors(instrList);

        // Set default date
        setDate(defaultDate || new Date().toISOString().split("T")[0]);
        if (defaultStartTime) setStartTime(defaultStartTime);

        // If defaultTemplateId provided, pre-select it
        if (defaultTemplateId) {
          const tmpl = mapped.find((t) => t.id === defaultTemplateId);
          if (tmpl) {
            setTemplateId(tmpl.id);
            if (tmpl.instructor_id) setInstructorId(tmpl.instructor_id);
            if (tmpl.room_id) setRoomId(tmpl.room_id);
          }
        }
      })
      .catch(() => {
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [open, defaultTemplateId, defaultDate, defaultStartTime]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTemplateId("");
      setDate("");
      setStartTime("09:00");
      setRoomId("");
      setInstructorId("");
      setRepeat("single");
      setRepeatWeeks(4);
      setError("");
      setSuccess("");
      setRoomConflict(null);
      setCheckingRoom(false);
    }
  }, [open]);

  // When template changes, auto-set instructor and room
  function handleTemplateChange(newTemplateId: string) {
    setTemplateId(newTemplateId);
    const tmpl = templates.find((t) => t.id === newTemplateId);
    if (tmpl?.instructor_id) {
      setInstructorId(tmpl.instructor_id);
    } else {
      setInstructorId("");
    }
    if (tmpl?.room_id) {
      setRoomId(tmpl.room_id);
    } else {
      setRoomId("");
    }
  }

  // Room conflict check
  const checkRoomConflict = useCallback(async (
    checkRoomId: string,
    checkDate: string,
    checkStartTime: string,
    durationMinutes: number
  ) => {
    if (!checkRoomId || !checkDate || !checkStartTime || !durationMinutes) {
      setRoomConflict(null);
      return;
    }

    // Calculate end time
    const [h, m] = checkStartTime.split(":").map(Number);
    const totalMin = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    setCheckingRoom(true);
    try {
      const res = await fetch(`/api/instructor/room-availability?date=${checkDate}`);
      if (!res.ok) {
        setRoomConflict(null);
        return;
      }
      const data = await res.json();
      const events = data.events || [];

      // Check for overlapping events on this room
      const conflict = events.find((evt: { room_id: string; start_time: string; end_time: string; title: string }) => {
        if (evt.room_id !== checkRoomId) return false;
        const evtStart = evt.start_time.slice(0, 5);
        const evtEnd = evt.end_time.slice(0, 5);
        return evtStart < endTime && evtEnd > checkStartTime;
      });

      if (conflict) {
        setRoomConflict({
          title: conflict.title,
          start_time: conflict.start_time.slice(0, 5),
          end_time: conflict.end_time.slice(0, 5),
        });
      } else {
        setRoomConflict(null);
      }
    } catch {
      setRoomConflict(null);
    } finally {
      setCheckingRoom(false);
    }
  }, []);

  // Debounced conflict check when room/date/time changes
  useEffect(() => {
    if (conflictTimerRef.current) {
      clearTimeout(conflictTimerRef.current);
    }

    const tmpl = templates.find((t) => t.id === templateId);
    if (!roomId || !date || !startTime || !tmpl) {
      setRoomConflict(null);
      return;
    }

    conflictTimerRef.current = setTimeout(() => {
      checkRoomConflict(roomId, date, startTime, tmpl.duration_minutes);
    }, 500);

    return () => {
      if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    };
  }, [roomId, date, startTime, templateId, templates, checkRoomConflict]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const selectedInstructor = instructors.find((i) => i.id === instructorId);

  const endTimeDisplay = (() => {
    if (!selectedTemplate || !startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + selectedTemplate.duration_minutes;
    const endH = Math.floor(total / 60);
    const endM = total % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!templateId) {
      setError("Please select a class");
      return;
    }
    if (!date) {
      setError("Please select a date");
      return;
    }
    if (roomConflict) {
      setError("Cannot create session: room has a scheduling conflict");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          date,
          start_time: startTime,
          room_id: roomId || undefined,
          instructor_id: instructorId || undefined,
          repeat,
          repeat_weeks: repeat === "weekly" && repeatEnd === "weeks" ? repeatWeeks : undefined,
          repeat_never: repeat === "weekly" && repeatEnd === "never" ? true : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create session");
        return;
      }

      const count = data.created?.length || 1;
      const skippedCount = data.skipped?.length || 0;
      let msg = `${count} session${count > 1 ? "s" : ""} created!`;
      if (skippedCount > 0) {
        msg += ` (${skippedCount} skipped due to room conflicts)`;
      }
      setSuccess(msg);

      // Refresh calendar after a short delay
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 tap-target rounded text-gray-500 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100">
            <CalendarPlus className="h-5 w-5 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Add Session
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              No active classes found. Create a class first.
            </p>
            <a href="/classes/new" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
              Create a class →
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Template selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Select a class...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.instructor_name ? ` — ${t.instructor_name}` : ""}
                    {` (${t.duration_minutes}min)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Instructor selector */}
            {instructors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructor
                </label>
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">No instructor</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="input w-full"
                required
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTimeDisplay}
                  className="input w-full bg-gray-50"
                  disabled
                />
              </div>
            </div>

            {/* Room (optional) */}
            {rooms.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">No room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {/* Room conflict alert */}
                {checkingRoom && (
                  <p className="mt-1 text-xs text-gray-400">Checking availability...</p>
                )}
                {roomConflict && !checkingRoom && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <div className="text-sm text-red-700">
                      <p className="font-medium">Room not available</p>
                      <p className="text-red-600">
                        &ldquo;{roomConflict.title}&rdquo; is booked {roomConflict.start_time}–{roomConflict.end_time}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Repeat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repeat
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="repeat"
                    value="single"
                    checked={repeat === "single"}
                    onChange={() => setRepeat("single")}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  Single
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="repeat"
                    value="weekly"
                    checked={repeat === "weekly"}
                    onChange={() => setRepeat("weekly")}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  Weekly
                </label>
              </div>

              {repeat === "weekly" && (
                <div className="mt-3 space-y-3">
                  <label className="block text-xs font-medium text-gray-500">
                    Repeat ends
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="repeatEnd"
                        value="weeks"
                        checked={repeatEnd === "weeks"}
                        onChange={() => setRepeatEnd("weeks")}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <span>For</span>
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={repeatWeeks}
                        onChange={(e) =>
                          setRepeatWeeks(
                            Math.min(52, Math.max(1, parseInt(e.target.value) || 1))
                          )
                        }
                        disabled={repeatEnd !== "weeks"}
                        className="input w-16 text-center disabled:opacity-40"
                      />
                      <span>weeks</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="repeatEnd"
                        value="never"
                        checked={repeatEnd === "never"}
                        onChange={() => setRepeatEnd("never")}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      Never — keep generating indefinitely
                    </label>
                  </div>
                  {repeatEnd === "never" && (
                    <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Sessions will be auto-generated several weeks ahead on a rolling basis. You can stop anytime by setting an end date on the class template.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedTemplate && date && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {selectedTemplate.name}
                </span>
                {selectedInstructor && (
                  <span className="text-gray-500"> with {selectedInstructor.name}</span>
                )}
                {" — "}
                {startTime}
                {endTimeDisplay ? `–${endTimeDisplay}` : ""},{" "}
                {repeat === "weekly"
                  ? repeatEnd === "never"
                    ? `ongoing, starting ${date}`
                    : `${repeatWeeks} weeks starting ${date}`
                  : date}
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !templateId || !date || !!roomConflict}
                className="btn-primary disabled:opacity-50"
              >
                {submitting
                  ? "Creating..."
                  : repeat === "weekly"
                    ? repeatEnd === "never"
                      ? "Create Ongoing Sessions"
                      : `Create ${repeatWeeks} Sessions`
                    : "Create Session"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
