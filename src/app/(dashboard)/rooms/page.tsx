import Link from "next/link";
import type { Metadata } from "next";
import RoomTimeline from "@/components/dashboard/room-timeline";

export const metadata: Metadata = {
  title: "Rooms - Klasly",
};

export default function RoomsPage() {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="mt-1 text-sm text-gray-500">
            Room usage by day
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rooms/manage" className="btn-secondary">
            Manage Rooms
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <RoomTimeline />
      </div>
    </div>
  );
}
