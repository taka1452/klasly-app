import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDayName, formatTime, formatDate } from "@/lib/utils";
import ClassEditForm from "@/components/classes/class-edit-form";
import ClassDeactivateButton from "@/components/classes/class-deactivate-button";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .single();

  if (!cls) {
    notFound();
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (ownerProfile?.studio_id !== cls.studio_id) {
    notFound();
  }

  // 今後のセッションを取得（最大8件、日付順）
  const today = new Date().toISOString().split("T")[0];
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date, capacity, is_cancelled")
    .eq("class_id", id)
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .limit(8);

  // 各セッションの予約数を取得
  const sessionIds = (sessions || []).map((s) => s.id);
  const { data: bookings } =
    sessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id")
          .in("session_id", sessionIds)
          .eq("status", "confirmed")
      : { data: [] };

  const bookingCountBySession = (bookings || []).reduce((acc, b) => {
    acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // start_time を HTML time input 用に "HH:MM" に変換
  const startTimeForInput =
    typeof cls.start_time === "string" && cls.start_time.length >= 5
      ? cls.start_time.slice(0, 5)
      : "09:00";

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/classes"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to classes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{cls.name}</h1>
        {cls.description && (
          <p className="mt-1 text-sm text-gray-600">{cls.description}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左: 編集フォーム */}
        <div className="lg:col-span-2">
          <ClassEditForm
            classId={cls.id}
            initialData={{
              name: cls.name,
              description: cls.description || "",
              dayOfWeek: cls.day_of_week,
              startTime: startTimeForInput,
              durationMinutes: cls.duration_minutes,
              capacity: cls.capacity,
              location: cls.location || "",
            }}
          />
        </div>

        {/* 右: サイドパネル */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Class Info</h3>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-gray-400">Day</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {getDayName(cls.day_of_week)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Time</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatTime(cls.start_time)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Duration</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {cls.duration_minutes} min
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Capacity</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {cls.capacity} spots
                </dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">
              Upcoming Sessions
            </h3>
            {sessions && sessions.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {sessions.map((session) => {
                  const booked =
                    bookingCountBySession[session.id] || 0;
                  return (
                    <li
                      key={session.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {formatDate(session.session_date)}
                      </span>
                      <span
                        className={
                          session.is_cancelled
                            ? "text-red-600"
                            : "text-gray-600"
                        }
                      >
                        {session.is_cancelled
                          ? "Cancelled"
                          : `${booked}/${session.capacity}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No upcoming sessions
              </p>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-amber-600">Danger Zone</h3>
            <p className="mt-2 text-xs text-gray-500">
              Deactivate this class to hide it from the schedule.
            </p>
            <ClassDeactivateButton classId={cls.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
