"use client";

import Link from "next/link";

function getPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function toYYYYMM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

type Props = {
  year: number;
  month: number;
};

export default function BookingsMonthNav({ year, month }: Props) {
  const prev = getPrevMonth(year, month);
  const next = getNextMonth(year, month);
  const label = `${year}年${month}月`;

  return (
    <nav className="flex items-center gap-3">
      <Link
        href={`/bookings?month=${toYYYYMM(prev.year, prev.month)}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
        aria-label="前の月"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
      <span className="min-w-[7rem] text-center font-medium text-gray-900">
        {label}
      </span>
      <Link
        href={`/bookings?month=${toYYYYMM(next.year, next.month)}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
        aria-label="次の月"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </nav>
  );
}
