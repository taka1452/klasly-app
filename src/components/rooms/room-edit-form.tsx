"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  roomId: string;
  initialData: {
    name: string;
    description: string;
    capacity: number | "";
    isActive: boolean;
  };
};

export default function RoomEditForm({ roomId, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description);
  const [capacity, setCapacity] = useState<number | "">(initialData.capacity);
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        name,
        description: description || null,
        capacity: capacity !== "" ? capacity : null,
        is_active: isActive,
      })
      .eq("id", roomId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Edit room</h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            Changes saved!
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
            rows={2}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Capacity
          </label>
          <input
            type="number"
            value={capacity}
            onChange={(e) =>
              setCapacity(e.target.value ? parseInt(e.target.value, 10) : "")
            }
            min={1}
            className="input-field mt-1"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
            Active (visible for class assignment)
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
