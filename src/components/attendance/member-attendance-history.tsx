"use client";

import { useState, useEffect } from "react";
import { formatDate, formatTime } from "@/lib/utils";

type HistoryItem = {
  date: string;
  class_name: string;
  start_time: string;
  type: "booked" | "drop_in";
  credit_deducted: boolean;
};

type MemberAttendanceData = {
  member: {
    id: string;
    name: string;
    plan_type: string;
    credits: number;
    total_attendances: number;
  };
  history: HistoryItem[];
};

const PAGE_SIZE = 10;

export default function MemberAttendanceHistory({ memberId }: { memberId: string }) {
  const [data, setData] = useState<MemberAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch(`/api/attendance/member/${memberId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [memberId]);

  if (loading) {
    return (
      <div className="card py-8 text-center text-sm text-gray-500">
        Loading attendance history...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card py-8 text-center text-sm text-red-600">
        Failed to load attendance history
      </div>
    );
  }

  const { member, history } = data;
  const visible = history.slice(0, shown);
  const hasMore = history.length > shown;

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-500">
        Attendance History
      </h3>
      <p className="mt-2 text-sm text-gray-700">
        {member.total_attendances} total classes attended
      </p>
      {history.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((h, i) => (
                  <tr key={`${h.date}-${h.class_name}-${i}`} className="border-b border-gray-100">
                    <td className="py-3 text-sm text-gray-900">
                      {formatDate(h.date)}
                    </td>
                    <td className="py-3 text-sm text-gray-900">
                      {h.class_name}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {formatTime(h.start_time)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.type === "booked"
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {h.type === "booked" ? "Booked" : "Drop-in"}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {h.credit_deducted ? "Deducted" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setShown((s) => s + PAGE_SIZE)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800"
            >
              Show more
            </button>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          No attendance history yet.
        </p>
      )}
    </div>
  );
}
