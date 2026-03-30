"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export default function NewRoomPage() {
  const router = useRouter();
  const { isEnabled } = useFeature();

  if (!isEnabled(FEATURE_KEYS.ROOM_MANAGEMENT)) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Room Management is not enabled for your studio.</p>
      </div>
    );
  }
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          capacity: capacity !== "" ? capacity : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create room");
        setLoading(false);
        return;
      }

      router.push("/rooms");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/rooms" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to rooms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Add new room</h1>
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
              Room name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main Studio"
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
              rows={2}
              placeholder="Large open space with mirrors..."
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Capacity (optional)
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) =>
                setCapacity(e.target.value ? parseInt(e.target.value, 10) : "")
              }
              min={1}
              placeholder="20"
              className="input-field mt-1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Creating..." : "Create room"}
            </button>
            <Link href="/rooms" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
