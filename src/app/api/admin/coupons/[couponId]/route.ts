import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { couponId } = await params;

    const schema = z.object({ status: z.enum(["active", "inactive"]).default("active") });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const status = body.status;

    // 関連する promotion_codes を Stripe 側で同期（inactive → deactivate, active → reactivate）
    const { data: promoCodes } = await supabase
      .from("promotion_codes")
      .select("id, stripe_promo_id")
      .eq("coupon_id", couponId);

    if (promoCodes && promoCodes.length > 0) {
      const stripe = getStripe();
      const isActive = status === "active";
      const updated: string[] = [];
      for (const promo of promoCodes) {
        if (promo.stripe_promo_id) {
          try {
            await stripe.promotionCodes.update(promo.stripe_promo_id, { active: isActive });
            updated.push(promo.stripe_promo_id);
          } catch (stripeErr) {
            console.error(`[Admin] coupon status: failed to update promo ${promo.stripe_promo_id}`, stripeErr);
            // 部分失敗: 既に更新したプロモコードを元に戻す
            for (const revertId of updated) {
              try {
                await stripe.promotionCodes.update(revertId, { active: !isActive });
              } catch (revertErr) {
                console.error(`[Admin] coupon status rollback failed for ${revertId}`, revertErr);
              }
            }
            const message = stripeErr instanceof Error ? stripeErr.message : "Stripe update failed";
            return NextResponse.json(
              { error: `Failed to update Stripe promotion code: ${message}` },
              { status: 502 }
            );
          }
        }
      }
    }

    const { error } = await supabase.from("coupons").update({ status }).eq("id", couponId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
