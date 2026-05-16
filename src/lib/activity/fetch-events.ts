import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAlertEvents } from "./compute-alerts";
import type {
  ActivityEvent,
  ActivityRole,
  AlertThresholds,
  ManagerPerms,
} from "./types";

export interface FetchActivityOptions {
  supabase: SupabaseClient;
  studioId: string;
  role: ActivityRole;
  viewerProfileId: string;
  managerPerms?: ManagerPerms | null;
  thresholds: AlertThresholds;
  lookbackDays?: number;
  limit?: number;
}

const PER_SOURCE_LIMIT = 100;

export async function fetchActivityEvents(
  opts: FetchActivityOptions,
): Promise<ActivityEvent[]> {
  const lookbackDays = opts.lookbackDays ?? 30;
  const sinceDate = new Date(Date.now() - lookbackDays * 86_400_000);
  const since = sinceDate.toISOString();

  const [
    bookings,
    drops,
    passes,
    members,
    classChanges,
    reviews,
    waivers,
    contracts,
    announcements,
    roomBookings,
    payments,
    overages,
    invoices,
    alerts,
  ] = await Promise.all([
    fetchBookingEvents(opts.supabase, opts.studioId, since),
    fetchDropInEvents(opts.supabase, opts.studioId, since),
    fetchPassPurchaseEvents(opts.supabase, opts.studioId, since),
    fetchMemberJoinedEvents(opts.supabase, opts.studioId, since),
    fetchClassChangeEvents(opts.supabase, opts.studioId, since),
    fetchReviewEvents(opts.supabase, opts.studioId, since),
    fetchWaiverEvents(opts.supabase, opts.studioId, since),
    fetchContractEvents(opts.supabase, opts.studioId, since),
    fetchAnnouncementEvents(opts.supabase, opts.studioId, since),
    fetchRoomBookingEvents(opts.supabase, opts.studioId, since),
    fetchPaymentEvents(opts.supabase, opts.studioId, since),
    fetchOverageChargeEvents(opts.supabase, opts.studioId, since),
    fetchInstructorInvoiceEvents(opts.supabase, opts.studioId, since),
    computeAlertEvents({
      supabase: opts.supabase,
      studioId: opts.studioId,
      thresholds: opts.thresholds,
    }),
  ]);

  const all: ActivityEvent[] = [
    ...bookings,
    ...drops,
    ...passes,
    ...members,
    ...classChanges,
    ...reviews,
    ...waivers,
    ...contracts,
    ...announcements,
    ...roomBookings,
    ...payments,
    ...overages,
    ...invoices,
    ...alerts,
  ];

  all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const visible = all.filter((e) => isVisibleForRole(e, opts));

  return typeof opts.limit === "number" ? visible.slice(0, opts.limit) : visible;
}

function isVisibleForRole(
  event: ActivityEvent,
  opts: FetchActivityOptions,
): boolean {
  const { role, viewerProfileId, managerPerms } = opts;

  if (role === "owner") return true;

  if (role === "member") {
    return event.scope?.memberId
      ? event.scope.memberId === viewerProfileId
      : event.category === "announcement";
  }

  if (role === "instructor") {
    if (event.category === "announcement") return true;
    if (event.scope?.instructorId === viewerProfileId) return true;
    if (event.category === "operations") return true;
    return false;
  }

  if (role === "manager") {
    const p = managerPerms ?? {};
    switch (event.category) {
      case "booking":
        return !!p.can_manage_bookings;
      case "billing":
        return !!p.can_view_payments;
      case "operations":
        return !!p.can_manage_classes || !!p.can_manage_rooms;
      case "member":
        return !!p.can_manage_members;
      case "announcement":
        return !!p.can_send_messages;
      case "alert":
        return true;
      default:
        return false;
    }
  }

  return false;
}

function pickName(row: { profiles?: { full_name?: string | null } | null }):
  | string
  | undefined {
  return row.profiles?.full_name ?? undefined;
}

function bookingTitle(
  memberName: string | null | undefined,
  className: string | null | undefined,
): string {
  const who = memberName ?? "A member";
  const what = className ?? "a session";
  return `${who} booked ${what}`;
}

function formatSession(
  sessionDate: string | null | undefined,
  startTime: string | null | undefined,
  className: string | null | undefined,
): string | undefined {
  const parts: string[] = [];
  if (sessionDate) parts.push(sessionDate);
  if (startTime) parts.push(startTime);
  if (className) parts.push(className);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

async function fetchBookingEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, status, attendance_status, created_at, member_id, session_id,
       members:member_id ( profile_id, profiles:profile_id ( full_name ) ),
       class_sessions:session_id (
         session_date, start_time, template_id, instructor_id,
         class_templates:template_id ( name )
       )`,
    )
    .eq("studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  const events: ActivityEvent[] = [];
  for (const r of data as unknown as RawBookingRow[]) {
    const memberName = pickName(r.members ?? {});
    const session = r.class_sessions;
    const className = session?.class_templates?.name;
    const sessionLine = formatSession(
      session?.session_date ?? null,
      session?.start_time ?? null,
      className ?? null,
    );
    const scope = {
      memberId: r.members?.profile_id ?? null,
      sessionId: r.session_id ?? null,
      instructorId: session?.instructor_id ?? null,
    };

    if (r.status === "confirmed" && r.attendance_status == null) {
      events.push({
        id: `booking-confirmed-${r.id}`,
        category: "booking",
        severity: "info",
        title: bookingTitle(memberName, className),
        subtitle: sessionLine,
        occurredAt: r.created_at,
        ctaLabel: "View bookings",
        ctaHref: "/bookings",
        scope,
      });
    } else if (r.status === "cancelled") {
      const isLate = r.attendance_status === "late_cancel";
      events.push({
        id: `booking-cancelled-${r.id}`,
        category: "booking",
        severity: isLate ? "warning" : "info",
        title: `${memberName ?? "A member"} cancelled ${className ?? "a session"}${isLate ? " (late)" : ""}`,
        subtitle: isLate
          ? "Late cancellation — within the 24h window"
          : sessionLine,
        occurredAt: r.created_at,
        scope,
      });
    }

    if (r.attendance_status === "no_show") {
      events.push({
        id: `booking-noshow-${r.id}`,
        category: "booking",
        severity: "warning",
        title: `${memberName ?? "A member"} was a no-show`,
        subtitle: sessionLine,
        occurredAt: r.created_at,
        scope,
      });
    }
  }
  return events;
}

async function fetchDropInEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("drop_in_attendances")
    .select(
      `id, created_at, attended_at, member_id, session_id,
       members:member_id ( profile_id, profiles:profile_id ( full_name ) ),
       class_sessions:session_id (
         session_date, start_time,
         class_templates:template_id ( name )
       )`,
    )
    .eq("studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawDropInRow[]).map((r) => ({
    id: `drop-in-${r.id}`,
    category: "booking" as const,
    severity: "success" as const,
    title: `${pickName(r.members ?? {}) ?? "A drop-in"} attended`,
    subtitle: formatSession(
      r.class_sessions?.session_date ?? null,
      r.class_sessions?.start_time ?? null,
      r.class_sessions?.class_templates?.name ?? null,
    ),
    occurredAt: r.created_at,
    scope: { memberId: r.members?.profile_id ?? null, sessionId: r.session_id ?? null },
  }));
}

async function fetchPassPurchaseEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("pass_subscriptions")
    .select(
      `id, status, created_at, current_period_end, member_id,
       members:member_id ( profile_id, profiles:profile_id ( full_name ) ),
       studio_passes:studio_pass_id!inner ( studio_id, name, price_cents, billing_interval )`,
    )
    .eq("studio_passes.studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawPassRow[]).map((r) => {
    const memberName = pickName(r.members ?? {}) ?? "A member";
    const passName = r.studio_passes?.name ?? "a pass";
    return {
      id: `pass-${r.id}`,
      category: "billing" as const,
      severity: "success" as const,
      title: `${memberName} purchased ${passName}`,
      subtitle: r.current_period_end
        ? `Period ends ${r.current_period_end}`
        : undefined,
      occurredAt: r.created_at,
      ctaLabel: "View passes",
      ctaHref: "/passes",
      scope: { memberId: r.members?.profile_id ?? null },
    };
  });
}

async function fetchMemberJoinedEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("members")
    .select(
      `id, joined_at, plan_type, profile_id,
       profiles:profile_id ( full_name )`,
    )
    .eq("studio_id", studioId)
    .gte("joined_at", since)
    .order("joined_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawMemberRow[]).map((r) => ({
    id: `member-joined-${r.id}`,
    category: "member" as const,
    severity: "success" as const,
    title: `${r.profiles?.full_name ?? "New member"} joined`,
    subtitle: r.plan_type ? `Plan: ${r.plan_type}` : undefined,
    occurredAt: r.joined_at,
    ctaLabel: "View member",
    ctaHref: `/members/${r.id}`,
    scope: { memberId: r.profile_id ?? null },
  }));
}

async function fetchClassChangeEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("class_audit_log")
    .select(
      `id, change_type, summary, created_at, template_id, session_id, actor_profile_id`,
    )
    .eq("studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  // For session_cancelled rows, batch lookup the session details so we can
  // surface "hours returned" vs "hours forfeited" attribution — Jamie's
  // contract-billing concern from the Round 8 thread.
  const auditRows = data as unknown as RawAuditRow[];
  const sessionIds = auditRows
    .filter((r) => r.change_type === "session_cancelled" && r.session_id)
    .map((r) => r.session_id as string);

  const sessionMeta = new Map<string, SessionCancelMeta>();
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select(
        `id, cancelled_by_role, hours_returned, instructor_id,
         instructors:instructor_id ( profile_id, profiles:profile_id ( full_name ) )`,
      )
      .in("id", sessionIds);
    if (sessions) {
      for (const s of sessions as unknown as RawSessionMetaRow[]) {
        sessionMeta.set(s.id, {
          cancelledByRole: s.cancelled_by_role ?? null,
          hoursReturned: s.hours_returned ?? null,
          instructorProfileId: s.instructors?.profile_id ?? null,
          instructorName: s.instructors?.profiles?.full_name ?? null,
        });
      }
    }
  }

  return auditRows.map((r) => {
    const meta = classifyChangeType(r.change_type);
    let subtitle: string | undefined;
    let severity = meta.severity;
    let instructorScope: string | null = null;

    if (r.change_type === "session_cancelled" && r.session_id) {
      const sm = sessionMeta.get(r.session_id);
      if (sm) {
        instructorScope = sm.instructorProfileId;
        const name = sm.instructorName ?? "Instructor";
        if (sm.cancelledByRole === "instructor") {
          severity = "warning";
          subtitle = sm.hoursReturned
            ? `Self-cancel by ${name} — hours returned`
            : `Self-cancel by ${name} — hours forfeited`;
        } else if (sm.cancelledByRole) {
          subtitle = sm.hoursReturned
            ? `Admin cancel — ${name}'s hours returned`
            : `Admin cancel — ${name}'s hours forfeited`;
        }
      }
    }

    return {
      id: `class-change-${r.id}`,
      category: meta.category,
      severity,
      title: r.summary || "Class updated",
      subtitle,
      occurredAt: r.created_at,
      ctaLabel: r.template_id ? "View class" : undefined,
      ctaHref: r.template_id ? `/classes/${r.template_id}` : undefined,
      scope: {
        templateId: r.template_id ?? null,
        sessionId: r.session_id ?? null,
        instructorId: instructorScope,
      },
    };
  });
}

function classifyChangeType(t: string): {
  category: ActivityEvent["category"];
  severity: ActivityEvent["severity"];
} {
  switch (t) {
    case "session_instructor_changed":
    case "template_instructor_changed":
    case "session_cancelled":
    case "session_date_changed":
    case "session_time_changed":
      return { category: "operations", severity: "warning" };
    case "session_hours_returned":
    case "template_price_changed":
    case "template_capacity_changed":
    case "template_duration_changed":
    case "template_updated":
    case "session_room_changed":
    default:
      return { category: "operations", severity: "info" };
  }
}

async function fetchOverageChargeEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("instructor_overage_charges")
    .select(
      `id, period_start, period_end, tier_name, overage_minutes,
       total_charge_cents, status, created_at, instructor_id,
       instructors:instructor_id ( profile_id, profiles:profile_id ( full_name ) )`,
    )
    .eq("studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawOverageRow[]).map((r) => {
    const name = r.instructors?.profiles?.full_name ?? "An instructor";
    const overageH = formatHours(r.overage_minutes / 60);
    const amount = `$${(r.total_charge_cents / 100).toFixed(2)}`;
    const paid = r.status === "paid";
    const waived = r.status === "waived";
    return {
      id: `overage-${r.id}`,
      category: "billing" as const,
      severity: paid ? "success" : waived ? "info" : "warning",
      title: `${name} went ${overageH} over ${r.tier_name}`,
      subtitle: `${amount} overage — ${formatPeriod(r.period_start)}`,
      occurredAt: r.created_at,
      actionRequired: !paid && !waived,
      ctaLabel: "View instructors",
      ctaHref: "/instructors",
      scope: { instructorId: r.instructors?.profile_id ?? null },
    };
  });
}

async function fetchInstructorInvoiceEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  // We surface two transitions: invoice was sent (sent_at) and invoice was
  // paid (paid_at). Both come from the same row, so this fetch covers both.
  const { data, error } = await supabase
    .from("instructor_invoices")
    .select(
      `id, period_start, period_end, total_cents, status, sent_at, paid_at,
       instructor_id,
       instructors:instructor_id ( profile_id, profiles:profile_id ( full_name ) )`,
    )
    .eq("studio_id", studioId)
    .or(`sent_at.gte.${since},paid_at.gte.${since}`)
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  const events: ActivityEvent[] = [];
  for (const r of data as unknown as RawInvoiceRow[]) {
    const name = r.instructors?.profiles?.full_name ?? "An instructor";
    const amount = `$${(r.total_cents / 100).toFixed(2)}`;
    const period = formatPeriod(r.period_start);
    const instructorScope = r.instructors?.profile_id ?? null;

    if (r.sent_at && r.sent_at >= since) {
      events.push({
        id: `invoice-sent-${r.id}`,
        category: "billing",
        severity: "info",
        title: `Invoice sent to ${name}`,
        subtitle: `${amount} for ${period}`,
        occurredAt: r.sent_at,
        ctaLabel: "View instructors",
        ctaHref: "/instructors",
        scope: { instructorId: instructorScope },
      });
    }
    if (r.paid_at && r.paid_at >= since) {
      events.push({
        id: `invoice-paid-${r.id}`,
        category: "billing",
        severity: "success",
        title: `${name}'s invoice paid`,
        subtitle: `${amount} for ${period}`,
        occurredAt: r.paid_at,
        ctaLabel: "View instructors",
        ctaHref: "/instructors",
        scope: { instructorId: instructorScope },
      });
    }
  }
  return events;
}

function formatHours(h: number): string {
  if (Number.isInteger(h)) return `${h}h`;
  const rounded = Math.round(h * 10) / 10;
  return `${rounded}h`;
}

function formatPeriod(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 7);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

async function fetchReviewEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("class_reviews")
    .select(
      `id, rating, comment, created_at, member_id, instructor_id, session_id,
       members:member_id ( profile_id, profiles:profile_id ( full_name ) )`,
    )
    .eq("studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawReviewRow[]).map((r) => {
    const stars = "★".repeat(Math.max(1, Math.min(5, r.rating)));
    const name = pickName(r.members ?? {}) ?? "A member";
    return {
      id: `review-${r.id}`,
      category: "member" as const,
      severity: r.rating <= 2 ? "warning" : "info",
      title: `${name} left a ${stars} review`,
      subtitle: r.comment ?? undefined,
      occurredAt: r.created_at,
      ctaLabel: "View review",
      ctaHref: "/reviews",
      scope: {
        memberId: r.members?.profile_id ?? null,
        instructorId: r.instructor_id ?? null,
        sessionId: r.session_id ?? null,
      },
    };
  });
}

async function fetchWaiverEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("waiver_signatures")
    .select(
      `id, signed_at, signed_name, member_id,
       members:member_id ( profile_id, profiles:profile_id ( full_name ) )`,
    )
    .eq("studio_id", studioId)
    .gte("signed_at", since)
    .not("signed_at", "is", null)
    .order("signed_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawWaiverRow[]).map((r) => ({
    id: `waiver-${r.id}`,
    category: "member" as const,
    severity: "info" as const,
    title: `${r.signed_name || pickName(r.members ?? {}) || "A member"} signed the waiver`,
    occurredAt: r.signed_at!,
    scope: { memberId: r.members?.profile_id ?? null },
  }));
}

async function fetchContractEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("contract_envelopes")
    .select(
      `id, title, status, created_at, completed_at, voided_at, instructor_id,
       instructors:instructor_id ( id, profile_id, profiles:profile_id ( full_name ) )`,
    )
    .eq("studio_id", studioId)
    .or(
      `completed_at.gte.${since},voided_at.gte.${since}`,
    )
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  const events: ActivityEvent[] = [];
  for (const r of data as unknown as RawContractRow[]) {
    const signerName = r.instructors?.profiles?.full_name;
    const instructorScope = r.instructors?.profile_id ?? null;

    if (r.status === "completed" && r.completed_at && r.completed_at >= since) {
      events.push({
        id: `contract-completed-${r.id}`,
        category: "member",
        severity: "success",
        title: `Contract "${r.title}" completed`,
        subtitle: signerName ? `Signer: ${signerName}` : undefined,
        occurredAt: r.completed_at,
        ctaLabel: "View contract",
        ctaHref: "/contracts",
        scope: { instructorId: instructorScope },
      });
    }
    if (r.status === "voided" && r.voided_at && r.voided_at >= since) {
      events.push({
        id: `contract-voided-${r.id}`,
        category: "member",
        severity: "warning",
        title: `Contract "${r.title}" voided`,
        subtitle: signerName ? `Signer: ${signerName}` : undefined,
        occurredAt: r.voided_at,
        ctaLabel: "View contract",
        ctaHref: "/contracts",
        scope: { instructorId: instructorScope },
      });
    }
  }
  return events;
}

async function fetchAnnouncementEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select(`id, title, body, created_at, created_by`)
    .eq("studio_id", studioId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawAnnouncementRow[]).map((r) => ({
    id: `announcement-${r.id}`,
    category: "announcement" as const,
    severity: "info" as const,
    title: `Announcement: "${r.title}"`,
    subtitle: r.body ? truncate(r.body, 100) : undefined,
    occurredAt: r.created_at,
    ctaLabel: "View",
    ctaHref: "/studio-announcements",
  }));
}

async function fetchRoomBookingEvents(
  supabase: SupabaseClient,
  studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_date, start_time, end_time, created_at, instructor_id, room_id,
       instructors:instructor_id ( profiles:profile_id ( full_name ) ),
       rooms:room_id ( name )`,
    )
    .eq("studio_id", studioId)
    .eq("session_type", "room_only")
    .is("template_id", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawRoomBookingRow[]).map((r) => {
    const who = r.instructors?.profiles?.full_name ?? "Someone";
    const where = r.rooms?.name ?? "a room";
    return {
      id: `room-booking-${r.id}`,
      category: "booking" as const,
      severity: "info" as const,
      title: `${who} booked ${where}`,
      subtitle: formatSession(r.session_date, r.start_time, null),
      occurredAt: r.created_at,
      ctaLabel: "View rooms",
      ctaHref: "/rooms",
      scope: { instructorId: r.instructor_id ?? null, sessionId: r.id },
    };
  });
}

async function fetchPaymentEvents(
  supabase: SupabaseClient,
  _studioId: string,
  since: string,
): Promise<ActivityEvent[]> {
  // event_payment_schedule has no studio_id; lookups for success events would
  // require a 3-hop join (schedule → event_bookings → events → studios).
  // Surface success on `paid_at` via a focused query — the schedule rows for
  // this studio are already returned by `getStudioEventBookings` elsewhere,
  // but for the feed we narrow by paid_at window and accept paid items only.
  const { data, error } = await supabase
    .from("event_payment_schedule")
    .select(`id, status, amount_cents, paid_at`)
    .eq("status", "paid")
    .gte("paid_at", since)
    .order("paid_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error || !data) return [];

  return (data as unknown as RawPaymentRow[]).map((r) => ({
    id: `payment-paid-${r.id}`,
    category: "billing" as const,
    severity: "success" as const,
    title: `Payment of ${formatCents(r.amount_cents)} received`,
    occurredAt: r.paid_at!,
    ctaLabel: "View payments",
    ctaHref: "/payments",
  }));
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ----- row types -----

type ProfilePart = { full_name?: string | null } | null;
type MemberPart = { profile_id?: string | null; profiles?: ProfilePart } | null;

interface RawBookingRow {
  id: string;
  status: string;
  attendance_status: string | null;
  created_at: string;
  member_id: string | null;
  session_id: string | null;
  members: MemberPart;
  class_sessions: {
    session_date?: string | null;
    start_time?: string | null;
    template_id?: string | null;
    instructor_id?: string | null;
    class_templates?: { name?: string | null } | null;
  } | null;
}

interface RawDropInRow {
  id: string;
  created_at: string;
  attended_at: string | null;
  member_id: string | null;
  session_id: string | null;
  members: MemberPart;
  class_sessions: {
    session_date?: string | null;
    start_time?: string | null;
    class_templates?: { name?: string | null } | null;
  } | null;
}

interface RawPassRow {
  id: string;
  status: string;
  created_at: string;
  current_period_end: string | null;
  member_id: string | null;
  members: MemberPart;
  studio_passes: {
    studio_id?: string | null;
    name?: string | null;
    price_cents?: number | null;
    billing_interval?: string | null;
  } | null;
}

interface RawMemberRow {
  id: string;
  joined_at: string;
  plan_type: string | null;
  profile_id: string | null;
  profiles: ProfilePart;
}

interface RawAuditRow {
  id: string;
  change_type: string;
  summary: string;
  created_at: string;
  template_id: string | null;
  session_id: string | null;
  actor_profile_id: string | null;
}

interface RawReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  member_id: string | null;
  instructor_id: string | null;
  session_id: string | null;
  members: MemberPart;
}

interface RawWaiverRow {
  id: string;
  signed_at: string | null;
  signed_name: string | null;
  member_id: string | null;
  members: MemberPart;
}

interface RawContractRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  voided_at: string | null;
  instructor_id: string | null;
  instructors: {
    id?: string;
    profile_id?: string | null;
    profiles?: ProfilePart;
  } | null;
}

interface RawAnnouncementRow {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  created_by: string | null;
}

interface RawRoomBookingRow {
  id: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  instructor_id: string | null;
  room_id: string | null;
  instructors: { profiles?: ProfilePart } | null;
  rooms: { name?: string | null } | null;
}

interface RawPaymentRow {
  id: string;
  status: string;
  amount_cents: number;
  paid_at: string | null;
}

interface SessionCancelMeta {
  cancelledByRole: string | null;
  hoursReturned: boolean | null;
  instructorProfileId: string | null;
  instructorName: string | null;
}

interface RawSessionMetaRow {
  id: string;
  cancelled_by_role: string | null;
  hours_returned: boolean | null;
  instructor_id: string | null;
  instructors: {
    profile_id?: string | null;
    profiles?: ProfilePart;
  } | null;
}

interface RawInvoiceRow {
  id: string;
  period_start: string;
  period_end: string;
  total_cents: number;
  status: string;
  sent_at: string | null;
  paid_at: string | null;
  instructor_id: string | null;
  instructors: {
    profile_id?: string | null;
    profiles?: ProfilePart;
  } | null;
}

interface RawOverageRow {
  id: string;
  period_start: string;
  period_end: string;
  tier_name: string;
  overage_minutes: number;
  total_charge_cents: number;
  status: string;
  created_at: string;
  instructor_id: string | null;
  instructors: {
    profile_id?: string | null;
    profiles?: ProfilePart;
  } | null;
}
