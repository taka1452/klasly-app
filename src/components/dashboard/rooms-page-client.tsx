"use client";

import { useState } from "react";
import RoomTimeline from "@/components/dashboard/room-timeline";
import InstructorRoomCalendar from "@/components/instructor/room-calendar";

type Props = {
  isAlsoInstructor: boolean;
};

export default function RoomsPageClient({ isAlsoInstructor }: Props) {
  const [activeTab, setActiveTab] = useState<"usage" | "book">("usage");

  if (!isAlsoInstructor) {
    return <RoomTimeline />;
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("usage")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "usage"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Room Usage
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("book")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "book"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Book Room
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "usage" ? <RoomTimeline /> : <InstructorRoomCalendar />}
    </div>
  );
}
