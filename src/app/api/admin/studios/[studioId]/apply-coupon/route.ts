import { NextResponse } from "next/server";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";
import { insertAdminLog } from "@/lib/admin/logs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const adminEmail = await getAdminEmail();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const schema = z.object({
      promotion_code: z.string().optional(),
      code: z.string().optional(),
    });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
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

    await insertAdminLog(supabase, {
      action: "apply-coupon",
      studio_id: studioId,
      admin_email: adminEmail,
      status: "success",
      details: { promotionCode: promotionCode },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
