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

    const body = await request.json();
    const days = typeof body.days === "number" ? body.days : parseInt(String(body.days), 10);
    if (Number.isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: "Invalid days (1–365)" },
        { status: 400 }
      );
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("id, trial_ends_at, stripe_subscription_id")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const base = (studio.trial_ends_at && new Date(studio.trial_ends_at) > new Date())
      ? new Date(studio.trial_ends_at)
      : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + days);

    // Stripe同期: subscription が存在する場合、Stripe の trial_end を先に更新
    // (Stripeの trial_end と DB の trial_ends_at を一致させることで、
    //  旧 trial_end 時点での意図しない課金を防ぐ)
    if (studio.stripe_subscription_id) {
      const stripe = getStripe();
      try {
        await stripe.subscriptions.update(
          studio.stripe_subscription_id as string,
          { trial_end: Math.floor(newEnd.getTime() / 1000) },
          { idempotencyKey: `extend-trial-${studioId}-${newEnd.toISOString()}` }
        );
      } catch (stripeErr: unknown) {
        console.error("[Admin] extend-trial: Stripe update failed", stripeErr);
        // subscription が既に active の場合、trial_end を future に設定できない
        // → Adminにその旨を伝える
        const stripeMessage = stripeErr instanceof Error ? stripeErr.message : "Stripe update failed";
        return NextResponse.json(
          { error: `Stripe subscription update failed: ${stripeMessage}` },
          { status: 502 }
        );
      }
    }

    const { error } = await supabase
      .from("studios")
      .update({ trial_ends_at: newEnd.toISOString().split("T")[0] })
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      trial_ends_at: newEnd.toISOString().split("T")[0],
    });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
