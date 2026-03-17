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

  // Determine spot badge style
  let spotBadgeClass = "bg-gray-100 text-gray-600";
  let spotText = `${spotsLeft} spots left`;
  if (isFull) {
    spotBadgeClass = "bg-red-100 text-red-700";
    spotText = "Full";
  } else if (spotsLeft <= 3) {
    spotBadgeClass = "bg-orange-100 text-orange-700";
    spotText = `${spotsLeft} left`;
  }

  function renderButton() {
    if (!isLoggedIn) {
      return (
        <button
          type="button"
          onClick={() => onBook(session.id)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: theme.primary }}
        >
          Sign in to book
        </button>
      );
    }

    if (booking) {
      if (booking.status === "confirmed") {
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-green-600">Booked</span>
            <button
              type="button"
              onClick={() => onCancel(session.id)}
              disabled={loading}
              className="text-xs text-gray-500 underline hover:text-red-600 disabled:opacity-50"
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
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
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
        <span className="text-xs text-amber-600">No credits</span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onBook(session.id)}
        disabled={loading}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        style={{
          backgroundColor: isFull ? "#6b7280" : theme.primary,
        }}
      >
        {isFull ? "Waitlist" : "Book"}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-gray-900">
            {session.isOnline && <span title="Online">📹 </span>}
            {session.className}
          </h4>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${spotBadgeClass}`}
          >
            {spotText}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatTime(session.startTime)}
          {session.durationMinutes > 0 && ` · ${session.durationMinutes}min`}
        </p>
        {session.instructorName && (
          <p className="text-xs text-gray-400">{session.instructorName}</p>
        )}
      </div>
      <div className="ml-3 shrink-0">{renderButton()}</div>
    </div>
  );
}
