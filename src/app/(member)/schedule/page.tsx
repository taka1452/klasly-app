import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";
import { getPlanAccess } from "@/lib/plan-guard";
import BookingButton from "@/components/bookings/booking-button";

export default async function SchedulePage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  let memberId: string | null = null;
  let memberCredits = 0;

  let planStatus = "trialing";
  let member: { id: string; credits: number; waiver_signed?: boolean } | null = null;
  if (profile?.studio_id) {
    const { data: memberData } = await supabase
      .from("members")
      .select("id, credits, waiver_signed")
      .eq("studio_id", profile.studio_id)
      .eq("profile_id", user.id)
      .single();

    if (memberData) {
      member = memberData;
      memberId = memberData.id;
      memberCredits = memberData.credits;
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("plan_status")
      .eq("id", profile.studio_id)
      .single();
    planStatus = studio?.plan_status ?? "trialing";
  }

  const planAccess = getPlanAccess(planStatus);

  const today = new Date().toISOString().split("T")[0];
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, studio_id, session_date, start_time, capacity, is_cancelled, classes(name)")
    .eq("studio_id", profile?.studio_id || "")
    .gte("session_date", today)
    .eq("is_cancelled", false)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(50);

  const sessionIds = (sessions || []).map((s) => s.id);
  const { data: allBookings } =
    sessionIds.length > 0 && memberId
      ? await supabase
          .from("bookings")
          .select("session_id, status, id")
          .eq("member_id", memberId)
          .in("session_id", sessionIds)
      : { data: [] };

  const { data: confirmedCounts } =
    sessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id")
          .in("session_id", sessionIds)
          .eq("status", "confirmed")
      : { data: [] };

  const myBookingBySession = (allBookings || []).reduce((acc, b) => {
    acc[b.session_id] = { id: b.id, status: b.status };
    return acc;
  }, {} as Record<string, { id: string; status: string }>);

  const confirmedBySession = (confirmedCounts || []).reduce((acc, b) => {
    acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!profile?.studio_id) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          You are not a member of any studio. Contact your studio to get access.
        </p>
      </div>
    );
  }

  const waiverSigned = member ? member.waiver_signed : true;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
      <p className="mt-1 text-sm text-gray-500">
        Book your classes
      </p>

      {!waiverSigned && (
        <div className="mt-6 rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ You haven&apos;t signed the waiver yet. Please check your email for the signing link, or contact the studio.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {sessions && sessions.length > 0 ? (
          sessions.map((session) => {
            const className = (session as { classes?: { name?: string } }).classes?.name || "—";
            const existing = myBookingBySession[session.id];
            const confirmed = confirmedBySession[session.id] || 0;
            return (
              <div
                key={session.id}
                className="card flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{className}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDate(session.session_date)} · {formatTime(session.start_time)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {confirmed}/{session.capacity} booked
                  </p>
                </div>
                <BookingButton
                  sessionId={session.id}
                  studioId={session.studio_id}
                  capacity={session.capacity}
                  memberId={memberId}
                  existingBooking={existing || null}
                  memberCredits={memberCredits}
                  confirmedCount={confirmed}
                  canBook={planAccess.canBook}
                />
              </div>
            );
          })
        ) : (
          <div className="card">
            <p className="text-sm text-gray-500">No upcoming classes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
