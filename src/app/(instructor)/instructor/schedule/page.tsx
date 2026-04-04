import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ScheduleView from "@/components/instructor/schedule-view";

export default async function InstructorSchedulePage() {
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

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!instructor) return null;

  // Fetch from unified class_sessions table (both classes and room-only)
  const today = new Date().toISOString().split("T")[0];
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select(
      "id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, price_cents, location, title, online_link, template_id, room_id, rooms(name), class_templates(name, price_cents, is_public, location, online_link)"
    )
    .eq("instructor_id", instructor.id)
    .eq("is_cancelled", false)
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(200);

  const sessionIds = (sessions || [])
    .filter((s) => s.session_type === "class")
    .map((s) => s.id);

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

  const sessionsWithData = (sessions || []).map((s) => {
    const template = s.class_templates as {
      name?: string;
      price_cents?: number | null;
      is_public?: boolean;
      location?: string | null;
      online_link?: string | null;
    } | null;
    const rawTemplate = Array.isArray(template) ? template[0] : template;
    const room = s.rooms as { name?: string } | null;
    const rawRoom = Array.isArray(room) ? room[0] : room;

    const isRoomOnly = s.session_type === "room_only";
    const isOnline = !isRoomOnly && !s.room_id && !!((s as Record<string, unknown>).online_link || rawTemplate?.online_link);

    return {
      id: s.id,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_minutes: s.duration_minutes,
      capacity: s.capacity ?? 0,
      is_cancelled: s.is_cancelled,
      class_name: isRoomOnly
        ? (s.title || "Room Booking")
        : (s.title || rawTemplate?.name || "—"),
      location: s.location || rawTemplate?.location,
      room_name: rawRoom?.name || null,
      booked: bookedBySession[s.id] || 0,
      price_cents: s.price_cents ?? rawTemplate?.price_cents ?? null,
      is_public: s.is_public ?? rawTemplate?.is_public ?? true,
      is_online: isOnline,
      online_link: (s as Record<string, unknown>).online_link as string | null ?? rawTemplate?.online_link ?? null,
      session_type: s.session_type as "class" | "room_only",
      template_id: s.template_id,
    };
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
        <Link
          href="/instructor/room-bookings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          Book a Room
        </Link>
      </div>
      <ScheduleView sessions={sessionsWithData} />
    </div>
  );
}
