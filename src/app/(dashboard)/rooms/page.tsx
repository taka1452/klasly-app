import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rooms - Klasly",
};

export default async function RoomsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return null;

  // Show bookings from the start of this week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weekStart = monday.toISOString().split("T")[0];

  const { data: bookings } = await supabase
    .from("instructor_room_bookings")
    .select(
      "*, rooms(name), instructors(profiles(full_name))"
    )
    .eq("studio_id", profile.studio_id)
    .eq("status", "confirmed")
    .gte("booking_date", weekStart)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="mt-1 text-sm text-gray-500">
            This week&apos;s room bookings by instructors
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rooms/manage" className="btn-secondary">
            Manage Rooms
          </Link>
        </div>
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

                const instr = b.instructors as {
                  profiles?: { full_name?: string };
                } | null;
                const rawInstr = Array.isArray(instr) ? instr[0] : instr;
                const instructorName =
                  rawInstr?.profiles?.full_name || "Unknown";

                const today = new Date().toISOString().split("T")[0];
                const isPast = b.booking_date < today;

                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between gap-4 px-6 py-4 ${isPast ? "opacity-50" : ""}`}
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
                        {b.recurrence_group_id && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700">
                            Recurring
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {instructorName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(b.booking_date)} ·{" "}
                        {formatTime(b.start_time)} – {formatTime(b.end_time)}
                      </p>
                      <p className="text-xs text-gray-400">{roomName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card py-12 text-center">
            <p className="text-gray-500">No upcoming room bookings.</p>
            <p className="mt-1 text-sm text-gray-400">
              Instructors can book rooms from their portal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
