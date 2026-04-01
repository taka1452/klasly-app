"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";

type SessionItem = {
  id: string;
  session_date: string;
  start_time: string;
  capacity: number;
  is_cancelled: boolean;
  is_online: boolean;
  class_name: string;
  session_type: string;
  room_name: string | null;
  instructor_name: string | null;
  confirmed: number;
  waitlist: number;
};

type Props = {
  sessions: SessionItem[];
  year: number;
  month: number;
};

type Tab = "all" | "class_room" | "room_only";
type StatusFilter = "all" | "confirmed" | "cancelled" | "waitlisted" | "dropin";

export default function BookingsClient({ sessions, year, month }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);

  const filtered = useMemo(() => {
    let result = sessions;

    // Tab filter
    if (activeTab === "class_room") {
      result = result.filter((s) => s.session_type !== "room_only");
    } else if (activeTab === "room_only") {
      result = result.filter((s) => s.session_type === "room_only");
    }

    // Status filter
    if (statusFilter === "cancelled") {
      result = result.filter((s) => s.is_cancelled);
    } else if (statusFilter === "confirmed") {
      result = result.filter((s) => !s.is_cancelled && s.confirmed > 0);
    } else if (statusFilter === "waitlisted") {
      result = result.filter((s) => s.waitlist > 0);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.class_name.toLowerCase().includes(q) ||
          (s.instructor_name && s.instructor_name.toLowerCase().includes(q)) ||
          (s.room_name && s.room_name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [sessions, activeTab, statusFilter, searchQuery]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: sessions.length },
    {
      key: "class_room",
      label: "Class + Room",
      count: sessions.filter((s) => s.session_type !== "room_only").length,
    },
    {
      key: "room_only",
      label: "Room Only",
      count: sessions.filter((s) => s.session_type === "room_only").length,
    },
  ];

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "waitlisted", label: "Waitlisted" },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
            <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-brand-100 text-brand-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search class, instructor, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="mt-4">
        {filtered.length > 0 ? (
          <div className="card divide-y divide-gray-200 overflow-hidden p-0">
            {filtered.map((session) => (
              <div
                key={session.id}
                className="block cursor-pointer px-4 py-4 transition-colors hover:bg-gray-50 sm:px-6"
                onClick={() => setSelectedSession(session)}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {session.is_online && <span title="Online">📹 </span>}
                      {session.session_type === "room_only" && (
                        <span className="mr-1.5 inline-block rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700">
                          Room
                        </span>
                      )}
                      {session.class_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(session.session_date)} ·{" "}
                      {formatTime(session.start_time)}
                      {session.instructor_name && ` · ${session.instructor_name}`}
                      {session.room_name && ` · ${session.room_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        session.is_cancelled
                          ? "text-sm font-medium text-red-600"
                          : "text-sm text-gray-600"
                      }
                    >
                      {session.is_cancelled
                        ? "Cancelled"
                        : `${session.confirmed}/${session.capacity}`}
                    </span>
                    {session.waitlist > 0 && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        +{session.waitlist} waitlist
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-12 text-center">
            <p className="text-gray-500">No bookings match your filters.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedSession(null)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="absolute right-4 top-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedSession.class_name}
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{formatDate(selectedSession.session_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">{formatTime(selectedSession.start_time)}</span>
              </div>
              {selectedSession.instructor_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Instructor</span>
                  <span className="font-medium">{selectedSession.instructor_name}</span>
                </div>
              )}
              {selectedSession.room_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Room</span>
                  <span className="font-medium">{selectedSession.room_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium">
                  {selectedSession.session_type === "room_only" ? "Room Only" : "Class + Room"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bookings</span>
                <span className="font-medium">
                  {selectedSession.confirmed}/{selectedSession.capacity} confirmed
                  {selectedSession.waitlist > 0 && `, ${selectedSession.waitlist} waitlisted`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${selectedSession.is_cancelled ? "text-red-600" : "text-green-600"}`}>
                  {selectedSession.is_cancelled ? "Cancelled" : "Active"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href={`/bookings/${selectedSession.id}`}
                className="btn-primary flex-1 text-center"
              >
                View Details
              </Link>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
