"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type RoomOption = { id: string; name: string; capacity: number | null };

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function InstructorNewClassPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [capacity, setCapacity] = useState(15);
  const [roomId, setRoomId] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [priceDollars, setPriceDollars] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchRooms() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("studio_id")
        .eq("id", user?.id)
        .single();
      if (!profile?.studio_id) return;
      const { data } = await supabase
        .from("rooms")
        .select("id, name, capacity")
        .eq("studio_id", profile.studio_id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      setRooms(data || []);
    }
    fetchRooms();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const priceCents =
      priceDollars.trim() !== ""
        ? Math.round(parseFloat(priceDollars) * 100)
        : null;

    if (priceCents !== null && (isNaN(priceCents) || priceCents < 0)) {
      setError("Please enter a valid price.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/instructor/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          day_of_week: dayOfWeek,
          start_time: startTime,
          duration_minutes: durationMinutes,
          capacity,
          room_id: roomId || null,
          is_public: isPublic,
          price_cents: priceCents,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create class");
        setLoading(false);
        return;
      }

      router.push("/instructor/classes");
      router.refresh();
    } catch {
      setError("Failed to create class");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/instructor/classes"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to my classes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Create a class
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up your class details and pricing. Students will be able to book
          and pay directly.
        </p>
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
              Class name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Morning Vinyasa Flow"
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="A dynamic morning flow to energize your day. All levels welcome."
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Price (USD) *
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <input
                type="number"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="20.00"
                min="0"
                step="0.01"
                required
                className="input-field pl-7"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Students pay this amount per class. Studio fees are deducted
              automatically.
            </p>
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
              Room
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="input-field mt-1"
            >
              <option value="">No room assigned</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity ? ` (cap. ${r.capacity})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublicClass"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600"
            />
            <label
              htmlFor="isPublicClass"
              className="text-sm font-medium text-gray-700"
            >
              Public{" "}
              <span className="font-normal text-gray-500">
                (visible to students on the schedule)
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Creating..." : "Create class"}
            </button>
            <Link href="/instructor/classes" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
