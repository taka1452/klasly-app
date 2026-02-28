import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import SessionAttendance from "@/components/attendance/session-attendance";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: classId, sessionId } = await params;
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

  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time, capacity, class_id, studio_id")
    .eq("id", sessionId)
    .single();

  if (!session) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.studio_id !== session.studio_id) {
    notFound();
  }

  const { data: classData } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .single();

  const className = classData?.name ?? "—";
  const startTime =
    typeof session.start_time === "string" && session.start_time.length >= 5
      ? session.start_time.slice(0, 5)
      : "00:00";

  return (
    <div>
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/classes" className="hover:text-gray-700">
            Classes
          </Link>
          <span>/</span>
          <Link
            href={`/classes/${classId}`}
            className="hover:text-gray-700"
          >
            {className}
          </Link>
          <span>/</span>
          <span className="text-gray-900">
            {formatDate(session.session_date)}
          </span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{className}</h1>
        <p className="text-sm text-gray-500">
          {formatDate(session.session_date)} · {formatTime(session.start_time)} ·{" "}
          {session.capacity} capacity
        </p>
      </div>

      <SessionAttendance
        classId={classId}
        sessionId={sessionId}
        initialClassName={className}
        initialSessionDate={session.session_date}
        initialStartTime={startTime}
        initialCapacity={session.capacity}
      />
    </div>
  );
}
