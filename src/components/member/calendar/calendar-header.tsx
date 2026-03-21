"use client";

import { type CalendarView, formatHeaderLabel } from "./calendar-utils";

type Props = {
  currentDate: Date;
  view: CalendarView;
  isMobile: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
};

const viewOptions: { value: CalendarView; label: string; mobileOnly?: boolean }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function CalendarHeader({
  currentDate,
  view,
  isMobile,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: Props) {
  const label = formatHeaderLabel(view, currentDate);
  const filteredOptions = viewOptions;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
          aria-label="Previous"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
          aria-label="Next"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h2 className="ml-2 text-base font-semibold text-gray-900 sm:text-lg">
          {label}
        </h2>
      </div>

      {/* View toggle */}
      <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
        {filteredOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onViewChange(opt.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              view === opt.value
                ? "bg-brand-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
