"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function MemberDeleteButton({
  memberId,
}: {
  memberId: string;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      setError("Failed to delete member: " + deleteError.message);
      setLoading(false);
      return;
    }

    router.push("/members");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-danger mt-3 w-full text-sm"
      >
        Delete member
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete member"
        description="Are you sure you want to delete this member? This action cannot be undone."
        warning="All booking history for this member will be permanently removed."
        confirmLabel="Yes, delete"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
