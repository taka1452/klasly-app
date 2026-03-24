"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function FirstClassPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Create class template
      const templateRes = await fetch("/api/class-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          class_type: "in_person",
          duration_minutes: calcDuration(startTime, endTime),
          capacity: 20,
          is_public: true,
        }),
      });

      if (!templateRes.ok) {
        const data = await templateRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create class");
      }

      const template = await templateRes.json();

      // 2. Create a recurring schedule for this template
      const scheduleRes = await fetch(
        `/api/class-templates/${template.id}/schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day_of_week: DAYS.indexOf(day),
            start_time: startTime,
            end_time: endTime,
          }),
        }
      );

      if (!scheduleRes.ok) {
        // Template created but schedule failed — still continue
        console.error("Schedule creation failed, continuing anyway");
      }

      router.push("/onboarding/complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  function handleSkip() {
    router.push("/onboarding/complete");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-700">Klasly</h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Create your first class
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Add a class so your schedule isn&apos;t empty when you arrive.
          </p>
        </div>

        <div className="card mt-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="className"
                className="block text-sm font-medium text-gray-700"
              >
                Class name
              </label>
              <input
                id="className"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Morning Yoga"
                required
                autoFocus
                className="input-field mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="day"
                className="block text-sm font-medium text-gray-700"
              >
                Day
              </label>
              <select
                id="day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="input-field mt-1"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-gray-700"
                >
                  Start time
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-field mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-gray-700"
                >
                  End time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-field mt-1"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-primary w-full"
            >
              {loading ? "Creating..." : "Create class & continue"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleSkip}
            className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Skip — I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 60;
}
