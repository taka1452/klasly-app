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

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.checked;
    setLoading(true);
    setChecked(newValue);

    const supabase = createClient();
    const { error } = await supabase
      .from("bookings")
      .update({ attended: newValue })
      .eq("id", bookingId);

    if (error) {
      setChecked(!newValue);
      alert("Failed to update: " + error.message);
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={handleChange}
      disabled={loading}
      className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
    />
  );
}
