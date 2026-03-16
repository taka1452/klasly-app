"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  initialIsPublic: boolean;
};

export default function SessionVisibilityToggle({
  sessionId,
  initialIsPublic,
}: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    const newValue = !isPublic;
    const { error } = await supabase
      .from("class_sessions")
      .update({ is_public: newValue })
      .eq("id", sessionId);

    if (!error) {
      setIsPublic(newValue);
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isPublic
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {isPublic ? "Public" : "Private"}
      <span className="text-[10px] text-gray-400">
        {loading ? "..." : "(click to toggle)"}
      </span>
    </button>
  );
}
