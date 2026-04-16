import { NextResponse } from "next/server";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import { insertAdminLog } from "@/lib/admin/logs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const adminEmail = await getAdminEmail();
    const supabase = createAdminClient();
    const { studioId } = await params;

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
        { error: "No Stripe subscription" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const hasDiscount = Array.isArray(sub.discounts) && sub.discounts.length > 0;
    if (!hasDiscount) {
      return NextResponse.json(
        { error: "No discount applied to this subscription" },
        { status: 400 }
      );
    }

    await stripe.subscriptions.deleteDiscount(subId);

    await insertAdminLog(supabase, {
      action: "remove-coupon",
      studio_id: studioId,
      admin_email: adminEmail,
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
