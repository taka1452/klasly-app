"use client";

import { useWidgetTheme } from "./widget-theme-provider";

type SessionData = {
  id: string;
  date: string;
  startTime: string;
  className: string;
  instructorName: string;
  durationMinutes: number;
  capacity: number;
  confirmedCount: number;
  location: string | null;
  isOnline?: boolean;
};

type Props = {
  session: SessionData;
  booking: { id: string; status: string } | null;
  onBook: (sessionId: string) => void;
  onCancel: (sessionId: string) => void;
  onLeaveWaitlist: (sessionId: string) => void;
  onRebook: (sessionId: string) => void;
  isLoggedIn: boolean;
  memberCredits: number;
  loading: boolean;
};

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export default function WidgetSessionCard({
  session,
  booking,
  onBook,
  onCancel,
  onLeaveWaitlist,
  onRebook,
  isLoggedIn,
  memberCredits,
  loading,
}: Props) {
  const theme = useWidgetTheme();
  const spotsLeft = session.capacity - session.confirmedCount;
  const isFull = spotsLeft <= 0;

  function renderButton() {
    // Not logged in: no button on individual cards (sign-in is in footer)
    if (!isLoggedIn) return null;

    if (booking) {
      if (booking.status === "confirmed") {
        return (
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: theme.primary }}>
              Booked
            </span>
            <button
              type="button"
              onClick={() => onCancel(session.id)}
              disabled={loading}
              className="text-[10px] text-gray-400 underline hover:text-red-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        );
      }
      if (booking.status === "waitlist") {
        return (
          <button
            type="button"
            onClick={() => onLeaveWaitlist(session.id)}
            disabled={loading}
            className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Leave waitlist
          </button>
        );
      }
      if (booking.status === "cancelled") {
        return (
          <button
            type="button"
            onClick={() => onRebook(session.id)}
            disabled={loading || (memberCredits === 0 && !isFull)}
            className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: theme.primary }}
          >
            Re-book
          </button>
        );
      }
    }

    // No existing booking
    if (memberCredits === 0 && !isFull) {
      return (
        <span className="text-[10px] text-amber-600">No credits</span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onBook(session.id)}
        disabled={loading}
        className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
        style={{
          backgroundColor: isFull ? "#6b7280" : theme.primary,
        }}
      >
        {isFull ? "Waitlist" : "Book"}
      </button>
    );
  }

  // Spot badge
  let spotColor = "text-gray-400";
  if (isFull) {
    spotColor = "text-red-500";
  } else if (spotsLeft <= 3) {
    spotColor = "text-orange-500";
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-2.5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-gray-900">
            {session.isOnline && <span title="Online">📹 </span>}
            {session.className}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {formatTime(session.startTime)}
            {session.durationMinutes > 0 && ` · ${session.durationMinutes}min`}
          </p>
          {session.instructorName && (
            <p className="mt-0.5 text-[10px] text-gray-400">{session.instructorName}</p>
          )}
        </div>
        <div className="shrink-0">{renderButton()}</div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-[10px] font-medium ${spotColor}`}>
          {isFull ? "Full" : `${spotsLeft} spots left`}
        </span>
        {session.location && (
          <span className="text-[10px] text-gray-300">{session.location}</span>
        )}
      </div>
    </div>
  );
}
