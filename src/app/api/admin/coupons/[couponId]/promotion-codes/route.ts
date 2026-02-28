import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { couponId } = await params;

    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, stripe_coupon_id")
      .eq("id", couponId)
      .single();

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const code = (body.code ?? "").trim().toUpperCase().replace(/\s/g, "");
    const maxRedemptions = body.max_redemptions != null ? parseInt(String(body.max_redemptions), 10) : null;
    const expiresAt = body.expires_at ? new Date(body.expires_at).getTime() / 1000 : null;
    const firstTimeOnly = body.first_time_only === true;

    if (!code || code.length > 500) {
      return NextResponse.json({ error: "Code is required (max 500 chars)" }, { status: 400 });
    }

    const stripe = getStripe();

    const promoParams: {
      promotion: { type: "coupon"; coupon: string };
      code: string;
      max_redemptions?: number;
      expires_at?: number;
      restrictions?: { first_time_transaction?: boolean };
    } = {
      promotion: { type: "coupon", coupon: coupon.stripe_coupon_id },
      code,
    };
    if (maxRedemptions != null && maxRedemptions > 0) promoParams.max_redemptions = maxRedemptions;
    if (expiresAt != null && expiresAt > 0) promoParams.expires_at = Math.floor(expiresAt);
    if (firstTimeOnly) promoParams.restrictions = { first_time_transaction: true };

    const stripePromo = await stripe.promotionCodes.create(promoParams);

    const { data: promo, error } = await supabase
      .from("promotion_codes")
      .insert({
        coupon_id: couponId,
        stripe_promo_id: stripePromo.id,
        code,
        max_redemptions: maxRedemptions,
        expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
        first_time_only: firstTimeOnly,
        is_active: true,
      })
      .select("id, code, stripe_promo_id, max_redemptions, times_redeemed, expires_at, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ promotion_code: promo });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
