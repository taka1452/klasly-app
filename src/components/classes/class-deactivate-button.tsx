"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function ClassDeactivateButton({
  classId,
}: {
  classId: string;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDeactivate() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: deactivateError } = await supabase
      .from("classes")
      .update({ is_active: false })
      .eq("id", classId);

    if (deactivateError) {
      setError("Failed to deactivate: " + deactivateError.message);
      setLoading(false);
      return;
    }

    router.push("/calendar");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-secondary mt-3 w-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        Deactivate class
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDeactivate}
        title="Deactivate class"
        description="Deactivating hides the class from the schedule. You can re-activate it later by editing."
        confirmLabel="Yes, deactivate"
        variant="warning"
        loading={loading}
      />
    </>
  );
}
