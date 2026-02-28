import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime, getStatusColor } from "@/lib/utils";

export default async function InstructorSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) notFound();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) notFound();

  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time, capacity, is_cancelled, class_id, classes(name, location)")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const cls = session.classes as { name?: string; location?: string } | null;
  const rawClass = Array.isArray(cls) ? cls[0] : cls;
  const className = rawClass?.name || "—";
  const location = rawClass?.location;

  const { data: myClass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", session.class_id)
    .eq("instructor_id", instructor.id)
    .single();

  if (!myClass) notFound();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, attended, members(profiles(full_name))")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const { data: dropIns } = await supabase
    .from("drop_in_attendances")
    .select("id, members(profiles(full_name))")
    .eq("session_id", sessionId);

  const confirmedBookings = (bookings || []).filter((b) => b.status === "confirmed");
  const waitlistBookings = (bookings || []).filter((b) => b.status === "waitlist");

  const attendedCount = confirmedBookings.filter((b) => b.attended).length;
  const dropInCount = dropIns?.length ?? 0;
  const totalAttended = attendedCount + dropInCount;

  const getMemberName = (members: unknown) => {
    const m = members as { profiles?: { full_name?: string } } | null;
    const p = Array.isArray(m?.profiles) ? m?.profiles[0] : m?.profiles;
    return (p as { full_name?: string })?.full_name || "—";
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/instructor/schedule"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to schedule
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{className}</h1>
          {session.is_cancelled && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              Cancelled
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {formatDate(session.session_date)} · {formatTime(session.start_time)} ·{" "}
          {session.capacity} capacity
          {location && ` · ${location}`}
        </p>
      </div>

      <div className="card mb-6">
        <p className="text-sm text-gray-600">
          {confirmedBookings.length} booked · {totalAttended} attended
          {dropInCount > 0 && ` · ${dropInCount} drop-ins`}
        </p>
      </div>

      <div className="card mb-6">
        <h3 className="text-sm font-medium text-gray-500">Booked Members</h3>
        {confirmedBookings.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Attended</th>
                </tr>
              </thead>
              <tbody>
                {confirmedBookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-3 font-medium text-gray-900">
                      {getMemberName(b.members)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(b.status)}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {b.attended ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No confirmed bookings.</p>
        )}
      </div>

      {waitlistBookings.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-medium text-gray-500">Waitlist</h3>
          <ul className="mt-4 space-y-2">
            {waitlistBookings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{getMemberName(b.members)}</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(b.status)}`}
                >
                  waitlist
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dropIns && dropIns.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500">
            Drop-in Attendees
          </h3>
          <ul className="mt-4 space-y-2">
            {dropIns.map((d) => (
              <li
                key={d.id}
                className="text-sm font-medium text-gray-900"
              >
                {getMemberName(d.members)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
