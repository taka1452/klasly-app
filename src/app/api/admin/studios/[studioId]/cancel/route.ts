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
    const immediate = body.immediate === true;

    const { data: studio } = await supabase
      .from("studios")
      .select("id, stripe_subscription_id, plan_status")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const subId = studio.stripe_subscription_id as string | null;
    if (!subId) {
      return NextResponse.json(
        { error: "No Stripe subscription to cancel" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    if (immediate) {
      await stripe.subscriptions.cancel(subId);
      await supabase
        .from("studios")
        .update({
          plan_status: "canceled",
          stripe_subscription_id: null,
          cancel_at_period_end: false,
        })
        .eq("id", studioId);
    } else {
      await stripe.subscriptions.update(subId, {
        cancel_at_period_end: true,
      });
      await supabase
        .from("studios")
        .update({ cancel_at_period_end: true })
        .eq("id", studioId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
