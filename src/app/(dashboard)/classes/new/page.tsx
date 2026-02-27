"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePlanAccess } from "@/components/ui/plan-access-provider";

type InstructorOption = { id: string; full_name: string };

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function NewClassPage() {
  const router = useRouter();
  const planAccess = usePlanAccess();

  if (planAccess && !planAccess.canCreate) {
    return (
      <div className="card max-w-xl">
        <p className="text-gray-600">
          Your plan doesn&apos;t allow this action. Please update your payment
          to add new classes.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Go to Billing →
        </Link>
      </div>
    );
  }

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [capacity, setCapacity] = useState(15);
  const [location, setLocation] = useState("");
  const [instructorId, setInstructorId] = useState<string>("");
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchInstructors() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("studio_id")
        .eq("id", user?.id)
        .single();
      if (!profile?.studio_id) return;
      const { data } = await supabase
        .from("instructors")
        .select("id, profiles(full_name)")
        .eq("studio_id", profile.studio_id)
        .order("created_at", { ascending: false });
      const list = (data || []).map((i) => {
        const p = i.profiles as { full_name?: string } | null;
        const raw = Array.isArray(p) ? p[0] : p;
        return { id: i.id, full_name: raw?.full_name || "—" };
      });
      setInstructors(list);
    }
    fetchInstructors();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user!.id)
      .single();

    if (!profile?.studio_id) {
      setError("Studio not found. Please complete onboarding first.");
      setLoading(false);
      return;
    }

    // start_time: "HH:MM" -> "HH:MM:00" for PostgreSQL time
    const startTimeFormatted = startTime.includes(":")
      ? startTime.length === 5
        ? `${startTime}:00`
        : startTime
      : `${startTime}:00:00`;

    const { data: newClass, error: classError } = await supabase
      .from("classes")
      .insert({
        studio_id: profile.studio_id,
        instructor_id: instructorId || null,
        name,
        description: description || null,
        day_of_week: dayOfWeek,
        start_time: startTimeFormatted,
        duration_minutes: durationMinutes,
        capacity,
        location: location || null,
        is_active: true,
      })
      .select("id, start_time, capacity")
      .single();

    if (classError) {
      setError(classError.message);
      setLoading(false);
      return;
    }

    // 今後4週間分の class_sessions を生成
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDay = today.getDay();
    let daysUntilFirst = (dayOfWeek - currentDay + 7) % 7;
    const firstSessionDate = new Date(today);
    firstSessionDate.setDate(today.getDate() + daysUntilFirst);

    const sessionsToInsert = [];
    for (let i = 0; i < 4; i++) {
      const sessionDate = new Date(firstSessionDate);
      sessionDate.setDate(firstSessionDate.getDate() + i * 7);
      sessionsToInsert.push({
        studio_id: profile.studio_id,
        class_id: newClass.id,
        session_date: sessionDate.toISOString().split("T")[0],
        start_time: startTimeFormatted,
        capacity: newClass.capacity,
        is_cancelled: false,
      });
    }

    const { error: sessionsError } = await supabase
      .from("class_sessions")
      .insert(sessionsToInsert);

    if (sessionsError) {
      setError(`Class created but failed to create sessions: ${sessionsError.message}`);
      setLoading(false);
      return;
    }

    router.push("/classes");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/classes"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to classes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Add new class</h1>
      </div>

      <div className="card max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Instructor (optional)
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="input-field mt-1"
            >
              <option value="">No instructor</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Class name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Morning Yoga"
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="A relaxing start to your day..."
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Day of week *
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
              className="input-field mt-1"
            >
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Start time *
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="input-field mt-1"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Duration (minutes) *
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(parseInt(e.target.value, 10) || 60)
                }
                min={15}
                max={180}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 15)}
                min={1}
                className="input-field mt-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Location (optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Main studio"
              className="input-field mt-1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Creating..." : "Create class"}
            </button>
            <Link href="/classes" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
