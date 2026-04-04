import Link from "next/link";
import RoomBookingQuota from "@/components/instructor/room-booking-quota";
import InstructorRoomCalendar from "@/components/instructor/room-calendar";

export default function InstructorRoomBookingsPage() {
  return (
    <div>
      <div>
        <Link
          href="/instructor/schedule"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to schedule
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Room Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tap an empty slot to book a room
        </p>
      </div>

      <div className="mt-4">
        <RoomBookingQuota />
      </div>

      <div className="mt-6">
        <InstructorRoomCalendar />
      </div>
    </div>
  );
}
