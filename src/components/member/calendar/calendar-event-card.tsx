"use client";

import { useState, useRef, useEffect } from "react";
import { formatDuration } from "@/lib/utils";
import BookingButton from "@/components/bookings/booking-button";
import InstructorProfileModal from "@/components/member/instructor-profile-modal";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import {
  type SessionData,
  formatTimeShort,
  parseTime,
  HOUR_HEIGHT,
  timeToPosition,
  durationToHeight,
} from "./calendar-utils";

type Props = {
  session: SessionData;
  booking: { id: string; status: string } | null;
  confirmedCount: number;
  gridStartHour: number;
  // Overlap layout
  colIndex: number;
  totalCols: number;
  // BookingButton props
  memberId: string | null;
  memberCredits: number;
  canBook: boolean;
  requiresCredits: boolean;
  payPerClass: boolean;
  classPrice?: number;
  passInfo?: { hasPass: boolean; hasCapacity: boolean; classesUsed: number; maxClasses: number | null };
  onBookingComplete: () => void;
};

export default function CalendarEventCard({
  session,
  booking,
  confirmedCount,
  gridStartHour,
  colIndex,
  totalCols,
  memberId,
  memberCredits,
  canBook,
  requiresCredits,
  payPerClass,
  classPrice,
  passInfo,
  onBookingComplete,
}: Props) {
  const { isEnabled } = useFeature();
  const onlineEnabled = isEnabled(FEATURE_KEYS.ONLINE_CLASSES);
  const showOnline = onlineEnabled && session.is_online;

  const [showPopover, setShowPopover] = useState(false);
  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const top = timeToPosition(session.start_time, gridStartHour);
  const height = Math.max(durationToHeight(session.duration_minutes), 24);

  // Overlap positioning
  const widthPercent = totalCols > 1 ? 100 / totalCols : 100;
  const leftPercent = totalCols > 1 ? colIndex * widthPercent : 0;

  // Color based on booking status
  let bgColor = "bg-brand-50 border-l-[3px] border-brand-500";
  let textColor = "text-brand-900";
  if (booking?.status === "confirmed") {
    bgColor = "bg-green-50 border-l-[3px] border-green-500";
    textColor = "text-green-900";
  } else if (booking?.status === "waitlist") {
    bgColor = "bg-amber-50 border-l-[3px] border-amber-500";
    textColor = "text-amber-900";
  } else if (booking?.status === "cancelled") {
    bgColor = "bg-gray-50 border-l-[3px] border-gray-300";
    textColor = "text-gray-500";
  }

  const { hours, minutes } = parseTime(session.start_time);
  const endMin = hours * 60 + minutes + session.duration_minutes;
  const endH = Math.floor(endMin / 60) % 12 || 12;
  const endM = endMin % 60;
  const endAmpm = Math.floor(endMin / 60) < 12 ? "AM" : "PM";
  const endTimeStr = `${endH}${endM > 0 ? `:${String(endM).padStart(2, "0")}` : ""} ${endAmpm}`;

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        cardRef.current &&
        !cardRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover]);

  const isCompact = height < 40;

  return (
    <>
      <div
        ref={cardRef}
        className={`absolute cursor-pointer rounded-md px-1.5 py-0.5 text-xs leading-tight transition-shadow hover:shadow-md ${bgColor} ${textColor}`}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${leftPercent}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
          overflow: "hidden",
          zIndex: showPopover ? 20 : 10,
        }}
        onClick={() => setShowPopover(!showPopover)}
      >
        {isCompact ? (
          <span className="truncate font-medium">
            {showOnline && <span title="Online">📹 </span>}
            {session.class_name}
          </span>
        ) : (
          <>
            <div className="truncate font-medium">
              {showOnline && <span title="Online">📹 </span>}
              {session.class_name}
            </div>
            <div className="truncate opacity-75">
              {formatTimeShort(session.start_time)}
              {session.instructor_name ? ` · ${session.instructor_name}` : ""}
            </div>
            {height >= 55 && (
              <div className="truncate opacity-60">
                {confirmedCount}/{session.capacity} booked
              </div>
            )}
          </>
        )}
      </div>

      {/* Popover / Detail panel */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border border-gray-200 bg-white p-5 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:max-w-sm"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowPopover(false)}
            className="absolute right-3 top-3 text-gray-500 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 className="text-lg font-semibold text-gray-900 pr-6">
            {showOnline && <span title="Online">📹 </span>}
            {session.class_name}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>
              {formatTimeShort(session.start_time)} – {endTimeStr} ({formatDuration(session.duration_minutes)})
            </p>
            {session.instructor_name && (
              <p>
                Instructor:{" "}
                {session.instructor_id ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInstructorModal(true);
                    }}
                    className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    {session.instructor_name}
                  </button>
                ) : (
                  session.instructor_name
                )}
              </p>
            )}
            {showOnline ? (
              session.online_link ? (
                <a
                  href={session.online_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium"
                >
                  Join Online →
                </a>
              ) : (
                <p className="text-gray-500">Online class (book to get the link)</p>
              )
            ) : (session.room_name || session.location) ? (
              <p>{session.room_name || session.location}</p>
            ) : null}
            {payPerClass && (session.price_cents ?? classPrice) != null && (
              <p className="font-medium text-gray-900">
                ${(((session.price_cents ?? classPrice)!) / 100).toFixed(2)}
              </p>
            )}
            <p>
              {confirmedCount}/{session.capacity} booked
              {confirmedCount >= session.capacity && (
                <span className="ml-1 text-amber-600">(Full)</span>
              )}
            </p>
          </div>

          <div className="mt-4">
            <BookingButton
              sessionId={session.id}
              capacity={session.capacity}
              memberId={memberId}
              existingBooking={booking}
              memberCredits={memberCredits}
              confirmedCount={confirmedCount}
              canBook={canBook}
              requiresCredits={requiresCredits}
              payPerClass={payPerClass}
              classPrice={session.price_cents ?? classPrice}
              passInfo={passInfo}
              onSuccess={() => {
                onBookingComplete();
                setShowPopover(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile backdrop */}
      {showPopover && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setShowPopover(false)}
        />
      )}

      {/* Instructor profile modal */}
      {showInstructorModal && session.instructor_id && (
        <InstructorProfileModal
          instructorId={session.instructor_id}
          onClose={() => setShowInstructorModal(false)}
        />
      )}
    </>
  );
}
