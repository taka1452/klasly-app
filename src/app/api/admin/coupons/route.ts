import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data: coupons, error: couponsError } = await supabase
      .from("coupons")
      .select("id, stripe_coupon_id, name, discount_type, discount_value, duration, duration_months, status, notes, created_at")
      .order("created_at", { ascending: false });

    if (couponsError) {
      return NextResponse.json({ error: couponsError.message }, { status: 500 });
    }

    const couponIds = (coupons || []).map((c) => c.id);

    const { data: promos } =
      couponIds.length > 0
        ? await supabase
            .from("promotion_codes")
            .select("id, coupon_id, stripe_promo_id, code, max_redemptions, times_redeemed, expires_at, is_active, created_at")
            .in("coupon_id", couponIds)
        : { data: [] };

    const promosByCoupon: Record<string, unknown[]> = {};
    (promos || []).forEach((p) => {
      if (!promosByCoupon[p.coupon_id]) promosByCoupon[p.coupon_id] = [];
      promosByCoupon[p.coupon_id].push(p);
    });

    const { data: redemptions } =
      couponIds.length > 0
        ? await supabase
            .from("coupon_redemptions")
            .select("coupon_id")
            .in("coupon_id", couponIds)
        : { data: [] };

    const redemptionCountByCoupon: Record<string, number> = {};
    (redemptions || []).forEach((r) => {
      redemptionCountByCoupon[r.coupon_id] = (redemptionCountByCoupon[r.coupon_id] || 0) + 1;
    });

    const list = (coupons || []).map((c) => ({
      ...c,
      promotion_codes: promosByCoupon[c.id] ?? [],
      redemption_count: redemptionCountByCoupon[c.id] ?? 0,
    }));

    return NextResponse.json({ coupons: list });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    const createdBy = user?.email ?? "admin";

    const body = await request.json().catch(() => ({}));
    const name = (body.name ?? "").trim();
    const discountType = body.discount_type === "amount" ? "amount" : "percent";
    const discountValue = Number(body.discount_value);
    const duration = ["forever", "once", "repeating"].includes(body.duration) ? body.duration : "once";
    const durationMonths = duration === "repeating" ? Math.max(1, parseInt(String(body.duration_months), 10) || 1) : null;
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    if (!name || (discountType === "percent" && (discountValue <= 0 || discountValue > 100)) || (discountType === "amount" && discountValue <= 0)) {
      return NextResponse.json({ error: "Invalid name or discount" }, { status: 400 });
    }

    const { getStripe } = await import("@/lib/stripe/server");
    const stripe = getStripe();

    const couponParams: { name: string; duration: "forever" | "once" | "repeating"; percent_off?: number; amount_off?: number; duration_in_months?: number; currency?: string } = {
      name,
      duration: duration as "forever" | "once" | "repeating",
    };
    if (discountType === "percent") {
      couponParams.percent_off = discountValue;
    } else {
      couponParams.amount_off = Math.round(discountValue);
      couponParams.currency = "usd";
    }
    if (duration === "repeating" && durationMonths) {
      couponParams.duration_in_months = durationMonths;
    }

    const stripeCoupon = await stripe.coupons.create(couponParams);

    const { data: coupon, error } = await supabase
      .from("coupons")
      .insert({
        stripe_coupon_id: stripeCoupon.id,
        name,
        discount_type: discountType,
        discount_value: discountValue,
        duration,
        duration_months: durationMonths,
        status: "active",
        notes,
        created_by: createdBy,
      })
      .select("id, stripe_coupon_id, name, discount_type, discount_value, duration, duration_months, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ coupon });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
