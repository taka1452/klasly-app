import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";
import { getPlanAccess } from "@/lib/plan-guard";
import BookingButton from "@/components/bookings/booking-button";

export default async function MyBookingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return null;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: memberList } = await supabase
    .from("members")
    .select("id, credits, studio_id")
    .eq("profile_id", user.id);

  const member = memberList?.[0];
  let planStatus = "trialing";
  if (member?.studio_id) {
    const { data: studio } = await supabase
      .from("studios")
      .select("plan_status")
      .eq("id", member.studio_id)
      .single();
    planStatus = studio?.plan_status ?? "trialing";
  }
  const planAccess = getPlanAccess(planStatus);
  const memberIds = (memberList || []).map((m) => m.id);
  const creditsByMember: Record<string, number> = (memberList || []).reduce(
    (acc, m) => {
      acc[m.id] = m.credits;
      return acc;
    },
    {} as Record<string, number>
  );

  if (!member) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          You are not a member of any studio. Contact your studio to get access.
        </p>
      </div>
    );
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id,
      status,
      session_id,
      member_id,
      class_sessions (
        session_date,
        start_time,
        capacity,
        is_cancelled,
        classes (name)
      )
    `)
    .in("member_id", memberIds)
    .order("created_at", { ascending: false });

  const today = new Date().toISOString().split("T")[0];
  const upcoming: typeof bookings = [];
  const past: typeof bookings = [];

  (bookings || []).forEach((b) => {
    const raw = b.class_sessions as { session_date?: string } | { session_date?: string }[] | null;
    const session = Array.isArray(raw) ? raw[0] : raw;
    const isUpcoming =
      session &&
      (session.session_date ?? "") >= today &&
      b.status !== "cancelled";
    if (isUpcoming) {
      upcoming.push(b);
    } else {
      past.push(b);
    }
  });

  // Get confirmed count per session for upcoming (used by BookingButton)
  const sessionIds = upcoming.map((b) => b.session_id);
  const { data: countRows } = sessionIds.length
    ? await supabase
        .from("bookings")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("status", "confirmed")
    : { data: [] };
  const confirmedBySession: Record<string, number> = {};
  (countRows || []).forEach((r) => {
    confirmedBySession[r.session_id] = (confirmedBySession[r.session_id] || 0) + 1;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your upcoming and past classes
      </p>

      {upcoming.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map((booking) => {
              const raw = booking.class_sessions as unknown;
              const session = (Array.isArray(raw) ? raw[0] : raw) as {
                session_date?: string;
                start_time?: string;
                capacity?: number;
                classes?: { name?: string };
              } | null | undefined;
              const classesRef = session?.classes;
              const className =
                (classesRef && !Array.isArray(classesRef)
                  ? (classesRef as { name?: string }).name
                  : undefined) || "—";
              const confirmedCount =
                confirmedBySession[booking.session_id] ?? 0;

              return (
                <div
                  key={booking.id}
                  className="card flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{className}</h3>
                    <p className="text-sm text-gray-500">
                      {session?.session_date && formatDate(session.session_date)} ·{" "}
                      {session?.start_time && formatTime(session.start_time)}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        booking.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <BookingButton
                    sessionId={booking.session_id}
                    studioId=""
                    capacity={session?.capacity || 0}
                    memberId={booking.member_id}
                    existingBooking={{ id: booking.id, status: booking.status }}
                    memberCredits={creditsByMember[booking.member_id] ?? 0}
                    confirmedCount={confirmedCount}
                    canBook={planAccess.canBook}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Past</h2>
          <div className="space-y-3">
            {past.map((booking) => {
              const raw = booking.class_sessions as unknown;
              const session = (Array.isArray(raw) ? raw[0] : raw) as {
                session_date?: string;
                start_time?: string;
                classes?: { name?: string };
              } | null | undefined;
              const classesRef = session?.classes;
              const className =
                (classesRef && !Array.isArray(classesRef)
                  ? (classesRef as { name?: string }).name
                  : undefined) || "—";
              return (
                <div
                  key={booking.id}
                  className="card flex items-center justify-between opacity-75"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{className}</h3>
                    <p className="text-sm text-gray-500">
                      {session?.session_date && formatDate(session.session_date)} ·{" "}
                      {session?.start_time && formatTime(session.start_time)}
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {booking.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">No bookings yet.</p>
          <a href="/schedule" className="btn-primary mt-4 inline-block">
            View schedule
          </a>
        </div>
      )}
    </div>
  );
}
