"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MemberDeleteButton({
  memberId,
}: {
  memberId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", memberId);

    if (error) {
      alert("Failed to delete member: " + error.message);
      setLoading(false);
      return;
    }

    router.push("/members");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn-danger mt-3 w-full text-sm"
      >
        Delete member
      </button>
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
    </div>
  );
}
