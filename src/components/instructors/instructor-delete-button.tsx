"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/toast";

export default function InstructorDeleteButton({
  instructorId,
}: {
  instructorId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/instructors/${instructorId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setToastMessage(data?.error ?? "Failed to delete instructor");
      setLoading(false);
      return;
    }

    router.push("/instructors");
    router.refresh();
  }

  if (!confirming) {
    return (
      <>
        <button
          onClick={() => setConfirming(true)}
          className="btn-danger mt-3 w-full text-sm"
        >
          Delete instructor
        </button>
        {toastMessage && (
          <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
        )}
      </>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-red-600">
        Are you sure? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="btn-danger flex-1 text-sm"
        >
          {loading ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="btn-secondary flex-1 text-sm"
        >
          Cancel
        </button>
      </div>
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
