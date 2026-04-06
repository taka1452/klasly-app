"use client";

import { useEffect, useState } from "react";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";

type AttendanceRecord = {
  date: string;
  className: string;
  classId: string;
  time: string;
  type: "booking" | "drop_in";
};

type Summary = {
  total: number;
  monthlyBreakdown: { month: string; count: number }[];
  topClasses: { name: string; count: number }[];
};

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

export default function MyHistoryPage() {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    monthlyBreakdown: [],
    topClasses: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/member/attendance-history?months=6");
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
          setSummary(data.summary || { total: 0, monthlyBreakdown: [], topClasses: [] });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Attendance History
        </h1>
        <p className="mt-1 text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  // Group history by month
  const byMonth: Record<string, AttendanceRecord[]> = {};
  history.forEach((r) => {
    const month = r.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(r);
  });

  const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
        Attendance History
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Your class attendance over the last 6 months
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500">Total classes</p>
        </div>
        {summary.monthlyBreakdown.length > 0 && (
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">
              {summary.monthlyBreakdown[0].count}
            </p>
            <p className="text-xs text-gray-500">This month</p>
          </div>
        )}
        {summary.topClasses.length > 0 && (
          <div className="card text-center col-span-2 sm:col-span-1">
            <p className="truncate text-lg font-bold text-gray-900">
              {summary.topClasses[0].name}
            </p>
            <p className="text-xs text-gray-500">
              Most attended ({summary.topClasses[0].count}x)
            </p>
          </div>
        )}
      </div>

      {/* Monthly bar chart */}
      {summary.monthlyBreakdown.length > 1 && (
        <div className="card mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Monthly Trend
          </h2>
          <div className="flex items-end gap-2">
            {[...summary.monthlyBreakdown].reverse().map((m) => {
              const maxCount = Math.max(
                ...summary.monthlyBreakdown.map((mb) => mb.count),
              );
              const height = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-700">
                    {m.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${Math.max(height, 4)}px`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-gray-500">
                    {m.month.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top classes */}
      {summary.topClasses.length > 1 && (
        <div className="card mt-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Top Classes
          </h2>
          <div className="space-y-2">
            {summary.topClasses.map((cls) => (
              <div key={cls.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{cls.name}</span>
                <span className="text-sm font-medium text-gray-900">
                  {cls.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {sortedMonths.length > 0 ? (
        <div className="mt-6 space-y-6">
          {sortedMonths.map((month) => (
            <div key={month}>
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                {formatMonth(month)}{" "}
                <span className="font-normal text-gray-500">
                  ({byMonth[month].length} classes)
                </span>
              </h2>
              <div className="space-y-2">
                {byMonth[month].map((record, i) => (
                  <div
                    key={`${record.date}-${record.classId}-${i}`}
                    className="card flex items-center justify-between py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {record.className}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(record.date)}
                        {record.time && ` · ${formatTime(record.time)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {record.type === "drop_in" && (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Drop-in
                        </span>
                      )}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4 text-green-500"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card mt-6">
          <p className="text-sm text-gray-500">No attendance history yet.</p>
          <Link href="/schedule" className="btn-primary mt-4 inline-block">
            Book a class
          </Link>
        </div>
      )}
    </div>
  );
}
