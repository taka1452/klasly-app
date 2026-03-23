"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ErrorAlert from "@/components/ui/error-alert";

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

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);

    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("rooms")
      .update({
        name,
        description: description || null,
        capacity: capacity !== "" ? capacity : null,
        is_active: isActive,
      })
      .eq("id", roomId)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    if (!updated || updated.length === 0) {
      setError("Could not save changes. You may not have permission to edit this room.");
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/rooms?id=${roomId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to delete room");
        setShowDeleteConfirm(false);
        setDeleting(false);
        return;
      }

      router.push("/rooms/manage");
      router.refresh();
    } catch {
      setError("Failed to delete room");
      setShowDeleteConfirm(false);
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Edit room</h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {error && (
            <ErrorAlert error={error} onDismiss={() => setError("")} />
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

      {/* Delete section */}
      <div className="card mt-6 border-red-200">
        <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
        <p className="mt-1 text-sm text-gray-500">
          Permanently delete this room. Sessions using this room will need to be reassigned.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="btn-danger mt-3"
        >
          Delete room
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={`Delete "${initialData.name}"?`}
        description="This will permanently remove this room. Future sessions assigned to this room will need to be reassigned first."
        warning="This action cannot be undone."
        confirmLabel="Delete room"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
