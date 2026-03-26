"use client";

import { useEffect, useRef, useState } from "react";
import { X, CalendarPlus } from "lucide-react";

type Template = {
  id: string;
  name: string;
  duration_minutes: number;
  capacity: number;
  instructor_name: string | null;
};

type Room = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function AddSessionModal({ open, onClose, onCreated }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [templateId, setTemplateId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [roomId, setRoomId] = useState("");
  const [repeat, setRepeat] = useState<"single" | "weekly">("single");
  const [repeatWeeks, setRepeatWeeks] = useState(4);

  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch templates and rooms
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
    ])
      .then(([templatesData, roomsData]) => {
        const mapped: Template[] = (
          Array.isArray(templatesData) ? templatesData : []
        )
          .filter((t: Record<string, unknown>) => t.is_active)
          .map((t: Record<string, unknown>) => {
            const instr = t.instructors as {
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
              instructor_name: instrName,
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

        // Set default date to today
        const today = new Date().toISOString().split("T")[0];
        setDate(today);
      })
      .catch(() => {
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTemplateId("");
      setDate("");
      setStartTime("09:00");
      setRoomId("");
      setRepeat("single");
      setRepeatWeeks(4);
      setError("");
      setSuccess("");
    }
  }, [open]);

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
          repeat,
          repeat_weeks: repeat === "weekly" ? repeatWeeks : undefined,
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
        msg += ` (${skippedCount} skipped due to conflicts)`;
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
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                onChange={(e) => setTemplateId(e.target.value)}
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
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Number of weeks
                  </label>
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
                    className="input w-24"
                  />
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedTemplate && date && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {selectedTemplate.name}
                </span>{" "}
                — {startTime}
                {endTimeDisplay ? `–${endTimeDisplay}` : ""},{" "}
                {repeat === "weekly"
                  ? `${repeatWeeks} weeks starting ${date}`
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
                disabled={submitting || !templateId || !date}
                className="btn-primary disabled:opacity-50"
              >
                {submitting
                  ? "Creating..."
                  : repeat === "weekly"
                    ? `Create ${repeatWeeks} Sessions`
                    : "Create Session"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
