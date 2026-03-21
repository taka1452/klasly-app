import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";

export default async function InstructorDashboardPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

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

  if (!profile?.studio_id) redirect("/login");

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-gray-900">Instructor Setup Incomplete</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your instructor profile has not been set up yet. Please contact the studio owner to complete your instructor registration.
          </p>
        </div>
      </div>
    );
  }

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
  // 今日から次の土曜日（週末）までを表示（日曜始まりで6日後の土曜まで）
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (daysUntilSaturday === 0 ? 6 : daysUntilSaturday));
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  // Query class_sessions directly by instructor_id (unified table)
  const { data: todaySessions } = await supabase
    .from("class_sessions")
    .select(
      "id, session_date, start_time, capacity, is_cancelled, title, session_type, duration_minutes, location, template_id, room_id, rooms(name), class_templates(name, duration_minutes, location)"
    )
    .eq("instructor_id", instructor.id)
    .eq("session_date", today)
    .eq("is_cancelled", false)
    .order("start_time", { ascending: true });

  const { data: weekSessions } = await supabase
    .from("class_sessions")
    .select(
      "id, session_date, start_time, capacity, is_cancelled, title, session_type, duration_minutes, location, template_id, room_id, rooms(name), class_templates(name, duration_minutes, location)"
    )
    .eq("instructor_id", instructor.id)
    .gt("session_date", today)
    .lte("session_date", weekEndStr)
    .eq("is_cancelled", false)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  const allSessions = [...(todaySessions || []), ...(weekSessions || [])];
  const classSessionIds = allSessions
    .filter((s) => s.session_type !== "room_only")
    .map((s) => s.id);
  const allSessionIds = allSessions.map((s) => s.id);

  const { data: bookings } =
    classSessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id, status, attended")
          .in("session_id", classSessionIds)
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Welcome back, {instructorName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{studioName}</p>
      </div>

      <section className="mb-8" data-tour="assigned-classes">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Today&apos;s Classes
        </h2>
        {todaySessions && todaySessions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {todaySessions.map((session, idx) => {
              const template = session.class_templates as { name?: string; duration_minutes?: number; location?: string } | null;
              const rawTemplate = Array.isArray(template) ? template[0] : template;
              const isRoomOnly = session.session_type === "room_only";
              const className = isRoomOnly ? (session.title || "Room Booking") : (session.title || rawTemplate?.name || "—");
              const duration = session.duration_minutes ?? rawTemplate?.duration_minutes ?? 60;
              const location = session.location || rawTemplate?.location;
              const room = session.rooms as { name?: string } | null;
              const roomName = Array.isArray(room) ? room[0]?.name : room?.name;
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
                  {...(idx === 0 ? { "data-tour": "attendance-section" } : {})}
                >
                  <p className="font-medium text-gray-900">
                    {isRoomOnly && (
                      <span className="mr-1 inline-block rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700">
                        Room
                      </span>
                    )}
                    {className}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatTime(session.start_time)} – {formatTime(endTime)}
                    {roomName && ` · ${roomName}`}
                  </p>
                  {location && (
                    <p className="mt-1 text-sm text-gray-500">{location}</p>
                  )}
                  {!isRoomOnly && (
                    <p className="mt-2 text-sm text-gray-600">
                      {booked} / {session.capacity} booked
                      {attended > 0 && ` · ${attended} attended`}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    View Details →
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card py-12 text-center" data-tour="attendance-section">
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
                const template = session.class_templates as { name?: string } | null;
                const rawTmpl = Array.isArray(template) ? template[0] : template;
                const isRoomOnly = session.session_type === "room_only";
                const className = isRoomOnly ? (session.title || "Room Booking") : (session.title || rawTmpl?.name || "—");
                const booked = bookedBySession[session.id] || 0;
                const room = session.rooms as { name?: string } | null;
                const roomName = Array.isArray(room) ? room[0]?.name : room?.name;

                return (
                  <Link
                    key={session.id}
                    href={isRoomOnly ? "/instructor/room-bookings" : `/instructor/sessions/${session.id}`}
                    className="block px-4 py-3 md:px-6 md:py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {isRoomOnly && (
                            <span className="mr-1 inline-block rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700">
                              Room
                            </span>
                          )}
                          {className}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(session.session_date)} · {formatTime(session.start_time)}
                          {roomName && ` · ${roomName}`}
                        </p>
                      </div>
                      {!isRoomOnly && (
                        <span className="text-sm text-gray-600">
                          {booked}/{session.capacity}
                        </span>
                      )}
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
