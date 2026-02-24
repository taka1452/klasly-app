import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import AttendanceToggle from "@/components/bookings/attendance-toggle";

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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: session } = await supabase
    .from("class_sessions")
    .select("*, classes(name)")
    .eq("id", sessionId)
    .single();

  if (!session) {
    notFound();
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (ownerProfile?.studio_id !== session.studio_id) {
    notFound();
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, member_id, status, attended, members(profiles(full_name))")
    .eq("session_id", sessionId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  const className = (session as { classes?: { name?: string } }).classes?.name || "—";

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/bookings"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to bookings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{className}</h1>
        <p className="text-sm text-gray-500">
          {formatDate(session.session_date)} · {formatTime(session.start_time)}
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
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          booking.status === "confirmed"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>
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
