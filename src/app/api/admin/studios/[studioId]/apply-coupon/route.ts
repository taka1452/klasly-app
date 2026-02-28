import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const body = await request.json().catch(() => ({}));
    const promotionCode = (body.promotion_code ?? body.code ?? "").trim().toUpperCase();
    if (!promotionCode) {
      return NextResponse.json(
        { error: "promotion_code is required" },
        { status: 400 }
      );
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("id, stripe_subscription_id")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const subId = studio.stripe_subscription_id as string | null;
    if (!subId) {
      return NextResponse.json(
        { error: "No Stripe subscription to apply coupon to" },
        { status: 400 }
      );
    }

    const { data: promo } = await supabase
      .from("promotion_codes")
      .select("stripe_promo_id, is_active")
      .ilike("code", promotionCode)
      .single();

    if (!promo?.stripe_promo_id || !promo.is_active) {
      return NextResponse.json(
        { error: "Invalid or inactive promotion code" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(subId, {
      discounts: [{ promotion_code: promo.stripe_promo_id }],
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
