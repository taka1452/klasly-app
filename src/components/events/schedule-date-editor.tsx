"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScheduleDateEditor({
  bookingId,
  scheduleId,
  currentDate,
}: {
  bookingId: string;
  scheduleId: string;
  currentDate: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(currentDate);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (date === currentDate) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/events/bookings/${bookingId}/schedule/${scheduleId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ due_date: date }),
        },
      );
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } catch {
      // ignore
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        title="Click to change date"
      >
        {currentDate}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
        min={new Date().toISOString().slice(0, 10)}
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        onClick={() => {
          setDate(currentDate);
          setEditing(false);
        }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  );
}
