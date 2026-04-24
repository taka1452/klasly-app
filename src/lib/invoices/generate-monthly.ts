/**
 * Monthly instructor invoice generator.
 *
 * Bundles a single instructor's monthly obligations into one invoice:
 *   - tier subscription (instructor_membership_tiers.monthly_price)
 *   - overage charges within the period (instructor_overage_charges)
 *   - flat / per-class fees (class_fee_overrides + fee_schedules applied to
 *     class_sessions this instructor taught in the period)
 *
 * The generated row lives in instructor_invoices (status='draft'). Owners
 * review it, then POST /api/invoices/:id/send to mark it sent and email the
 * instructor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthPeriod = {
  year: number;
  /** 1-12 */
  month: number;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD (last day of month) */
  periodEnd: string;
};

export type FlatFeeItem = {
  source: "class_fee_override" | "fee_schedule";
  class_session_id: string;
  class_title: string | null;
  session_date: string;
  fee_type: "percentage" | "fixed";
  fee_value: number;
  /** Gross $ (cents) from this session that the fee applies to, if available. */
  gross_cents: number | null;
  /** Calculated fee amount in cents. */
  fee_cents: number;
};

export type InvoiceBreakdown = {
  studioId: string;
  instructorId: string;
  periodStart: string;
  periodEnd: string;
  tierName: string | null;
  tierChargeCents: number;
  overageChargeCents: number;
  overageChargeIds: string[];
  flatFeeCents: number;
  flatFeeItems: FlatFeeItem[];
  sessionCount: number;
  totalMinutes: number;
  totalCents: number;
};

/**
 * Given a month ("2026-04"), return start/end dates and parsed year/month.
 * Accepts YYYY-MM or YYYY-MM-DD.
 */
export function parseMonthPeriod(input: string): MonthPeriod {
  const m = input.match(/^(\d{4})-(\d{1,2})/);
  if (!m) throw new Error(`Invalid month format: ${input}`);
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year,
    month,
    periodStart: `${year}-${pad(month)}-01`,
    periodEnd: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
  };
}

/**
 * Build an invoice breakdown for a single instructor without writing it.
 * Use this to preview, then pass to saveInvoice() to persist.
 */
export async function computeInvoiceBreakdown(
  supabase: SupabaseClient,
  studioId: string,
  instructorId: string,
  period: MonthPeriod
): Promise<InvoiceBreakdown> {
  const { periodStart, periodEnd } = period;

  // --- 1. Tier subscription (latest active membership for the month) ---
  let tierName: string | null = null;
  let tierChargeCents = 0;

  const { data: membership } = await supabase
    .from("instructor_memberships")
    .select(
      "tier_id, status, instructor_membership_tiers(name, monthly_price)"
    )
    .eq("instructor_id", instructorId)
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    const rawTier = membership.instructor_membership_tiers as unknown;
    const tier = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as
      | { name: string; monthly_price: number | null }
      | null;
    if (tier) {
      tierName = tier.name ?? null;
      tierChargeCents = tier.monthly_price ?? 0;
    }
  }

  // --- 2. Overage charges within the period ---
  const { data: overages } = await supabase
    .from("instructor_overage_charges")
    .select("id, total_charge_cents, status")
    .eq("studio_id", studioId)
    .eq("instructor_id", instructorId)
    .gte("period_start", periodStart)
    .lte("period_end", periodEnd);

  const activeOverages = (overages || []).filter(
    (o) => o.status !== "waived" && o.status !== "void"
  );
  const overageChargeCents = activeOverages.reduce(
    (s, o) => s + (o.total_charge_cents || 0),
    0
  );
  const overageChargeIds = activeOverages.map((o) => o.id as string);

  // --- 3. Flat / per-class fees from sessions taught this period ---
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select(
      "id, title, session_date, duration_minutes, template_id, class_templates(price_cents)"
    )
    .eq("studio_id", studioId)
    .eq("instructor_id", instructorId)
    .eq("is_cancelled", false)
    .gte("session_date", periodStart)
    .lte("session_date", periodEnd);

  const sessionList = sessions || [];
  const sessionCount = sessionList.length;
  const totalMinutes = sessionList.reduce(
    (s, r) => s + (r.duration_minutes || 0),
    0
  );

  // Load per-class fee overrides for the templates we touched.
  const templateIds = Array.from(
    new Set(sessionList.map((s) => s.template_id).filter((v): v is string => !!v))
  );

  let overridesByTemplate = new Map<
    string,
    { fee_type: "percentage" | "fixed"; fee_value: number }
  >();

  if (templateIds.length > 0) {
    const { data: overrides } = await supabase
      .from("class_fee_overrides")
      .select("class_template_id, fee_type, fee_value")
      .in("class_template_id", templateIds);
    overridesByTemplate = new Map(
      (overrides || []).map((o) => [
        o.class_template_id as string,
        {
          fee_type: o.fee_type as "percentage" | "fixed",
          fee_value: o.fee_value as number,
        },
      ])
    );
  }

  // Load studio-wide fee schedules (time-window based) as fallback.
  const { data: schedules } = await supabase
    .from("fee_schedules")
    .select("day_of_week, start_time, end_time, fee_type, fee_value, priority")
    .eq("studio_id", studioId)
    .order("priority", { ascending: false });

  const flatFeeItems: FlatFeeItem[] = [];
  let flatFeeCents = 0;

  for (const s of sessionList) {
    const rawTemplate = s.class_templates as unknown;
    const tmpl = (Array.isArray(rawTemplate) ? rawTemplate[0] : rawTemplate) as
      | { price_cents: number | null }
      | null;
    const grossCents = tmpl?.price_cents ?? null;

    // Pick a fee: class override > schedule match > nothing.
    let applied: {
      source: "class_fee_override" | "fee_schedule";
      fee_type: "percentage" | "fixed";
      fee_value: number;
    } | null = null;

    if (s.template_id && overridesByTemplate.has(s.template_id)) {
      const o = overridesByTemplate.get(s.template_id)!;
      applied = {
        source: "class_fee_override",
        fee_type: o.fee_type,
        fee_value: o.fee_value,
      };
    } else if (schedules && schedules.length > 0) {
      // schedule match: day-of-week + time window
      const sessionDate = new Date(`${s.session_date}T00:00:00Z`);
      const dow = sessionDate.getUTCDay(); // 0=Sun
      // Sessions don't always have start_time in this query, but we kept the
      // default schedule match simple: match only day-of-week if time-window
      // info missing. Fee schedules with day_of_week = NULL match every day.
      const match = schedules.find(
        (sc) =>
          sc.day_of_week === null ||
          sc.day_of_week === undefined ||
          sc.day_of_week === dow
      );
      if (match) {
        applied = {
          source: "fee_schedule",
          fee_type: match.fee_type as "percentage" | "fixed",
          fee_value: match.fee_value as number,
        };
      }
    }

    if (!applied) continue;

    let feeCents = 0;
    if (applied.fee_type === "percentage" && grossCents !== null) {
      feeCents = Math.round((grossCents * applied.fee_value) / 100);
    } else if (applied.fee_type === "fixed") {
      feeCents = Math.round(applied.fee_value);
    }

    flatFeeCents += feeCents;
    flatFeeItems.push({
      source: applied.source,
      class_session_id: s.id as string,
      class_title: (s.title as string) ?? null,
      session_date: s.session_date as string,
      fee_type: applied.fee_type,
      fee_value: applied.fee_value,
      gross_cents: grossCents,
      fee_cents: feeCents,
    });
  }

  const totalCents = tierChargeCents + overageChargeCents + flatFeeCents;

  return {
    studioId,
    instructorId,
    periodStart,
    periodEnd,
    tierName,
    tierChargeCents,
    overageChargeCents,
    overageChargeIds,
    flatFeeCents,
    flatFeeItems,
    sessionCount,
    totalMinutes,
    totalCents,
  };
}

/** Persist a computed breakdown as a draft invoice. Upserts on unique key. */
export async function saveDraftInvoice(
  supabase: SupabaseClient,
  breakdown: InvoiceBreakdown,
  createdBy: string | null
) {
  const { data, error } = await supabase
    .from("instructor_invoices")
    .upsert(
      {
        studio_id: breakdown.studioId,
        instructor_id: breakdown.instructorId,
        period_start: breakdown.periodStart,
        period_end: breakdown.periodEnd,
        tier_name: breakdown.tierName,
        tier_charge_cents: breakdown.tierChargeCents,
        overage_charge_cents: breakdown.overageChargeCents,
        flat_fee_cents: breakdown.flatFeeCents,
        adjustments_cents: 0,
        total_cents: breakdown.totalCents,
        session_count: breakdown.sessionCount,
        total_minutes: breakdown.totalMinutes,
        overage_charge_ids: breakdown.overageChargeIds,
        flat_fee_items: breakdown.flatFeeItems,
        status: "draft",
        created_by: createdBy,
      },
      { onConflict: "studio_id,instructor_id,period_start,period_end" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
