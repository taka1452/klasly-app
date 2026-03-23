"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type UnreadAnnouncement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

export default function AnnouncementBanner() {
  const [unread, setUnread] = useState<UnreadAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/announcements/unread")
      .then((res) => res.json())
      .then((data) => {
        if (data.unread && data.unread.length > 0) {
          setUnread(data.unread);
        }
      })
      .catch((err) => console.warn("[Announcements] Failed to fetch unread:", err));
  }, []);

  if (dismissed || unread.length === 0) return null;

  const message =
    unread.length === 1
      ? unread[0].title
      : `${unread.length} new updates available!`;

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <span className="text-base">🆕</span>
          <span className="font-medium">{message}</span>
          <Link
            href="/announcements"
            className="ml-1 rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-200 transition-colors"
          >
            View Updates
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
