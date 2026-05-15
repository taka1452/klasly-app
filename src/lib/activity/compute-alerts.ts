import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityEvent, AlertThresholds } from "./types";

interface ComputeAlertsOptions {
  supabase: SupabaseClient;
  studioId: string;
  thresholds: AlertThresholds;
}

export async function computeAlertEvents(
  opts: ComputeAlertsOptions,
): Promise<ActivityEvent[]> {
  const [
    inactive,
    failedPayments,
    unsignedWaivers,
    stuckContracts,
    connectIncomplete,
  ] = await Promise.all([
    computeInactiveMembers(opts),
    computeFailedPayments(opts),
    computeUnsignedWaivers(opts),
    computeStuckContracts(opts),
    computeConnectIncomplete(opts),
  ]);
  return [
    ...inactive,
    ...failedPayments,
    ...unsignedWaivers,
    ...stuckContracts,
    ...connectIncomplete,
  ];
}

async function computeConnectIncomplete({
  supabase,
  studioId,
}: ComputeAlertsOptions): Promise<ActivityEvent[]> {
  // Only relevant when the studio uses Collective Mode (instructors take
  // payments directly through Stripe Connect). Studio Mode collects via the
  // studio's own account, so an instructor's Connect status doesn't matter.
  const { data: studio } = await supabase
    .from("studios")
    .select("payout_model")
    .eq("id", studioId)
    .single();
  if ((studio as { payout_model?: string } | null)?.payout_model !== "instructor_direct") {
    return [];
  }

  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("instructors")
    .select(
      `id, created_at, profile_id, profiles:profile_id ( full_name )`,
    )
    .eq("studio_id", studioId)
    .eq("stripe_onboarding_complete", false)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as InstructorRow[]).map((r) => ({
    id: `alert-connect-${r.id}`,
    category: "alert",
    severity: "warning",
    title: `${r.profiles?.full_name ?? "An instructor"}: Stripe Connect incomplete`,
    subtitle: `Invited ${r.created_at.slice(0, 10)} — payouts on hold`,
    occurredAt: r.created_at,
    actionRequired: true,
    ctaLabel: "View instructors",
    ctaHref: "/dashboard/instructors",
    scope: { instructorId: r.profile_id ?? null },
  }));
}

interface InstructorRow {
  id: string;
  created_at: string;
  profile_id: string | null;
  profiles: { full_name?: string | null } | null;
}

async function computeInactiveMembers({
  supabase,
  studioId,
  thresholds,
}: ComputeAlertsOptions): Promise<ActivityEvent[]> {
  const cutoff = new Date(
    Date.now() - thresholds.inactive_member_days * 86_400_000,
  );
  const cutoffWeek = isoWeek(cutoff);

  const { data, error } = await supabase
    .from("members")
    .select(
      `id, profile_id, last_attended_week, joined_at, lifetime_classes_attended,
       profiles:profile_id ( full_name )`,
    )
    .eq("studio_id", studioId)
    .eq("status", "active")
    .gt("lifetime_classes_attended", 0)
    .limit(200);

  if (error || !data) return [];

  const events: ActivityEvent[] = [];
  for (const m of data as unknown as MemberRow[]) {
    const last = m.last_attended_week;
    if (!last) continue;
    if (last >= cutoffWeek) continue;

    const name = m.profiles?.full_name ?? "A member";
    events.push({
      id: `alert-inactive-${m.id}`,
      category: "alert",
      severity: "critical",
      title: `${name} hasn't attended in ${thresholds.inactive_member_days}+ days`,
      subtitle: `Last seen: week of ${last}`,
      occurredAt: cutoff.toISOString(),
      actionRequired: true,
      ctaLabel: "Send a message",
      ctaHref: `/dashboard/members/${m.id}`,
      scope: { memberId: m.profile_id ?? null },
    });
  }
  return events;
}

async function computeFailedPayments({
  supabase,
  studioId: _studioId,
  thresholds,
}: ComputeAlertsOptions): Promise<ActivityEvent[]> {
  const cutoff = new Date(
    Date.now() - thresholds.unpaid_grace_days * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("event_payment_schedule")
    .select(`id, status, amount_cents, due_date, created_at`)
    .eq("status", "failed")
    .lte("due_date", new Date().toISOString().slice(0, 10))
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as PaymentRow[])
    .filter((r) => r.created_at <= cutoff || (r.due_date ?? "") <= cutoff)
    .map((r) => ({
      id: `alert-failed-payment-${r.id}`,
      category: "billing",
      severity: "critical",
      title: `Payment of $${(r.amount_cents / 100).toFixed(2)} failed`,
      subtitle: r.due_date ? `Due ${r.due_date}` : undefined,
      occurredAt: r.created_at,
      actionRequired: true,
      ctaLabel: "View payments",
      ctaHref: "/dashboard/payments",
    }));
}

async function computeUnsignedWaivers({
  supabase,
  studioId,
  thresholds,
}: ComputeAlertsOptions): Promise<ActivityEvent[]> {
  const cutoff = new Date(
    Date.now() - thresholds.waiver_unsigned_after_days * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("members")
    .select(
      `id, profile_id, waiver_signed, joined_at, status,
       profiles:profile_id ( full_name )`,
    )
    .eq("studio_id", studioId)
    .eq("waiver_signed", false)
    .eq("status", "active")
    .lt("joined_at", cutoff)
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as MemberRow[]).map((m) => ({
    id: `alert-unsigned-waiver-${m.id}`,
    category: "alert",
    severity: "warning",
    title: `${m.profiles?.full_name ?? "A member"} hasn't signed the waiver`,
    subtitle: `Joined ${m.joined_at?.slice(0, 10) ?? ""} — ${thresholds.waiver_unsigned_after_days}+ days ago`,
    occurredAt: m.joined_at ?? new Date().toISOString(),
    actionRequired: true,
    ctaLabel: "Send waiver",
    ctaHref: `/dashboard/members/${m.id}`,
    scope: { memberId: m.profile_id ?? null },
  }));
}

async function computeStuckContracts({
  supabase,
  studioId,
  thresholds,
}: ComputeAlertsOptions): Promise<ActivityEvent[]> {
  const cutoff = new Date(
    Date.now() - thresholds.contract_stuck_days * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("contract_envelopes")
    .select(`id, title, status, created_at`)
    .eq("studio_id", studioId)
    .eq("status", "in_progress")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as ContractRow[]).map((r) => ({
    id: `alert-stuck-contract-${r.id}`,
    category: "alert",
    severity: "warning",
    title: `Contract "${r.title}" awaiting signatures`,
    subtitle: `In progress since ${r.created_at.slice(0, 10)}`,
    occurredAt: r.created_at,
    ctaLabel: "Open contract",
    ctaHref: "/dashboard/contracts",
  }));
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface MemberRow {
  id: string;
  profile_id: string | null;
  last_attended_week: string | null;
  joined_at: string | null;
  lifetime_classes_attended?: number | null;
  waiver_signed?: boolean | null;
  status?: string | null;
  profiles: { full_name?: string | null } | null;
}

interface PaymentRow {
  id: string;
  status: string;
  amount_cents: number;
  due_date: string | null;
  created_at: string;
}

interface ContractRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
}
