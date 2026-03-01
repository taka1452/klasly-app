import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";
import ExportCsvButton from "@/components/ui/export-csv-button";
import type { Metadata } from "next";
import BookingsMonthNav from "./bookings-month-nav";

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

  if (!profile?.studio_id) {
    return null;
  }

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time, capacity, is_cancelled, classes(name)")
    .eq("studio_id", profile.studio_id)
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(200);

  const sessionIds = (sessions || []).map((s) => s.id);
  const { data: bookings } =
    sessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id, status")
          .in("session_id", sessionIds)
          .neq("status", "cancelled")
      : { data: [] };

  const confirmedBySession = (bookings || []).reduce((acc, b) => {
    if (b.status === "confirmed") {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const waitlistBySession = (bookings || []).reduce((acc, b) => {
    if (b.status === "waitlist") {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">
            {year}年{month}月のセッション
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
        {sessions && sessions.length > 0 ? (
          <div className="card divide-y divide-gray-200 overflow-hidden p-0">
            {sessions.map((session) => {
              const confirmed = confirmedBySession[session.id] || 0;
              const waitlist = waitlistBySession[session.id] || 0;
              const className = (session as { classes?: { name?: string } }).classes?.name || "—";
              return (
                <Link
                  key={session.id}
                  href={`/bookings/${session.id}`}
                  className="block px-4 py-4 transition-colors hover:bg-gray-50 sm:px-6"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{className}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(session.session_date)} · {formatTime(session.start_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          session.is_cancelled
                            ? "text-sm font-medium text-red-600"
                            : "text-sm text-gray-600"
                        }
                      >
                        {session.is_cancelled
                          ? "Cancelled"
                          : `${confirmed}/${session.capacity}`}
                      </span>
                      {waitlist > 0 && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          +{waitlist} waitlist
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
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
