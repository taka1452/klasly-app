import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * POST /api/passes/admin-assign
 * オーナーがメンバーをパスに直接登録（Stripe なし、手動割り当て）
 * Body: { passId, memberId }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx || ctx.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const passEnabled = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { passId, memberId } = body;

    if (!passId || !memberId) {
      return NextResponse.json(
        { error: "passId and memberId are required" },
        { status: 400 }
      );
    }

    // パスがこのスタジオに属しているか確認
    const { data: pass } = await ctx.supabase
      .from("studio_passes")
      .select("id, name, is_active")
      .eq("id", passId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!pass || !pass.is_active) {
      return NextResponse.json({ error: "Pass not found or inactive" }, { status: 404 });
    }

    // メンバーがこのスタジオに属しているか確認
    const { data: member } = await ctx.supabase
      .from("members")
      .select("id, profile_id")
      .eq("id", memberId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // 既存のアクティブなサブスクリプションを確認
    const { data: existing } = await ctx.supabase
      .from("pass_subscriptions")
      .select("id")
      .eq("studio_pass_id", passId)
      .eq("member_id", memberId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "This member already has an active subscription to this pass." },
        { status: 400 }
      );
    }

    // 手動割り当て（Stripe サブスクリプションなし）
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const { data: subscription, error: insertError } = await ctx.supabase
      .from("pass_subscriptions")
      .insert({
        studio_pass_id: passId,
        member_id: memberId,
        status: "active",
        stripe_subscription_id: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        classes_used_this_period: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      passName: pass.name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
