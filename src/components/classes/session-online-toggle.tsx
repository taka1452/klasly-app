"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  initialIsOnline: boolean | null;
  initialOnlineLink: string | null;
  /** Class-level default link (shown as placeholder when session link is empty) */
  classOnlineLink?: string | null;
};

export default function SessionOnlineToggle({
  sessionId,
  initialIsOnline,
  initialOnlineLink,
  classOnlineLink,
}: Props) {
  const [isOnline, setIsOnline] = useState<boolean>(initialIsOnline ?? false);
  const [onlineLink, setOnlineLink] = useState(initialOnlineLink ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("class_sessions")
      .update({
        is_online: isOnline ? true : null, // NULL = inherit from class
        online_link: isOnline && onlineLink.trim() ? onlineLink.trim() : null,
      })
      .eq("id", sessionId);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={`sessionType-${sessionId}`}
            checked={!isOnline}
            onChange={() => setIsOnline(false)}
            className="text-brand-600"
          />
          In-person
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={`sessionType-${sessionId}`}
            checked={isOnline}
            onChange={() => setIsOnline(true)}
            className="text-brand-600"
          />
          Online
        </label>
      </div>

      {isOnline && (
        <div>
          <input
            type="url"
            value={onlineLink}
            onChange={(e) => setOnlineLink(e.target.value)}
            placeholder={classOnlineLink || "https://zoom.us/j/123456789"}
            className="input-field text-sm"
          />
          {!onlineLink.trim() && classOnlineLink && (
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to use the class default link.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-primary text-sm"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {saved && (
        <span className="ml-2 text-sm text-green-600">Saved!</span>
      )}
    </div>
  );
}
