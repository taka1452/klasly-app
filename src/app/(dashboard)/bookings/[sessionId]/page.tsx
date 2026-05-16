import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import AttendanceToggle from "@/components/bookings/attendance-toggle";
import OwnerCancelButton from "@/components/bookings/owner-cancel-button";
import { redirect } from "next/navigation";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";

export default async function SessionBookingsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // マネージャー権限チェック
  const permCheck = await checkManagerPermission("can_manage_bookings");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  // All 3 queries are independent — parallelize
  const [{ data: session }, { data: ownerProfile }, { data: bookings }] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "*, class_templates(name), rooms(name), instructors(profiles(full_name))",
      )
      .eq("id", sessionId)
      .single(),
    supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("bookings")
      .select("id, member_id, status, attended, booked_via_pass, members(profiles(full_name))")
      .eq("session_id", sessionId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
  ]);

  if (!session) {
    notFound();
  }

  if (ownerProfile?.studio_id !== session.studio_id) {
    notFound();
  }

  type SessionMeta = {
    title?: string | null;
    session_type?: string;
    is_cancelled?: boolean;
    is_online?: boolean;
    class_templates?: { name?: string } | { name?: string }[] | null;
    rooms?: { name?: string } | { name?: string }[] | null;
    instructors?:
      | { profiles?: { full_name?: string } | { full_name?: string }[] }
      | { profiles?: { full_name?: string } | { full_name?: string }[] }[]
      | null;
  };
  const meta = session as SessionMeta;
  const tmpl = Array.isArray(meta.class_templates)
    ? meta.class_templates[0]
    : meta.class_templates;
  const roomRow = Array.isArray(meta.rooms) ? meta.rooms[0] : meta.rooms;
  const instrRow = Array.isArray(meta.instructors)
    ? meta.instructors[0]
    : meta.instructors;
  const instrProfile = instrRow?.profiles
    ? Array.isArray(instrRow.profiles)
      ? instrRow.profiles[0]
      : instrRow.profiles
    : null;
  const isRoomOnly = meta.session_type === "room_only";
  const className =
    tmpl?.name || meta.title || (isRoomOnly ? "Room booking" : "Class");
  const roomName = roomRow?.name ?? null;
  const instructorName = instrProfile?.full_name ?? null;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/bookings"
          className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">&larr;</span>
          Bookings
        </Link>
      </div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {isRoomOnly && (
            <span className="inline-block rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
              Room
            </span>
          )}
          {meta.is_cancelled && (
            <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
              Cancelled
            </span>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {className}
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formatDate(session.session_date)} · {formatTime(session.start_time)}
          {instructorName && ` · ${instructorName}`}
          {roomName && ` · ${roomName}`}
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-gray-500">Attendees</h3>
        {bookings && bookings.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-200">
            {bookings.map((booking) => {
              const member = booking.members as { profiles?: { full_name?: string } } | null;
              const name = member?.profiles?.full_name || "—";
              return (
                <li
                  key={booking.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <AttendanceToggle
                      bookingId={booking.id}
                      attended={booking.attended}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{name}</p>
                      <div className="flex gap-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            booking.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {booking.status}
                        </span>
                        {(booking as { booked_via_pass?: boolean }).booked_via_pass && (
                          <span className="inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                            Pass
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <OwnerCancelButton bookingId={booking.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No bookings for this session.</p>
        )}
      </div>
    </div>
  );
}
