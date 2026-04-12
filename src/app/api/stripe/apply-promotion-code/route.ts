import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";
import { logger } from "@/lib/logger";

/**
 * Studio owner applies a promotion code to their current subscription.
 * Requires owner role and existing Stripe subscription.
 */
export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schema = z.object({
      promotion_code: z.string().optional(),
      code: z.string().optional(),
    });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const code = (body.promotion_code ?? body.code ?? "").trim();
    if (!code) {
      return NextResponse.json({ error: "Promotion code is required" }, { status: 400 });
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_subscription_id")
      .eq("id", profile.studio_id)
      .single();

    if (!studio?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription to apply a code to" },
        { status: 400 }
      );
    }

    const { data: promo } = await adminSupabase
      .from("promotion_codes")
      .select("id, coupon_id, stripe_promo_id, is_active, times_redeemed")
      .ilike("code", code)
      .single();

    if (!promo?.stripe_promo_id || !promo.is_active) {
      return NextResponse.json(
        { error: "Invalid or inactive promotion code" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(studio.stripe_subscription_id as string, {
      discounts: [{ promotion_code: promo.stripe_promo_id }],
    });

    // redemption を記録し利用回数カウンタをインクリメント
    // (Stripe discount は既に適用済みなので、DB失敗時もdiscountは有効のまま — ログで追跡)
    const [redemptionResult, incrementResult] = await Promise.all([
      adminSupabase.from("coupon_redemptions").insert({
        studio_id: profile.studio_id,
        coupon_id: promo.coupon_id,
        promotion_code_id: promo.id,
        stripe_subscription_id: studio.stripe_subscription_id,
      }),
      adminSupabase
        .from("promotion_codes")
        .update({ times_redeemed: (promo.times_redeemed ?? 0) + 1 })
        .eq("id", promo.id),
    ]);

    if (redemptionResult.error || incrementResult.error) {
      logger.error("apply-promotion-code: DB tracking failed after Stripe discount applied", {
        studioId: profile.studio_id,
        code,
        redemptionError: redemptionResult.error?.message,
        incrementError: incrementResult.error?.message,
      });
      // Stripe discount は正当に適用されたので成功を返す
      // ただし redemption 記録が欠損していることをログで追跡可能にする
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
