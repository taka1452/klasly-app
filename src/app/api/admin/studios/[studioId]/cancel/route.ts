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
      immediate: z.boolean().optional(),
      resume: z.boolean().optional(),
    }).refine(
      (d) => !(d.immediate && d.resume),
      { message: "Cannot set both immediate and resume" }
    );
    const body = await parseBody(request, schema);
    if (body instanceof NextResponse) return body;
    const immediate = body.immediate === true;
    const resume = body.resume === true;

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
        { error: resume ? "No Stripe subscription to resume" : "No Stripe subscription to cancel" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    try {
      if (resume) {
        await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
        await supabase
          .from("studios")
          .update({ cancel_at_period_end: false })
          .eq("id", studioId);
      } else if (immediate) {
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
        await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
        await supabase
          .from("studios")
          .update({ cancel_at_period_end: true })
          .eq("id", studioId);
      }
    } catch (stripeErr: unknown) {
      const stripeMessage = stripeErr instanceof Error ? stripeErr.message : "Stripe API error";
      await insertAdminLog(supabase, {
        action: `subscription-${resume ? "resume" : immediate ? "cancel-immediate" : "cancel-at-period-end"}`,
        studio_id: studioId,
        admin_email: adminEmail,
        status: "error",
        error_message: stripeMessage,
      });
      return NextResponse.json(
        { error: `Stripe operation failed: ${stripeMessage}` },
        { status: 502 }
      );
    }

    const mode = resume ? "resume" : immediate ? "cancel-immediate" : "cancel-at-period-end";
    await insertAdminLog(supabase, {
      action: `subscription-${mode}`,
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
