import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminEmail } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import { getStripe } from "@/lib/stripe/server";
import { parseBody } from "@/lib/api/parse-body";
import { insertAdminLog } from "@/lib/admin/logs";

const schema = z.object({
  days: z.coerce.number().int().min(1).max(365),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    await requireAdmin();
    const adminEmail = await getAdminEmail();
    const supabase = createAdminClient();
    const { studioId } = await params;

    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const { days } = body;

    const { data: studio } = await supabase
      .from("studios")
      .select("id, trial_ends_at, stripe_subscription_id")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const base =
      studio.trial_ends_at && new Date(studio.trial_ends_at) > new Date()
        ? new Date(studio.trial_ends_at)
        : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + days);

    // Stripe同期: subscription が存在する場合、Stripe の trial_end を先に更新
    // (DBだけ更新すると旧 trial_end 時点で Stripe が課金してしまう)
    const subId = studio.stripe_subscription_id as string | null;
    if (subId) {
      const stripe = getStripe();
      try {
        await stripe.subscriptions.update(
          subId,
          { trial_end: Math.floor(newEnd.getTime() / 1000) },
          { idempotencyKey: `extend-trial-${studioId}-${newEnd.toISOString()}` }
        );
      } catch (stripeErr: unknown) {
        const message =
          stripeErr instanceof Error ? stripeErr.message : "Stripe update failed";
        await insertAdminLog(supabase, {
          action: "extend-trial",
          studio_id: studioId,
          admin_email: adminEmail,
          status: "error",
          error_message: message,
          details: { days, newEnd: newEnd.toISOString() },
        });
        return NextResponse.json(
          { error: `Stripe subscription update failed: ${message}` },
          { status: 502 }
        );
      }
    }

    const newEndStr = newEnd.toISOString().split("T")[0];
    const { error } = await supabase
      .from("studios")
      .update({ trial_ends_at: newEndStr })
      .eq("id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await insertAdminLog(supabase, {
      action: "extend-trial",
      studio_id: studioId,
      admin_email: adminEmail,
      status: "success",
      details: { days, newEnd: newEndStr, stripeSync: !!subId },
    });

    return NextResponse.json({ success: true, trial_ends_at: newEndStr });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
