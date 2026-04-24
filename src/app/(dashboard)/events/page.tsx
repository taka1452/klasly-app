import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import ContextHelpLink from "@/components/help/context-help-link";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import EmptyState from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
  published: { label: "Published", cls: "bg-green-100 text-green-700" },
  sold_out: { label: "Sold Out", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
};

export default async function EventsListPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) notFound();

  // マネージャー権限チェック（イベント管理は can_manage_bookings を使用）
  const permCheck = await checkManagerPermission("can_manage_bookings");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) notFound();

  const retreatEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.RETREAT_BOOKING);
  if (!retreatEnabled) redirect("/dashboard");

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, location_name, status, max_total_capacity, color")
    .eq("studio_id", profile.studio_id)
    .order("start_date", { ascending: false });

  // Get booking counts per event
  const eventIds = (events || []).map((e) => e.id);
  const { data: bookings } =
    eventIds.length > 0
      ? await supabase
          .from("event_bookings")
          .select("event_id")
          .in("event_id", eventIds)
          .in("booking_status", ["pending_payment", "confirmed", "completed"])
      : { data: [] };

  const bookingCounts = (bookings || []).reduce(
    (acc, b) => {
      acc[b.event_id] = (acc[b.event_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ContextHelpLink href="/help/events-retreats/create-retreat" />
        <Link href="/events/new" className="btn-primary">
          + Create Event
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create retreats, workshops, or multi-day events with room options and installment payments."
          actionLabel="+ Create event"
          actionHref="/events/new"
          helpHref="/help/events-retreats/create-retreat"
          helpLabel="How to create an event"
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-gray-200">
            {events.map((event) => {
              const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.draft;
              const count = bookingCounts[event.id] || 0;
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}/manage`}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-gray-50 md:px-6 md:py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/5"
                        style={{ background: event.color || "#d1d5db" }}
                        title={event.color ? `Color ${event.color}` : "Default color"}
                      />
                      <p className="truncate font-medium text-gray-900">
                        {event.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatDate(event.start_date)} – {formatDate(event.end_date)}
                      {event.location_name && ` · ${event.location_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {count}
                      {event.max_total_capacity
                        ? `/${event.max_total_capacity}`
                        : ""}{" "}
                      bookings
                    </span>
                    <span className="text-sm text-brand-600">Manage &rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
