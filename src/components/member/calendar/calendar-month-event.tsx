"use client";

import { formatTimeShort } from "./calendar-utils";

type Props = {
  eventName: string;
  startTime: string;
  bookingStatus: string | null;
};

export default function CalendarMonthEvent({
  eventName,
  startTime,
  bookingStatus,
}: Props) {
  let bg = "bg-brand-100 text-brand-800";
  if (bookingStatus === "confirmed") {
    bg = "bg-green-100 text-green-800";
  } else if (bookingStatus === "waitlist") {
    bg = "bg-amber-100 text-amber-800";
  }

  return (
    <div
      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${bg}`}
    >
      <span className="font-medium">{formatTimeShort(startTime)}</span>{" "}
      {eventName}
    </div>
  );
}
