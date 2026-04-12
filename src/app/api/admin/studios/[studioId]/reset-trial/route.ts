import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
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

    // Stripe subscription のキャンセルは必須（失敗時はDB更新しない）
    if (studio.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(studio.stripe_subscription_id as string);
      } catch (stripeErr: unknown) {
        const code = (stripeErr as { code?: string })?.code;
        if (code !== "resource_missing") {
          console.error("[Admin] Reset trial: cancel subscription failed", stripeErr);
          const message = stripeErr instanceof Error ? stripeErr.message : "Stripe cancel failed";
          return NextResponse.json(
            { error: `Failed to cancel Stripe subscription: ${message}. Trial not reset.` },
            { status: 502 }
          );
        }
      }
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const { error } = await supabase
      .from("studios")
      .update({
        plan_status: "trialing",
        trial_ends_at: trialEnd.toISOString().split("T")[0],
        stripe_subscription_id: null,
        cancel_at_period_end: false,
        trial_reminder_sent: false,
      })
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
