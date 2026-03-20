"use client";

import { useRouter } from "next/navigation";
import {
  type SessionData,
  formatTimeShort,
  parseTime,
  HOUR_HEIGHT,
  timeToPosition,
  durationToHeight,
} from "@/components/member/calendar/calendar-utils";

export type DashboardSessionData = SessionData & {
  class_id: string;
  is_public: boolean;
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

  // Color based on state
  let bgColor = "bg-brand-50 border-l-[3px] border-brand-500";
  let textColor = "text-brand-900";
  if (session.is_cancelled) {
    bgColor = "bg-gray-50 border-l-[3px] border-gray-300";
    textColor = "text-gray-500";
  } else if (!session.is_public) {
    bgColor = "bg-violet-50 border-l-[3px] border-violet-500";
    textColor = "text-violet-900";
  } else if (confirmedCount >= session.capacity) {
    bgColor = "bg-amber-50 border-l-[3px] border-amber-500";
    textColor = "text-amber-900";
  }

  const isCompact = height < 40;

  function handleClick() {
    router.push(`/classes/${session.class_id}/sessions/${session.id}`);
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
          {session.is_cancelled && <span className="line-through">{session.class_name}</span>}
          {!session.is_cancelled && session.class_name}
        </span>
      ) : (
        <>
          <div className="truncate font-medium">
            {!session.is_public && (
              <span className="mr-1 inline-block rounded bg-violet-200 px-1 text-[9px] font-semibold uppercase text-violet-700">
                Private
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
          {height >= 55 && (
            <div className="truncate opacity-60">
              {confirmedCount}/{session.capacity} booked
            </div>
          )}
        </>
      )}
    </div>
  );
}
