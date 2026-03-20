"use client";

import { useRouter } from "next/navigation";
import {
  type SessionData,
  formatTimeShort,
  timeToPosition,
  durationToHeight,
} from "@/components/member/calendar/calendar-utils";

export type DashboardSessionData = SessionData & {
  class_id: string;
  is_public: boolean;
  event_type?: "class" | "room_booking";
};

type Props = {
  session: DashboardSessionData;
  confirmedCount: number;
  gridStartHour: number;
  colIndex: number;
  totalCols: number;
};

export default function DashboardEventCard({
  session,
  confirmedCount,
  gridStartHour,
  colIndex,
  totalCols,
}: Props) {
  const router = useRouter();

  const top = timeToPosition(session.start_time, gridStartHour);
  const height = Math.max(durationToHeight(session.duration_minutes), 24);

  // Overlap positioning
  const widthPercent = totalCols > 1 ? 100 / totalCols : 100;
  const leftPercent = totalCols > 1 ? colIndex * widthPercent : 0;

  const isRoomBooking = session.event_type === "room_booking";
  const isOnline = session.is_online;

  // Color based on state
  let bgColor: string;
  let textColor: string;

  if (isRoomBooking) {
    // Room bookings: teal
    bgColor = "bg-teal-50 border-l-[3px] border-teal-500";
    textColor = "text-teal-900";
  } else if (session.is_cancelled) {
    bgColor = "bg-gray-50 border-l-[3px] border-gray-300";
    textColor = "text-gray-500";
  } else if (!session.is_public) {
    bgColor = "bg-violet-50 border-l-[3px] border-violet-500";
    textColor = "text-violet-900";
  } else if (confirmedCount >= session.capacity) {
    bgColor = "bg-amber-50 border-l-[3px] border-amber-500";
    textColor = "text-amber-900";
  } else {
    bgColor = "bg-brand-50 border-l-[3px] border-brand-500";
    textColor = "text-brand-900";
  }

  const isCompact = height < 40;

  function handleClick() {
    if (isRoomBooking) {
      // Room bookings navigate to the rooms bookings list
      router.push("/rooms");
    } else {
      router.push(`/calendar/${session.class_id}/sessions/${session.id}`);
    }
  }

  return (
    <div
      className={`absolute cursor-pointer rounded-md px-1.5 py-0.5 text-xs leading-tight transition-shadow hover:shadow-md ${bgColor} ${textColor}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        overflow: "hidden",
        zIndex: 10,
      }}
      onClick={handleClick}
    >
      {isCompact ? (
        <span className="truncate font-medium">
          {isRoomBooking && (
            <span className="mr-1 inline-block rounded bg-teal-200 px-1 text-[9px] font-semibold uppercase text-teal-700">
              Room
            </span>
          )}
          {!isRoomBooking && isOnline && (
            <span className="mr-0.5" title="Online class">
              {"\uD83D\uDCF9"}
            </span>
          )}
          {session.is_cancelled && <span className="line-through">{session.class_name}</span>}
          {!session.is_cancelled && session.class_name}
        </span>
      ) : (
        <>
          <div className="truncate font-medium">
            {isRoomBooking && (
              <span className="mr-1 inline-block rounded bg-teal-200 px-1 text-[9px] font-semibold uppercase text-teal-700">
                Room
              </span>
            )}
            {!isRoomBooking && !session.is_public && (
              <span className="mr-1 inline-block rounded bg-violet-200 px-1 text-[9px] font-semibold uppercase text-violet-700">
                Private
              </span>
            )}
            {!isRoomBooking && isOnline && (
              <span className="mr-0.5" title="Online class">
                {"\uD83D\uDCF9"}
              </span>
            )}
            {session.is_cancelled ? (
              <span className="line-through">{session.class_name}</span>
            ) : (
              session.class_name
            )}
          </div>
          <div className="truncate opacity-75">
            {formatTimeShort(session.start_time)}
            {session.instructor_name ? ` · ${session.instructor_name}` : ""}
          </div>
          {height >= 55 && !isRoomBooking && (
            <div className="truncate opacity-60">
              {confirmedCount}/{session.capacity} booked
              {session.room_name && (
                <span className="ml-1 inline-block rounded bg-teal-100 px-1 text-[9px] font-medium text-teal-700">
                  {session.room_name}
                </span>
              )}
            </div>
          )}
          {height >= 55 && isRoomBooking && session.room_name && (
            <div className="truncate opacity-60">
              <span className="inline-block rounded bg-teal-100 px-1 text-[9px] font-medium text-teal-700">
                {session.room_name}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
