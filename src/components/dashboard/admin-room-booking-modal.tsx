"use client";

import { useState } from "react";

type Room = { id: string; name: string; capacity: number | null };
type Instructor = { id: string; fullName: string; email: string };

type Props = {
  rooms: Room[];
  instructors: Instructor[];
  onClose: () => void;
  onCreated: () => void;
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminRoomBookingModal({
  rooms,
  instructors,
  onClose,
  onCreated,
}: Props) {
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [instructorId, setInstructorId] = useState(instructors[0]?.id || "");
  const [title, setTitle] = useState("");
  const [bookingDate, setBookingDate] = useState(todayLocal());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isPublic, setIsPublic] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/rooms/admin-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: roomId,
        instructor_id: instructorId,
        title: title.trim(),
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        is_public: isPublic,
        notes: notes.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create booking");
      return;
    }

    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add room booking</h2>
            <p className="mt-1 text-xs text-gray-500">
              Book a room on behalf of an instructor (private session, workshop prep, guest teacher).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Instructor
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              required
              className="input-field w-full"
            >
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.fullName} {i.email ? `(${i.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Room
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="input-field w-full"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity ? ` (capacity ${r.capacity})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Private session with Jessica"
              className="input-field w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date
              </label>
              <input
                type="date"
                value={bookingDate}
                min={todayLocal()}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Visible to the instructor on their calendar."
              className="input-field w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Show on the public calendar
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Booking..." : "Create booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
