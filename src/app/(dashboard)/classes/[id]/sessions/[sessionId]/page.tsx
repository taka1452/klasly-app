import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import SessionAttendance from "@/components/attendance/session-attendance";
import SessionVisibilityToggle from "@/components/classes/session-visibility-toggle";
import SessionOnlineToggle from "@/components/classes/session-online-toggle";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

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
    .select("id, session_date, start_time, capacity, class_id, studio_id, is_public, is_online, online_link")
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
    .select("name, is_online, online_link")
    .eq("id", classId)
    .single();

  const className = classData?.name ?? "—";
  const onlineEnabled = await isFeatureEnabled(session.studio_id, FEATURE_KEYS.ONLINE_CLASSES);
  // Resolve effective online status: session overrides class
  const effectiveIsOnline = onlineEnabled && (session.is_online ?? classData?.is_online ?? false);
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
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {effectiveIsOnline && <span title="Online">📹 </span>}
          {className}
        </h1>
        <p className="text-sm text-gray-500">
          {formatDate(session.session_date)} · {formatTime(session.start_time)} ·{" "}
          {session.capacity} capacity
          {effectiveIsOnline && " · Online"}
        </p>
        {effectiveIsOnline && (session.online_link || classData?.online_link) && (
          <a
            href={session.online_link || classData?.online_link || ""}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Open online link →
          </a>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <SessionVisibilityToggle
            sessionId={sessionId}
            initialIsPublic={session.is_public ?? true}
          />
        </div>
        {onlineEnabled && (
          <div className="mt-4 card">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Session Type</h3>
            <SessionOnlineToggle
              sessionId={sessionId}
              initialIsOnline={session.is_online}
              initialOnlineLink={session.online_link}
              classOnlineLink={classData?.online_link}
            />
          </div>
        )}
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
