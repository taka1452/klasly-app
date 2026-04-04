import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatTime } from "@/lib/utils";
import WhatsNewBanner from "@/components/instructor/whats-new-banner";

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
    .select("full_name, studio_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) redirect("/login");

  const onboardingCompleted = (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;

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

  // Query today's sessions only (full week is on My Schedule)
  const { data: todaySessions } = await supabase
    .from("class_sessions")
    .select(
      "id, session_date, start_time, capacity, is_cancelled, title, session_type, duration_minutes, location, template_id, room_id, rooms(name), class_templates(name, duration_minutes, location)"
    )
    .eq("instructor_id", instructor.id)
    .eq("session_date", today)
    .eq("is_cancelled", false)
    .order("start_time", { ascending: true });

  const allSessions = todaySessions || [];
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
      <WhatsNewBanner />

      {/* First-time welcome message */}
      {!onboardingCompleted && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-900">
            Welcome to Klasly!
          </h2>
          <p className="mt-1 text-sm text-brand-700 leading-relaxed">
            Here&apos;s what you can do from your portal:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-brand-700">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />
              <span><strong>Schedule</strong> — View your upcoming classes and create new ones</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />
              <span><strong>Attendance</strong> — Check in members for each session</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />
              <span><strong>Profile</strong> — Update your bio and specialties</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />
              <span><strong>Earnings</strong> — Track your monthly revenue</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-brand-600">
            This message will disappear once you complete the tutorial.
          </p>
        </div>
      )}

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

      <div className="text-center">
        <Link
          href="/instructor/schedule"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          View full schedule
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
