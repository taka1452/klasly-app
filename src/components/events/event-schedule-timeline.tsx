"use client";

import { useState } from "react";

type ScheduleItem = {
  id: string;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  title: string;
  description: string | null;
};

type Props = {
  items: ScheduleItem[];
  startDate: string;
};

function formatTime(time: string | null): string {
  if (!time) return "";
  // time is HH:MM:SS format
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function EventScheduleTimeline({ items, startDate }: Props) {
  // Group by day
  const days = (items || []).reduce(
    (acc, item) => {
      const day = item.day_number;
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    },
    {} as Record<number, ScheduleItem[]>,
  );

  const dayNumbers = Object.keys(days)
    .map(Number)
    .sort((a, b) => a - b);

  const [openDay, setOpenDay] = useState<number>(dayNumbers[0] ?? 1);

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      {dayNumbers.map((dayNum) => {
        const dayItems = days[dayNum];
        const isOpen = openDay === dayNum;
        const dateLabel = addDays(startDate, dayNum - 1);

        return (
          <div key={dayNum} className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenDay(isOpen ? -1 : dayNum)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
            >
              <div>
                <span className="text-sm font-semibold text-gray-900">Day {dayNum}</span>
                <span className="ml-2 text-sm text-gray-500">{dateLabel}</span>
              </div>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="space-y-3">
                  {dayItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      {(item.start_time || item.end_time) && (
                        <div className="w-28 flex-shrink-0 text-sm text-gray-500">
                          {item.start_time && formatTime(item.start_time)}
                          {item.start_time && item.end_time && " – "}
                          {item.end_time && formatTime(item.end_time)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        {item.description && (
                          <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
