import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";

export default async function InstructorDashboardPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return null;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) return null;

  const { data: studio } = await supabase
    .from("studios")
    .select("name")
    .eq("id", profile.studio_id)
    .single();

  const studioName = (studio as { name?: string })?.name || "Studio";
  const instructorName = profile.full_name || user.email || "Instructor";

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const { data: myClasses } = await supabase
    .from("classes")
    .select("id")
    .eq("instructor_id", instructor.id);

  const classIds = (myClasses || []).map((c) => c.id);

  const { data: todaySessions } =
    classIds.length > 0
      ? await supabase
          .from("class_sessions")
          .select("id, session_date, start_time, capacity, is_cancelled, class_id, classes(name, duration_minutes, location)")
          .in("class_id", classIds)
          .eq("session_date", today)
          .eq("is_cancelled", false)
          .order("start_time", { ascending: true })
      : { data: [] };

  const { data: weekSessions } =
    classIds.length > 0
      ? await supabase
          .from("class_sessions")
          .select("id, session_date, start_time, capacity, is_cancelled, class_id, classes(name, duration_minutes, location)")
          .in("class_id", classIds)
          .gt("session_date", today)
          .lte("session_date", weekEndStr)
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true })
      : { data: [] };

  const todaySessionIds = (todaySessions || []).map((s) => s.id);
  const weekSessionIds = (weekSessions || []).map((s) => s.id);
  const allSessionIds = [...todaySessionIds, ...weekSessionIds];

  const { data: bookings } =
    allSessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id, status, attended")
          .in("session_id", allSessionIds)
          .eq("status", "confirmed")
      : { data: [] };

  const { data: dropIns } =
    allSessionIds.length > 0
      ? await supabase
          .from("drop_in_attendances")
          .select("session_id")
          .in("session_id", allSessionIds)
      : { data: [] };

  const bookedBySession = (bookings || []).reduce((acc, b) => {
    acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const attendedBySession = (bookings || [])
    .filter((b) => b.attended)
    .reduce((acc, b) => {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const dropInBySession = (dropIns || []).reduce((acc, d) => {
    acc[d.session_id] = (acc[d.session_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getEndTime = (startTime: string, durationMinutes: number) => {
    const [h, m] = startTime.split(":").map(Number);
    const totalM = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalM / 60) % 24;
    const endM = totalM % 60;
    return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {instructorName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{studioName}</p>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Today&apos;s Classes
        </h2>
        {todaySessions && todaySessions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {todaySessions.map((session) => {
              const cls = session.classes as { name?: string; duration_minutes?: number; location?: string } | null;
              const raw = Array.isArray(cls) ? cls[0] : cls;
              const className = raw?.name || "—";
              const duration = raw?.duration_minutes ?? 60;
              const location = raw?.location;
              const endTime = getEndTime(session.start_time, duration);
              const booked = bookedBySession[session.id] || 0;
              const attended =
                (attendedBySession[session.id] || 0) +
                (dropInBySession[session.id] || 0);

              return (
                <Link
                  key={session.id}
                  href={`/instructor/sessions/${session.id}`}
                  className="card block transition-colors hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <p className="font-medium text-gray-900">{className}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatTime(session.start_time)} – {formatTime(endTime)}
                  </p>
                  {location && (
                    <p className="mt-1 text-sm text-gray-500">{location}</p>
                  )}
                  <p className="mt-2 text-sm text-gray-600">
                    {booked} / {session.capacity} booked
                    {attended > 0 && ` · ${attended} attended`}
                  </p>
                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    View Details →
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card py-12 text-center">
            <p className="text-gray-600">
              No classes today. Enjoy your day off!
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          This Week
        </h2>
        {weekSessions && weekSessions.length > 0 ? (
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-gray-200">
              {weekSessions.map((session) => {
                const cls = session.classes as { name?: string } | null;
                const raw = Array.isArray(cls) ? cls[0] : cls;
                const className = raw?.name || "—";
                const booked = bookedBySession[session.id] || 0;

                return (
                  <Link
                    key={session.id}
                    href={`/instructor/sessions/${session.id}`}
                    className="block px-6 py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{className}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(session.session_date)} · {formatTime(session.start_time)}
                        </p>
                      </div>
                      <span className="text-sm text-gray-600">
                        {booked}/{session.capacity}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card py-8 text-center">
            <p className="text-sm text-gray-500">No more classes this week.</p>
          </div>
        )}
      </section>
    </div>
  );
}
