"use client";

import { useState, useEffect, useCallback } from "react";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { csrfFetch } from "@/lib/api/csrf-client";

type SlotData = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

const DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  0: "Sunday",
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function InstructorAvailabilityPage() {
  const { isEnabled } = useFeature();
  const appointmentsEnabled = isEnabled(FEATURE_KEYS.APPOINTMENTS);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await fetch("/api/instructor/availability");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSlots(data.availability ?? []);
    } catch {
      setMessage({ type: "error", text: "Failed to load availability." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appointmentsEnabled) {
      fetchAvailability();
    } else {
      setLoading(false);
    }
  }, [appointmentsEnabled, fetchAvailability]);

  const addSlot = (dayOfWeek: number) => {
    setSlots((prev) => [
      ...prev,
      { day_of_week: dayOfWeek, start_time: "09:00", end_time: "17:00", is_active: true },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: "start_time" | "end_time", value: string) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await csrfFetch("/api/instructor/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: slots.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      const data = await res.json();
      setSlots(data.availability ?? []);
      setMessage({ type: "success", text: "Availability saved successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  if (!appointmentsEnabled) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        <p className="mt-4 text-gray-500">
          The Appointments feature is not enabled for this studio. Please contact
          your studio owner to enable it.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        <div className="mt-6 flex items-center gap-2 text-gray-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set your weekly schedule for 1-on-1 appointments.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {DAY_ORDER.map((dayOfWeek) => {
          const daySlots = slots
            .map((s, idx) => ({ ...s, _idx: idx }))
            .filter((s) => s.day_of_week === dayOfWeek);

          return (
            <div key={dayOfWeek} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {DAY_LABELS[dayOfWeek]}
                </h3>
                <button
                  onClick={() => addSlot(dayOfWeek)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  + Add Slot
                </button>
              </div>

              {daySlots.length === 0 && (
                <p className="mt-2 text-sm text-gray-400">No availability set</p>
              )}

              <div className="mt-2 space-y-2">
                {daySlots.map((slot) => (
                  <div key={slot._idx} className="flex items-center gap-3">
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateSlot(slot._idx, "start_time", e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateSlot(slot._idx, "end_time", e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      onClick={() => removeSlot(slot._idx)}
                      className="tap-target rounded text-gray-500 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove slot"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
