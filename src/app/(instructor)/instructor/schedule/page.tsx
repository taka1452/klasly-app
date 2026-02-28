import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import ScheduleView from "@/components/instructor/schedule-view";

export default async function InstructorSchedulePage() {
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

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) return null;

  const { data: myClasses } = await supabase
    .from("classes")
    .select("id, name")
    .eq("instructor_id", instructor.id);

  const classIds = (myClasses || []).map((c) => c.id);

  const { data: sessions } =
    classIds.length > 0
      ? await supabase
          .from("class_sessions")
          .select("id, session_date, start_time, capacity, is_cancelled, class_id, classes(name, location)")
          .in("class_id", classIds)
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(100)
      : { data: [] };

  const sessionIds = (sessions || []).map((s) => s.id);
  const { data: bookings } =
    sessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id")
          .in("session_id", sessionIds)
          .eq("status", "confirmed")
      : { data: [] };

  const bookedBySession = (bookings || []).reduce((acc, b) => {
    acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const classMap = (myClasses || []).reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {} as Record<string, string>);

  const sessionsWithData = (sessions || []).map((s) => {
    const cls = s.classes as { name?: string; location?: string } | null;
    const raw = Array.isArray(cls) ? cls[0] : cls;
    return {
      id: s.id,
      session_date: s.session_date,
      start_time: s.start_time,
      capacity: s.capacity,
      is_cancelled: s.is_cancelled,
      class_id: s.class_id,
      class_name: raw?.name || classMap[s.class_id] || "—",
      location: raw?.location,
      booked: bookedBySession[s.id] || 0,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Schedule</h1>
      <ScheduleView sessions={sessionsWithData} />
    </div>
  );
}
