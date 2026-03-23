"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/toast";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function InstructorDeleteButton({
  instructorId,
}: {
  instructorId: string;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
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
      setShowConfirm(false);
      return;
    }

    router.push("/instructors");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-danger mt-3 w-full text-sm"
      >
        Delete instructor
      </button>
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete instructor"
        description="Are you sure you want to delete this instructor? This action cannot be undone."
        confirmLabel="Yes, delete"
        variant="danger"
        loading={loading}
      />
      {toastMessage && (
        <Toast message={toastMessage} variant="error" onClose={() => setToastMessage(null)} />
      )}
    </>
  );
}
