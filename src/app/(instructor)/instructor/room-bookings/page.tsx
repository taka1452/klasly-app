import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import RoomBookingCancelButton from "@/components/instructor/room-booking-cancel-button";
import RoomBookingQuota from "@/components/instructor/room-booking-quota";

export default async function InstructorRoomBookingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data: bookings } = await supabase
    .from("instructor_room_bookings")
    .select("*, rooms(name)")
    .eq("instructor_id", instructor.id)
    .eq("status", "confirmed")
    .gte("booking_date", today)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Book studio rooms for your sessions
          </p>
        </div>
        <Link href="/instructor/room-bookings/new" className="btn-primary">
          + Book a room
        </Link>
      </div>

      <div className="mt-4">
        <RoomBookingQuota />
      </div>

      <div className="mt-6">
        {bookings && bookings.length > 0 ? (
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-gray-200">
              {bookings.map((b) => {
                const room = b.rooms as { name?: string } | null;
                const roomName = Array.isArray(room)
                  ? room[0]?.name
                  : room?.name || "—";

                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-gray-900">
                          {b.title}
                        </p>
                        {!b.is_public && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(b.booking_date)} · {formatTime(b.start_time)}{" "}
                        – {formatTime(b.end_time)}
                      </p>
                      <p className="text-xs text-gray-400">{roomName}</p>
                    </div>
                    <RoomBookingCancelButton bookingId={b.id} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card py-12 text-center">
            <p className="text-gray-500">No upcoming room bookings.</p>
            <p className="mt-1 text-sm text-gray-400">
              Book a room to schedule your sessions.
            </p>
            <Link
              href="/instructor/room-bookings/new"
              className="btn-primary mt-4 inline-block"
            >
              + Book your first room
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
