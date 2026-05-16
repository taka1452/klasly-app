import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Member-facing pass freeze (T2-5).
 *
 *   POST /api/member/pass-freeze { subscriptionId, frozenUntil }
 *     Pause the pass. Bookings are blocked while frozen_at is set.
 *     frozenUntil is the date the member plans to come back (date
 *     string YYYY-MM-DD). The unfreeze cron will lift the hold on
 *     that date, or the member can unfreeze early with DELETE.
 *
 *   DELETE /api/member/pass-freeze?subscriptionId=<id>
 *     Unfreeze immediately. The period_end is shifted forward by the
 *     number of full days the pass was frozen so the member doesn't
 *     lose days they paid for.
 */
async function getMemberCtx() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
  return { supabase, userId: user.id };
}

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso);
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function shiftDateForward(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const ctx = await getMemberCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const subscriptionId =
    typeof body.subscriptionId === "string" ? body.subscriptionId : null;
  const frozenUntil =
    typeof body.frozenUntil === "string" && body.frozenUntil.trim()
      ? body.frozenUntil.trim()
      : null;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "subscriptionId is required" },
      { status: 400 }
    );
  }
  if (!frozenUntil) {
    return NextResponse.json(
      { error: "frozenUntil (YYYY-MM-DD) is required" },
      { status: 400 }
    );
  }
  if (frozenUntil <= new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: "frozenUntil must be a future date" },
      { status: 400 }
    );
  }

  // Verify the subscription belongs to this user via members.profile_id.
  const { data: sub } = await ctx.supabase
    .from("pass_subscriptions")
    .select(
      "id, member_id, status, frozen_at, current_period_end, members(profile_id)"
    )
    .eq("id", subscriptionId)
    .single();
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  const member = (Array.isArray(sub.members) ? sub.members[0] : sub.members) as
    | { profile_id?: string }
    | null;
  if (member?.profile_id !== ctx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (sub.status !== "active") {
    return NextResponse.json(
      { error: "Only active subscriptions can be frozen." },
      { status: 400 }
    );
  }
  if (sub.frozen_at) {
    return NextResponse.json(
      { error: "This pass is already frozen." },
      { status: 400 }
    );
  }
  if (sub.current_period_end && frozenUntil > sub.current_period_end) {
    return NextResponse.json(
      {
        error: `Hold cannot extend past your current pass expiry (${sub.current_period_end}).`,
      },
      { status: 400 }
    );
  }

  const { error } = await ctx.supabase
    .from("pass_subscriptions")
    .update({
      frozen_at: new Date().toISOString(),
      frozen_until: frozenUntil,
    })
    .eq("id", subscriptionId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const ctx = await getMemberCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get("subscriptionId");
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "subscriptionId is required" },
      { status: 400 }
    );
  }

  const { data: sub } = await ctx.supabase
    .from("pass_subscriptions")
    .select(
      "id, member_id, status, frozen_at, current_period_end, total_frozen_days, members(profile_id)"
    )
    .eq("id", subscriptionId)
    .single();
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  const member = (Array.isArray(sub.members) ? sub.members[0] : sub.members) as
    | { profile_id?: string }
    | null;
  if (member?.profile_id !== ctx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!sub.frozen_at) {
    return NextResponse.json(
      { error: "This pass is not frozen." },
      { status: 400 }
    );
  }

  // Shift current_period_end forward by the held duration so the member
  // doesn't lose days. Use full days only — partial days round down.
  const elapsed = daysBetween(sub.frozen_at, new Date());
  const updates: Record<string, unknown> = {
    frozen_at: null,
    frozen_until: null,
    total_frozen_days: (sub.total_frozen_days ?? 0) + elapsed,
  };
  if (sub.current_period_end && elapsed > 0) {
    updates.current_period_end = shiftDateForward(
      sub.current_period_end,
      elapsed
    );
  }

  const { error } = await ctx.supabase
    .from("pass_subscriptions")
    .update(updates)
    .eq("id", subscriptionId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, addedDays: elapsed });
}
