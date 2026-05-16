import type { SupabaseClient } from "@supabase/supabase-js";

type Scope = "all" | "class" | "event" | "membership" | "contract";
type Context = "class_booking" | "event_booking" | "membership" | "contract_invoice";

type DiscountCodeRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  scope: Scope;
  member_tag: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  one_time_per_member: boolean;
  is_active: boolean;
};

type Resolved =
  | { ok: true; code: DiscountCodeRow; amountOffCents: number; finalAmountCents: number }
  | { ok: false; reason: string };

const SCOPE_TO_CONTEXT: Record<Context, Scope[]> = {
  class_booking: ["all", "class"],
  event_booking: ["all", "event"],
  membership: ["all", "membership"],
  contract_invoice: ["all", "contract"],
};

function computeOff(code: DiscountCodeRow, amountCents: number): number {
  if (code.discount_type === "percent") {
    return Math.min(
      amountCents,
      Math.round((amountCents * code.discount_value) / 100)
    );
  }
  return Math.min(amountCents, code.discount_value);
}

/**
 * Look up a code, validate it, and return how much to subtract.
 * Either `codeInput` (typed by the attendee) OR `memberTags` (for
 * auto-apply) must be provided. When both are present, codeInput wins
 * so the attendee can override the auto-applied code.
 *
 * This does NOT increment used_count or write a redemption row — call
 * `recordDiscountRedemption` after the payment actually succeeds (most
 * cleanly: in the Stripe webhook).
 */
export async function resolveDiscountCode(
  supabase: SupabaseClient,
  args: {
    studioId: string;
    memberId: string | null;
    memberTags?: string[];
    amountCents: number;
    context: Context;
    codeInput?: string | null;
  }
): Promise<Resolved> {
  const { studioId, memberId, amountCents, context, codeInput } = args;
  const memberTags = (args.memberTags || []).map((t) => t.toLowerCase());

  let row: DiscountCodeRow | null = null;
  if (codeInput && codeInput.trim()) {
    const { data } = await supabase
      .from("studio_discount_codes")
      .select(
        "id, code, discount_type, discount_value, scope, member_tag, expires_at, usage_limit, used_count, one_time_per_member, is_active"
      )
      .eq("studio_id", studioId)
      .eq("code", codeInput.trim().toUpperCase())
      .maybeSingle();
    row = (data as DiscountCodeRow) ?? null;
    if (!row) return { ok: false, reason: "Code not found" };
  } else if (memberTags.length > 0) {
    // Auto-apply: pick the best matching active code by member tag.
    const { data } = await supabase
      .from("studio_discount_codes")
      .select(
        "id, code, discount_type, discount_value, scope, member_tag, expires_at, usage_limit, used_count, one_time_per_member, is_active"
      )
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .in("member_tag", memberTags)
      .in("scope", SCOPE_TO_CONTEXT[context]);
    const candidates = (data as DiscountCodeRow[]) ?? [];
    if (candidates.length === 0) return { ok: false, reason: "No matching tag-coded discount" };
    // Pick the largest dollar discount on this amount
    let best: DiscountCodeRow | null = null;
    let bestOff = -1;
    for (const c of candidates) {
      const off = computeOff(c, amountCents);
      if (off > bestOff) {
        best = c;
        bestOff = off;
      }
    }
    row = best;
  } else {
    return { ok: false, reason: "No code provided" };
  }

  if (!row) return { ok: false, reason: "No code resolved" };

  if (!row.is_active) return { ok: false, reason: "Code is inactive" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "Code has expired" };
  }
  if (row.usage_limit !== null && row.used_count >= row.usage_limit) {
    return { ok: false, reason: "Code has reached its usage limit" };
  }
  if (!SCOPE_TO_CONTEXT[context].includes(row.scope)) {
    return { ok: false, reason: "Code does not apply to this purchase" };
  }
  if (row.one_time_per_member && memberId) {
    const { count } = await supabase
      .from("studio_discount_redemptions")
      .select("id", { head: true, count: "exact" })
      .eq("discount_code_id", row.id)
      .eq("member_id", memberId);
    if ((count ?? 0) > 0) {
      return { ok: false, reason: "You've already used this code" };
    }
  }

  const off = computeOff(row, amountCents);
  return {
    ok: true,
    code: row,
    amountOffCents: off,
    finalAmountCents: Math.max(0, amountCents - off),
  };
}

/**
 * Record a successful redemption + bump used_count. Call this after the
 * charge actually settles (Stripe webhook or right after a synchronous
 * paid action).
 *
 * Note: used_count is read-then-written here — under heavy concurrency
 * this could undercount. Acceptable for studio-scale traffic; if it
 * becomes an issue, replace with an RPC that does the increment in
 * Postgres atomically.
 */
export async function recordDiscountRedemption(
  supabase: SupabaseClient,
  args: {
    studioId: string;
    discountCodeId: string;
    memberId: string | null;
    amountOffCents: number;
    context: Context;
    contextId: string | null;
  }
): Promise<void> {
  await supabase.from("studio_discount_redemptions").insert({
    studio_id: args.studioId,
    discount_code_id: args.discountCodeId,
    member_id: args.memberId,
    amount_off_cents: args.amountOffCents,
    context: args.context,
    context_id: args.contextId,
  });

  const { data: current } = await supabase
    .from("studio_discount_codes")
    .select("used_count")
    .eq("id", args.discountCodeId)
    .single();
  if (current) {
    await supabase
      .from("studio_discount_codes")
      .update({ used_count: (current.used_count ?? 0) + 1 })
      .eq("id", args.discountCodeId);
  }
}
