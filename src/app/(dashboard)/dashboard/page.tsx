import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  formatDate,
  formatTime,
  formatCurrency,
} from "@/lib/utils";
import { getOwnerSetupTasks } from "@/lib/setup-tasks";
import { ActivityFeedSection } from "@/components/dashboard/activity/activity-feed-section";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import type { ActivityRole, ManagerPerms } from "@/lib/activity/types";
import SetupChecklistCard from "@/components/ui/setup-checklist-card";
import SampleDataInvite from "@/components/ui/sample-data-invite";
import ContextHelpLink from "@/components/help/context-help-link";
import { TimeOfDayGreeting } from "@/components/ui/time-of-day-greeting";
import type { SetupTask } from "@/components/ui/setup-task-list";
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
    redirect("/login");
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
    .select("id, full_name, studio_id, role, onboarding_completed, activity_feed_prefs, dashboard_prefs")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  // マネージャーの権限情報を取得
  let managerPerms: Record<string, boolean> | null = null;
  if (profile.role === "manager") {
    const { data: mgr } = await supabase
      .from("managers")
      .select("can_manage_members, can_manage_classes, can_manage_bookings, can_manage_rooms, can_view_payments, can_send_messages, can_manage_instructors, can_teach, can_manage_settings")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    managerPerms = mgr as Record<string, boolean> | null;
  }
  const isOwner = profile.role === "owner";
  const canViewPayments = isOwner || managerPerms?.can_view_payments;
  const canManageMembers = isOwner || managerPerms?.can_manage_members;
  const canManageClasses = isOwner || managerPerms?.can_manage_classes;
  const canManageBookings = isOwner || managerPerms?.can_manage_bookings;

  const dashboardPrefs =
    (profile as { dashboard_prefs?: Record<string, unknown> | null }).dashboard_prefs ?? {};
  const setupChecklistDismissed =
    (dashboardPrefs as { setup_checklist_dismissed?: boolean })
      .setup_checklist_dismissed === true;

  // オーナー向け: Setup Checklist 用の studio 情報を取得。
  // 課金ステータス (past_due/grace/trial) は dashboard layout の
  // PlanBanner / TrialBanner で表示されるので、このページでは扱わない。
  let setupTasks: SetupTask[] = [];
  let setupGuideHref: string | null = null;
  if (isOwner) {
    const { data: studioInfo } = await supabase
      .from("studios")
      .select(
        "stripe_connect_onboarding_complete, stripe_subscription_id, payout_model",
      )
      .eq("id", profile.studio_id)
      .single();
    const info = studioInfo as {
      stripe_connect_onboarding_complete?: boolean;
      stripe_subscription_id?: string | null;
      payout_model?: string | null;
    } | null;

    const onboardingCompleted =
      (profile as { onboarding_completed?: boolean }).onboarding_completed ?? true;
    setupTasks = await getOwnerSetupTasks(
      supabase,
      profile.studio_id,
      info,
      onboardingCompleted,
    );
    setupGuideHref =
      info?.payout_model === "instructor_direct" ? "/settings/collective-setup" : null;
  }

  // Activity feed widget needs the studio's alert thresholds.
  const { data: studioForActivity } = await supabase
    .from("studios")
    .select("id, activity_feed_settings")
    .eq("id", profile.studio_id)
    .single();

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
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
    .select("amount, payment_type, type")
    .eq("studio_id", profile.studio_id)
    .eq("status", "paid")
    .gte("paid_at", `${monthStart}T00:00:00Z`)
    .lt("paid_at", `${nextMonthStart}T00:00:00Z`);

  const monthRevenue =
    paidPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;

  // 5. Previous month revenue (for comparison)
  const { data: prevMonthPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("studio_id", profile.studio_id)
    .eq("status", "paid")
    .gte("paid_at", `${prevMonthStart}T00:00:00Z`)
    .lt("paid_at", `${monthStart}T00:00:00Z`);

  const prevMonthRevenue =
    prevMonthPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;

  // 6. Revenue breakdown for this month (Subscriptions, Class Packs, Drop-ins)
  const subscriptionTypes = ["subscription", "monthly"];
  const classPackTypes = ["pack_5", "pack_10"];

  const revenueBreakdown = {
    subscriptions:
      paidPayments
        ?.filter(
          (p) =>
            subscriptionTypes.includes(p.payment_type ?? "") ||
            subscriptionTypes.includes(p.type ?? "")
        )
        .reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0,
    classPacks:
      paidPayments
        ?.filter(
          (p) =>
            classPackTypes.includes(p.payment_type ?? "") ||
            classPackTypes.includes(p.type ?? "")
        )
        .reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0,
    dropIns:
      paidPayments
        ?.filter(
          (p) =>
            (p.payment_type ?? p.type ?? "") === "drop_in"
        )
        .reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0,
  };

  // 7. Failed payments (status='failed')
  const { data: failedPayments } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      created_at,
      member_id,
      members (
        profiles (full_name, email)
      )
    `)
    .eq("studio_id", profile.studio_id)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(10);

  // Today's classes list (for display with booking counts)
  const { data: todayClassesList } = await supabase
    .from("class_sessions")
    .select("id, template_id, session_date, start_time, capacity, class_templates(name)")
    .eq("studio_id", profile.studio_id)
    .eq("session_date", today)
    .eq("is_cancelled", false)
    .order("start_time", { ascending: true });

  const todayListSessionIds = (todayClassesList || []).map((s) => s.id);
  const { data: todayBookings } =
    todayListSessionIds.length > 0
      ? await supabase
          .from("bookings")
          .select("session_id, status, attended")
          .in("session_id", todayListSessionIds)
          .eq("status", "confirmed")
      : { data: [] };

  const { data: todayDropIns } =
    todayListSessionIds.length > 0
      ? await supabase
          .from("drop_in_attendances")
          .select("session_id")
          .in("session_id", todayListSessionIds)
      : { data: [] };

  const confirmedBySession = (todayBookings || []).reduce((acc, b) => {
    if (b.status === "confirmed") {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const attendedBySession = (todayBookings || [])
    .filter((b) => b.attended)
    .reduce((acc, b) => {
      acc[b.session_id] = (acc[b.session_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const dropInBySession = (todayDropIns || []).reduce((acc, d) => {
    acc[d.session_id] = (acc[d.session_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Upcoming events with booking counts
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, status, max_total_capacity")
    .eq("studio_id", profile.studio_id)
    .in("status", ["published", "sold_out"])
    .gte("end_date", today)
    .order("start_date", { ascending: true })
    .limit(5);

  const upcomingEventIds = (upcomingEvents || []).map((e) => e.id);
  const { data: eventBookingCounts } =
    upcomingEventIds.length > 0
      ? await supabase
          .from("event_bookings")
          .select("event_id")
          .in("event_id", upcomingEventIds)
          .in("booking_status", ["pending_payment", "confirmed", "completed"])
      : { data: [] };

  const eventBookingMap = (eventBookingCounts || []).reduce(
    (acc, b) => {
      acc[b.event_id] = (acc[b.event_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const revenueChange =
    prevMonthRevenue > 0
      ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : monthRevenue > 0
        ? 100
        : null;

  const maxBarValue = Math.max(
    revenueBreakdown.subscriptions,
    revenueBreakdown.classPacks,
    revenueBreakdown.dropIns,
    1
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
            <ContextHelpLink href="/help/getting-started/studio-setup-overview" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            <TimeOfDayGreeting name={profile?.full_name} />
          </p>
        </div>
        {canManageClasses && (
          <Link
            href="/classes/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-brand-700 active:scale-[0.97]"
            data-tour="create-class-button"
          >
            + Create class
          </Link>
        )}
      </div>

      {/* Activity feed — primary signal, top of the page */}
      <div className="mb-10 md:mb-12">
        <ActivityFeedSection
          supabase={supabase}
          studio={
            studioForActivity ?? {
              id: profile.studio_id,
              activity_feed_settings: {},
            }
          }
          profile={{
            id: profile.id,
            role: profile.role as ActivityRole,
            activity_feed_prefs:
              (profile as { activity_feed_prefs?: Record<string, unknown> | null })
                .activity_feed_prefs ?? {},
          }}
          managerPerms={(managerPerms as ManagerPerms | null) ?? null}
          variant="widget"
        />
      </div>

      {/* Inline setup checklist for owners (hidden when complete or dismissed) */}
      {isOwner && setupTasks.length > 0 && !setupChecklistDismissed && (
        <SetupChecklistCard
          tasks={setupTasks}
          guideHref={setupGuideHref}
          dismissible
        />
      )}

      {/* Trial-period invite to seed sample data — only when the studio
          truly has nothing yet (no real classes AND no real members). */}
      {isOwner &&
        setupTasks.find((t) => t.id === "create-class")?.done === false &&
        setupTasks.find((t) => t.id === "add-member")?.done === false && (
          <SampleDataInvite />
        )}

      {/* past_due / grace / Stripe Connect statuses are surfaced once each:
          PlanBanner (rendered by the dashboard layout) for billing failures,
          and the inline SetupChecklistCard above for Stripe Connect. No
          duplicate banners here. */}

      {/* Stats — Revenue featured (tinted, larger type); secondary metrics compact */}
      <div
        className="flex flex-col gap-4 md:gap-5 lg:flex-row lg:items-stretch"
        data-tour="dashboard-stats"
      >
        {canViewPayments && (
          <div
            className="stats-stagger flex flex-col justify-between rounded-xl border border-brand-100 bg-brand-50/60 p-5 shadow-sm md:p-7 lg:flex-1 lg:basis-1/2"
            style={{ animationDelay: "0ms" }}
          >
            <p className="text-sm font-medium text-brand-800/80">
              This Month&apos;s Revenue
            </p>
            <div className="mt-3">
              <p className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
                {formatCurrency(monthRevenue)}
              </p>
              {revenueChange !== null ? (
                <p
                  className={`mt-2 text-sm ${revenueChange >= 0 ? "text-emerald-700" : "text-red-600"}`}
                >
                  {revenueChange >= 0 ? "↑" : "↓"} {Math.abs(revenueChange).toFixed(1)}%
                  <span className="ml-1 text-gray-500">vs last month</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">&mdash;</p>
              )}
            </div>
          </div>
        )}

        {(canManageMembers || canManageBookings) && (
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5 lg:basis-1/2">
            {canManageMembers && (
              <div
                className="stats-stagger card flex flex-col justify-between"
                style={{ animationDelay: "60ms" }}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Active Members
                </p>
                <p className="mt-3 text-2xl font-semibold text-gray-900 md:text-3xl">
                  {activeMembersCount ?? 0}
                </p>
              </div>
            )}
            <div
              className="stats-stagger card flex flex-col justify-between"
              style={{ animationDelay: "120ms" }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Today&apos;s Classes
              </p>
              <p className="mt-3 text-2xl font-semibold text-gray-900 md:text-3xl">
                {todayClassesCount}
              </p>
            </div>
            {canManageBookings && (
              <div
                className="stats-stagger card flex flex-col justify-between"
                style={{ animationDelay: "180ms" }}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Today&apos;s Bookings
                </p>
                <p className="mt-3 text-2xl font-semibold text-gray-900 md:text-3xl">
                  {todayBookingsCount ?? 0}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revenue breakdown */}
      {canViewPayments && <CollapsibleSection
        id="revenue-breakdown"
        title="Revenue Breakdown (This Month)"
      >
        <div className="card space-y-4">
          <div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Subscriptions</span>
              <span className="text-gray-900">
                {formatCurrency(revenueBreakdown.subscriptions)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="bar-grow h-full rounded-full bg-brand-500"
                style={{
                  width: `${(revenueBreakdown.subscriptions / maxBarValue) * 100}%`,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Class Packs</span>
              <span className="text-gray-900">
                {formatCurrency(revenueBreakdown.classPacks)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="bar-grow h-full rounded-full bg-emerald-500"
                style={{
                  width: `${(revenueBreakdown.classPacks / maxBarValue) * 100}%`,
                  animationDelay: "300ms",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Drop-ins</span>
              <span className="text-gray-900">
                {formatCurrency(revenueBreakdown.dropIns)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="bar-grow h-full rounded-full bg-amber-500"
                style={{
                  width: `${(revenueBreakdown.dropIns / maxBarValue) * 100}%`,
                  animationDelay: "400ms",
                }}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>}

      {/* Failed payments */}
      {canViewPayments && failedPayments && failedPayments.length > 0 && (
        <CollapsibleSection
          id="failed-payments"
          title="Failed Payments"
        >
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-gray-200">
              {failedPayments.map((p) => {
                const m = p.members as { profiles?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] } | null;
                const pf = Array.isArray(m?.profiles) ? m?.profiles[0] : m?.profiles;
                const isMemberPayment = !!p.member_id;
                const name = isMemberPayment
                  ? (pf?.full_name ?? "Member")
                  : "Studio plan";
                const memberEmail = isMemberPayment ? (pf?.email ?? null) : null;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(p.amount)} · {formatDate(p.created_at ?? "")}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      {isMemberPayment ? (
                        memberEmail ? (
                          <a
                            href={`mailto:${memberEmail}`}
                            className="underline transition-colors duration-150 hover:text-gray-600"
                          >
                            Contact member
                          </a>
                        ) : (
                          <span>Contact member to update card</span>
                        )
                      ) : (
                        <Link href="/settings/billing" className="underline transition-colors duration-150 hover:text-gray-600">
                          Update billing →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Today's classes */}
      <CollapsibleSection id="todays-classes" title="Today's Classes">
        <div className="card overflow-hidden p-0">
          {todayClassesList && todayClassesList.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {todayClassesList.map((session) => {
                const className =
                  (session as { class_templates?: { name?: string } }).class_templates?.name ||
                  "—";
                const confirmed =
                  confirmedBySession[session.id] || 0;
                const attended =
                  (attendedBySession[session.id] || 0) +
                  (dropInBySession[session.id] || 0);
                const classIdForLink =
                  (session as { template_id?: string }).template_id ?? "";
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 transition-colors duration-150 ease-out hover:bg-gray-50"
                  >
                    <Link
                      href={`/bookings/${session.id}`}
                      className="flex-1"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{className}</p>
                        <p className="text-sm text-gray-500">
                          {formatTime(session.start_time)}
                        </p>
                      </div>
                    </Link>
                    <div className="text-right text-xs text-gray-600 sm:text-sm">
                      Attended: {attended}/{confirmed} · {confirmed}/
                      {session.capacity} booked
                    </div>
                    {canManageBookings && (classIdForLink ? (
                      <Link
                        href={`/calendar/${classIdForLink}/sessions/${session.id}`}
                        className="shrink-0 text-sm text-blue-600 transition-colors duration-150 hover:text-blue-800"
                      >
                        Take Attendance →
                      </Link>
                    ) : (
                      <Link
                        href={`/bookings/${session.id}`}
                        className="shrink-0 text-sm text-blue-600 transition-colors duration-150 hover:text-blue-800"
                      >
                        View →
                      </Link>
                    ))}
                  </div>
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
      </CollapsibleSection>

      {/* Upcoming events */}
      {upcomingEvents && upcomingEvents.length > 0 && (
        <CollapsibleSection
          id="upcoming-events"
          title="Upcoming Events"
          actions={
            <Link
              href="/events"
              className="text-sm text-brand-600 transition-colors duration-150 hover:text-brand-700"
            >
              View all →
            </Link>
          }
        >
          <div className="card overflow-hidden p-0">
            <div className="divide-y divide-gray-200">
              {upcomingEvents.map((ev) => {
                const bookingCount = eventBookingMap[ev.id] || 0;
                return (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.id}/manage`}
                    className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 transition-colors duration-150 ease-out hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{ev.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(ev.start_date)} – {formatDate(ev.end_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {bookingCount}
                        {ev.max_total_capacity ? `/${ev.max_total_capacity}` : ""}{" "}
                        <span className="font-normal text-gray-500">bookings</span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </CollapsibleSection>
      )}

    </div>
  );
}
