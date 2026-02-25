import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  formatDate,
  formatTime,
  formatCurrency,
} from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - Klasly",
};

export default async function DashboardPage() {
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
    .select("full_name, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];

  // 1. Active Members count
  const { count: activeMembersCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", profile.studio_id)
    .eq("status", "active");

  // 2. Today's Classes count
  const { data: todaySessions } = await supabase
    .from("class_sessions")
    .select("id")
    .eq("studio_id", profile.studio_id)
    .eq("session_date", today)
    .eq("is_cancelled", false);

  const todayClassesCount = todaySessions?.length ?? 0;
  const todaySessionIds = (todaySessions || []).map((s) => s.id);

  // 3. Today's Bookings count (confirmed only)
  const { count: todayBookingsCount } =
    todaySessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("session_id", todaySessionIds)
          .eq("status", "confirmed")
      : { count: 0 };

  // 4. This Month's Revenue (payments: status='paid', paid_at this month)
  const { data: paidPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("studio_id", profile.studio_id)
    .eq("status", "paid")
    .gte("paid_at", `${monthStart}T00:00:00Z`)
    .lt("paid_at", `${nextMonthStart}T00:00:00Z`);

  const monthRevenue =
    paidPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;

  // Today's classes list (for display with booking counts)
  const { data: todayClassesList } = await supabase
    .from("class_sessions")
    .select("id, session_date, start_time, capacity, classes(name)")
    .eq("studio_id", profile.studio_id)
    .eq("session_date", today)
    .eq("is_cancelled", false)
    .order("start_time", { ascending: true });

  const todayListSessionIds = (todayClassesList || []).map((s) => s.id);
  const { data: todayBookings } =
    todayListSessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id, status")
          .in("session_id", todayListSessionIds)
          .eq("status", "confirmed")
      : { data: [] };

  const confirmedBySession = (todayBookings || []).reduce((acc, b) => {
    if (b.status === "confirmed") {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Recent activity: bookings (booked/cancelled) + member signups
  const { data: recentBookings } = await supabase
    .from("bookings")
    .select(
      `
      id,
      created_at,
      status,
      members (
        profiles (full_name)
      ),
      class_sessions (
        session_date,
        classes (name)
      )
    `
    )
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false })
    .limit(15);

  const { data: recentMembers } = await supabase
    .from("members")
    .select(
      `
      id,
      created_at,
      profiles (full_name)
    `
    )
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false })
    .limit(10);

  type ActivityItem = {
    created_at: string;
    type: "booked" | "cancelled" | "member_joined";
    label: string;
  };

  const activities: ActivityItem[] = [];

  (recentBookings || []).forEach((b) => {
    const members = b.members as { profiles?: { full_name?: string } } | null;
    const session = b.class_sessions as {
      session_date?: string;
      classes?: { name?: string };
    } | null;
    const rawSession = Array.isArray(session) ? session[0] : session;
    const rawMembers = Array.isArray(members) ? members[0] : members;
    const classesRef = rawSession?.classes;
    const className =
      (classesRef && !Array.isArray(classesRef)
        ? (classesRef as { name?: string }).name
        : undefined) || "—";
    const memberName =
      (rawMembers?.profiles && !Array.isArray(rawMembers.profiles)
        ? (rawMembers.profiles as { full_name?: string }).full_name
        : undefined) || "Unknown";
    const dateStr = rawSession?.session_date
      ? formatDate(rawSession.session_date).replace(/, \d{4}$/, "")
      : "—";

    if (b.status === "cancelled") {
      activities.push({
        created_at: b.created_at,
        type: "cancelled",
        label: `${memberName} cancelled ${className} - ${dateStr}`,
      });
    } else {
      activities.push({
        created_at: b.created_at,
        type: "booked",
        label: `${memberName} booked ${className} - ${dateStr}`,
      });
    }
  });

  (recentMembers || []).forEach((m) => {
    const profiles = m.profiles as { full_name?: string } | null;
    const raw = Array.isArray(profiles) ? profiles[0] : profiles;
    const name = raw?.full_name || "Someone";
    activities.push({
      created_at: m.created_at,
      type: "member_joined",
      label: `${name} joined as a member`,
    });
  });

  activities.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const topActivities = activities.slice(0, 10);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {profile?.full_name || "there"}!
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm font-medium text-gray-500">Active Members</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {activeMembersCount ?? 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">
            Today&apos;s Classes
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {todayClassesCount}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">
            Today&apos;s Bookings
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {todayBookingsCount ?? 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">
            This Month&apos;s Revenue
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCurrency(monthRevenue)}
          </p>
        </div>
      </div>

      {/* Today's classes */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Today&apos;s Classes
        </h2>
        <div className="card overflow-hidden p-0">
          {todayClassesList && todayClassesList.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {todayClassesList.map((session) => {
                const className =
                  (session as { classes?: { name?: string } }).classes?.name ||
                  "—";
                const confirmed =
                  confirmedBySession[session.id] || 0;
                return (
                  <Link
                    key={session.id}
                    href={`/bookings/${session.id}`}
                    className="block px-6 py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{className}</p>
                        <p className="text-sm text-gray-500">
                          {formatTime(session.start_time)}
                        </p>
                      </div>
                      <span className="text-sm text-gray-600">
                        {confirmed}/{session.capacity}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                No classes scheduled for today.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Recent Activity
        </h2>
        <div className="card overflow-hidden p-0">
          {topActivities.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {topActivities.map((a, i) => (
                <div
                  key={`${a.type}-${a.created_at}-${i}`}
                  className="flex items-center gap-3 px-6 py-3"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      a.type === "booked"
                        ? "bg-green-100 text-green-600"
                        : a.type === "cancelled"
                          ? "bg-red-100 text-red-600"
                          : "bg-brand-100 text-brand-600"
                    }`}
                  >
                    {a.type === "booked" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    ) : a.type === "cancelled" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{a.label}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No recent activity.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
