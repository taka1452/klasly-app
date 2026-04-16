import { NextResponse } from "next/server";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/parse-body";
import { insertAdminLog } from "@/lib/admin/logs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const adminEmail = await getAdminEmail();
    const supabase = createAdminClient();
    const { id } = await params;

    const { data: promo } = await supabase
      .from("promotion_codes")
      .select("id, stripe_promo_id")
      .eq("id", id)
      .single();

    if (!promo) {
      return NextResponse.json({ error: "Promotion code not found" }, { status: 404 });
    }

    const schema = z.object({ is_active: z.boolean().optional() });
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const isActive = body.is_active !== false;

    const stripe = getStripe();
    await stripe.promotionCodes.update(promo.stripe_promo_id, { active: isActive });

    const { error } = await supabase
      .from("promotion_codes")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      // DB失敗時: Stripeを元に戻す
      try {
        await stripe.promotionCodes.update(promo.stripe_promo_id, { active: !isActive });
      } catch (rollbackErr) {
        console.error("[Admin] promotion-code status rollback failed", rollbackErr);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await insertAdminLog(supabase, {
      action: "promotion-code-status",
      studio_id: null,
      admin_email: adminEmail,
      status: "success",
      details: { promoId: id, isActive },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
