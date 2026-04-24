"use client";

import { useState } from "react";
import RoomTimeline from "@/components/dashboard/room-timeline";
import InstructorRoomCalendar from "@/components/instructor/room-calendar";
import AdminRoomBookingModal from "@/components/dashboard/admin-room-booking-modal";

type Room = { id: string; name: string; capacity: number | null };
type Instructor = { id: string; fullName: string; email: string };

type Props = {
  isAlsoInstructor: boolean;
  rooms: Room[];
  instructors: Instructor[];
};

export default function RoomsPageClient({
  isAlsoInstructor,
  rooms,
  instructors,
}: Props) {
  const [activeTab, setActiveTab] = useState<"usage" | "book">("usage");
  const [showAdminBooking, setShowAdminBooking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const adminBookingButton = (
    <button
      type="button"
      onClick={() => setShowAdminBooking(true)}
      className="btn-primary"
      disabled={rooms.length === 0 || instructors.length === 0}
      title={
        rooms.length === 0
          ? "Add a room first in Manage Rooms"
          : instructors.length === 0
            ? "Invite an instructor first"
            : "Book a room on behalf of an instructor"
      }
    >
      + Add booking
    </button>
  );

  return (
    <div>
      {/* Admin booking action — visible to all users who can reach this page
          (already gated by can_manage_rooms in page.tsx). */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Book a room for an instructor directly — e.g. for a private session, workshop prep, or a guest teacher&apos;s hold.
        </p>
        {adminBookingButton}
      </div>

      {isAlsoInstructor ? (
        <>
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
              Book Room (as instructor)
            </button>
          </div>

          {activeTab === "usage" ? (
            <RoomTimeline key={refreshKey} />
          ) : (
            <InstructorRoomCalendar />
          )}
        </>
      ) : (
        <RoomTimeline key={refreshKey} />
      )}

      {showAdminBooking && (
        <AdminRoomBookingModal
          rooms={rooms}
          instructors={instructors}
          onClose={() => setShowAdminBooking(false)}
          onCreated={() => {
            setShowAdminBooking(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
