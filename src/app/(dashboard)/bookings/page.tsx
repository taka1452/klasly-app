import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/empty-state";
import ExportCsvButton from "@/components/ui/export-csv-button";
import type { Metadata } from "next";
import BookingsMonthNav from "./bookings-month-nav";
import BookingsClient from "@/components/bookings/bookings-client";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ContextHelpLink from "@/components/help/context-help-link";

export const metadata: Metadata = {
  title: "Bookings - Klasly",
};

function getMonthRange(monthParam: string | undefined) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  }
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    year,
    month,
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month, startDate, endDate } = getMonthRange(params.month);
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // マネージャー権限チェック（can_manage_bookings）
  const permCheck = await checkManagerPermission("can_manage_bookings");
  if (!permCheck.allowed) {
    redirect("/dashboard");
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

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select(`
      id, session_date, start_time, capacity, is_cancelled, is_online,
      session_type, title,
      class_templates(name),
      rooms(name),
      instructors(profiles(full_name))
    `)
    .eq("studio_id", profile.studio_id)
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(200);

  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
  const { data: bookings } =
    sessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id, status")
          .in("session_id", sessionIds)
          .neq("status", "cancelled")
      : { data: [] };

  const confirmedBySession = (bookings || []).reduce((acc: Record<string, number>, b: { session_id: string; status: string }) => {
    if (b.status === "confirmed") {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const waitlistBySession = (bookings || []).reduce((acc: Record<string, number>, b: { session_id: string; status: string }) => {
    if (b.status === "waitlist") {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Transform sessions for the client component
  // eslint-disable-next-line
  const clientSessions = (sessions || []).map((s: any) => {
    const tmpl = Array.isArray(s.class_templates) ? s.class_templates[0] : s.class_templates;
    const room = Array.isArray(s.rooms) ? s.rooms[0] : s.rooms;
    const instr = Array.isArray(s.instructors) ? s.instructors[0] : s.instructors;
    const profile = instr?.profiles
      ? Array.isArray(instr.profiles) ? instr.profiles[0] : instr.profiles
      : null;

    return {
      id: s.id as string,
      session_date: s.session_date as string,
      start_time: s.start_time as string,
      capacity: s.capacity as number,
      is_cancelled: s.is_cancelled as boolean,
      is_online: s.is_online as boolean,
      session_type: (s.session_type as string) || "class",
      class_name: tmpl?.name || s.title || "—",
      room_name: room?.name || null,
      instructor_name: profile?.full_name || null,
      confirmed: confirmedBySession[s.id] || 0,
      waitlist: waitlistBySession[s.id] || 0,
    };
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            <ContextHelpLink href="/help/classes-scheduling/manage-bookings" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Sessions for {new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <BookingsMonthNav year={year} month={month} />
          <ExportCsvButton
            url={`/api/export/bookings?from=${startDate}&to=${endDate}`}
            filename={`bookings-${year}-${String(month).padStart(2, "0")}.csv`}
          />
        </div>
      </div>

      <div className="mt-6">
        {clientSessions.length > 0 ? (
          <BookingsClient sessions={clientSessions} year={year} month={month} />
        ) : (
          <EmptyState
            title="No upcoming sessions"
            actionLabel="Create your first class"
            actionHref="/classes/new"
          />
        )}
      </div>
    </div>
  );
}
