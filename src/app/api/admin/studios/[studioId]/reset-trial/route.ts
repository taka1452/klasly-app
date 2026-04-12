import { NextResponse } from "next/server";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { cancelSubscriptionSafe } from "@/lib/admin/stripe-helpers";
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

    // Stripe subscription のキャンセルは必須（失敗時はDB更新しない）
    const subId = studio.stripe_subscription_id as string | null;
    if (subId) {
      const stripeError = await cancelSubscriptionSafe(
        subId,
        `reset-trial studio ${studioId}`
      );
      if (stripeError) {
        await insertAdminLog(supabase, {
          action: "reset-trial",
          studio_id: studioId,
          admin_email: adminEmail,
          status: "error",
          error_message: "Stripe subscription cancel failed",
        });
        return stripeError;
      }
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    const trialEndStr = trialEnd.toISOString().split("T")[0];

    const { error } = await supabase
      .from("studios")
      .update({
        plan_status: "trialing",
        trial_ends_at: trialEndStr,
        stripe_subscription_id: null,
        cancel_at_period_end: false,
        trial_reminder_sent: false,
        grace_period_ends_at: null,
      })
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await insertAdminLog(supabase, {
      action: "reset-trial",
      studio_id: studioId,
      admin_email: adminEmail,
      status: "success",
      details: { trialEnd: trialEndStr, hadSubscription: !!subId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
