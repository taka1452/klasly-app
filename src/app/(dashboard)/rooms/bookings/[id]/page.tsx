import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import RoomBookingStaffActions from "@/components/dashboard/room-booking-staff-actions";

type PageParams = Promise<{ id: string }>;

export default async function RoomBookingDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const perm = await checkManagerPermission("can_manage_rooms");
  if (!perm.allowed) redirect("/dashboard");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) redirect("/onboarding");

  const roomEnabled = await isFeatureEnabled(
    profile.studio_id,
    FEATURE_KEYS.ROOM_MANAGEMENT
  );
  if (!roomEnabled) redirect("/dashboard");

  const { data: booking } = await supabase
    .from("class_sessions")
    .select(
      "id, title, session_date, start_time, end_time, is_public, is_cancelled, instructor_id, room_id, studio_id, session_type, recurrence_group_id, location"
    )
    .eq("id", id)
    .single();

  if (!booking || booking.studio_id !== profile.studio_id) {
    notFound();
  }
  if (booking.session_type !== "room_only") {
    // This page is for instructor room bookings only. Class sessions have
    // their own detail page.
    redirect(`/calendar/${booking.instructor_id}/sessions/${booking.id}`);
  }

  const [roomRes, instructorRes] = await Promise.all([
    supabase.from("rooms").select("name").eq("id", booking.room_id).single(),
    supabase
      .from("instructors")
      .select("id, profiles(full_name, email)")
      .eq("id", booking.instructor_id)
      .single(),
  ]);

  const rawInstructorProfile = instructorRes.data?.profiles as unknown;
  const instructorProfile = (Array.isArray(rawInstructorProfile)
    ? rawInstructorProfile[0]
    : rawInstructorProfile) as { full_name: string; email: string } | null;

  // Count remaining future sessions in the same recurrence group.
  let futureCount = 0;
  if (booking.recurrence_group_id && !booking.is_cancelled) {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .eq("recurrence_group_id", booking.recurrence_group_id)
      .eq("instructor_id", booking.instructor_id)
      .eq("is_cancelled", false)
      .gte("session_date", today);
    futureCount = count ?? 0;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/rooms" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to rooms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {booking.title}
          {booking.is_cancelled && (
            <span className="ml-3 rounded-full bg-gray-100 px-2.5 py-0.5 align-middle text-xs font-medium text-gray-500">
              Cancelled
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Instructor room booking
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Instructor</dt>
              <dd className="font-medium text-gray-900">
                {instructorProfile?.full_name ?? "—"}
                {instructorProfile?.email && (
                  <span className="ml-2 text-xs text-gray-400">
                    {instructorProfile.email}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Room</dt>
              <dd className="font-medium text-gray-900">
                {roomRes.data?.name ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Date</dt>
              <dd className="font-medium text-gray-900">
                {formatDate(booking.session_date)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Time</dt>
              <dd className="font-medium text-gray-900">
                {formatTime(booking.start_time)} &ndash; {formatTime(booking.end_time)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Visibility</dt>
              <dd className="font-medium text-gray-900">
                {booking.is_public ? "Public" : "Private"}
              </dd>
            </div>
            {booking.location && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Notes</dt>
                <dd className="max-w-xs text-right font-medium text-gray-900">
                  {booking.location}
                </dd>
              </div>
            )}
            {booking.recurrence_group_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Recurring</dt>
                <dd className="font-medium text-gray-900">
                  Part of a weekly series
                  {futureCount > 0 && (
                    <span className="ml-1 text-xs text-gray-400">
                      ({futureCount} future session
                      {futureCount === 1 ? "" : "s"} left)
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {!booking.is_cancelled && (
          <div className="card border-amber-200 bg-amber-50 lg:col-span-1">
            <h2 className="text-sm font-semibold text-amber-900">Cancel booking</h2>
            <p className="mt-1 text-xs text-amber-800">
              The instructor will receive an email if they have booking
              cancellation notifications enabled. You can optionally include a
              reason.
            </p>
            <div className="mt-3">
              <RoomBookingStaffActions
                bookingId={booking.id}
                hasFutureSeries={
                  !!booking.recurrence_group_id && futureCount > 1
                }
                futureCount={futureCount}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
