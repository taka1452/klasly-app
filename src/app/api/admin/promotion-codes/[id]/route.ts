import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
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

    const body = await request.json().catch(() => ({}));
    const isActive = body.is_active !== false;

    const stripe = getStripe();
    await stripe.promotionCodes.update(promo.stripe_promo_id, { active: isActive });

    const { error } = await supabase
      .from("promotion_codes")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
