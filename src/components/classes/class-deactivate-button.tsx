"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ClassDeactivateButton({
  classId,
}: {
  classId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDeactivate() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("classes")
      .update({ is_active: false })
      .eq("id", classId);

    if (error) {
      alert("Failed to deactivate: " + error.message);
      setLoading(false);
      return;
    }

    router.push("/classes");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn-secondary mt-3 w-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        Deactivate class
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-amber-700">
        Deactivating hides the class from the schedule. You can re-activate it
        later by editing.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDeactivate}
          disabled={loading}
          className="btn-secondary flex-1 text-sm"
        >
          {loading ? "Deactivating..." : "Yes, deactivate"}
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
