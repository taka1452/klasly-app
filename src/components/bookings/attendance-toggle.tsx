"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AttendanceToggle({
  bookingId,
  attended,
}: {
  bookingId: string;
  attended: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(attended);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.checked;
    setLoading(true);
    setChecked(newValue);
    setError("");
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ attended: newValue })
      .eq("id", bookingId);

    if (updateError) {
      setChecked(!newValue);
      setError("Failed");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={loading}
        className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
      {saved && <span className="text-xs text-green-600">✓</span>}
    </div>
  );
}
