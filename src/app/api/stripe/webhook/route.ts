// @ts-nocheck - Supabase generated types do not match DB schema (payments, members, studios)
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { paymentReceipt, paymentFailed } from "@/lib/email/templates";
import { insertWebhookLog } from "@/lib/admin/logs";

/** session.subscription は string | Subscription (expand時) のため、必ずID文字列を返す */
function getSubscriptionId(sub: string | Stripe.Subscription | null): string | null {
  return sub == null ? null : typeof sub === "string" ? sub : sub.id;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  let adminSupabase: ReturnType<typeof createClient> | null = null;

  try {
    const sig = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const studioId = session.metadata?.studio_id;
        const purchaseType = session.metadata?.purchase_type;
        const memberId = session.metadata?.member_id;
        const creditsStr = session.metadata?.credits;

        if (purchaseType && memberId && studioId) {
          const credits = parseInt(creditsStr ?? "0", 10);
          const amount = session.amount_total ?? 0;
          const paymentType =
            purchaseType === "monthly" ? "monthly" : purchaseType;

          await adminSupabase.from("payments").insert({
            studio_id: studioId,
            member_id: memberId,
            amount,
            currency: session.currency ?? "usd",
            type: paymentType,
            status: "paid",
            stripe_payment_intent_id: session.payment_intent as string | null,
            payment_type: paymentType,
            paid_at: new Date().toISOString(),
          });

          if (purchaseType === "monthly") {
            const subscriptionId = getSubscriptionId(session.subscription as string | Stripe.Subscription | null);
            await adminSupabase
              .from("members")
              .update({
                plan_type: "monthly",
                credits: -1,
                stripe_subscription_id: subscriptionId,
              })
              .eq("id", memberId);
          } else {
            const { data: m } = await adminSupabase
              .from("members")
              .select("credits")
              .eq("id", memberId)
              .single();
            const current = m?.credits ?? 0;
            const next = Math.max(0, current) + credits;
            await adminSupabase
              .from("members")
              .update({ credits: next })
              .eq("id", memberId);
          }

          const { data: memberProfile } = await adminSupabase
            .from("members")
            .select("profiles(full_name, email)")
            .eq("id", memberId)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", studioId)
            .single();
          const memberProf = (memberProfile as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const prof = Array.isArray(memberProf) ? memberProf[0] : memberProf;
          const toEmail = prof?.email;
          const memberName = prof?.full_name ?? "Member";
          const studioName = studioData?.name ?? "Studio";

          if (toEmail) {
            const desc =
              purchaseType === "monthly"
                ? "Monthly membership"
                : purchaseType === "pack_5"
                  ? "5-Class Pack"
                  : purchaseType === "pack_10"
                    ? "10-Class Pack"
                    : "Drop-in";
            const { subject, html } = paymentReceipt({
              memberName,
              amount,
              description: desc,
              studioName,
            });
            await sendEmail({
              to: toEmail,
              subject,
              html,
              studioId,
              templateName: "payment_receipt",
            });
          }
          break;
        }

        const subscriptionId = getSubscriptionId(session.subscription as string | Stripe.Subscription | null);
        if (!studioId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const period: "monthly" | "yearly" =
          priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? "yearly" : "monthly";

        const trialEnd = subscription.trial_end;
        const trialEndAt = trialEnd
          ? new Date(trialEnd * 1000).toISOString()
          : null;

        const periodEnd = subscription.items.data[0]?.current_period_end;
        const currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        await adminSupabase
          .from("studios")
          .update({
            stripe_subscription_id: subscriptionId,
            plan: "pro",
            plan_status: "trialing",
            trial_ends_at: trialEndAt,
            subscription_period: period,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          })
          .eq("id", studioId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!studio) break;

        const status = subscription.status;
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const period: "monthly" | "yearly" =
          priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? "yearly" : "monthly";
        const periodEnd = subscription.items.data[0]?.current_period_end;
        const currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        let planStatus = "trialing";
        let gracePeriodEndsAt: string | null = null;

        if (status === "active") {
          planStatus = "active";
        } else if (status === "past_due") {
          planStatus = "past_due";
          const in14Days = new Date();
          in14Days.setDate(in14Days.getDate() + 14);
          gracePeriodEndsAt = in14Days.toISOString();
        } else if (status === "trialing") {
          planStatus = "trialing";
        }

        await adminSupabase
          .from("studios")
          .update({
            plan_status: planStatus,
            subscription_period: period,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            grace_period_ends_at: gracePeriodEndsAt,
          })
          .eq("id", studio.id);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id ?? null;

        if (!subscriptionId) break;

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (studio) {
          await adminSupabase
            .from("studios")
            .update({ plan_status: "active" })
            .eq("id", studio.id);

          await adminSupabase.from("payments").insert({
            studio_id: studio.id,
            member_id: null,
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            type: "subscription",
            status: "paid",
            stripe_invoice_id: invoice.id,
            payment_type: "subscription",
            paid_at: new Date().toISOString(),
          });

          const { data: ownerProfile } = await adminSupabase
            .from("profiles")
            .select("full_name, email")
            .eq("studio_id", studio.id)
            .eq("role", "owner")
            .limit(1)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", studio.id)
            .single();
          if (ownerProfile?.email) {
            const { subject, html } = paymentReceipt({
              memberName: ownerProfile.full_name ?? "Studio Owner",
              amount: invoice.amount_paid,
              description: "Pro plan subscription",
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: ownerProfile.email,
              subject,
              html,
              studioId: studio.id,
              templateName: "payment_receipt",
            });
          }
          break;
        }

        const { data: member } = await adminSupabase
          .from("members")
          .select("id, studio_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (member) {
          await adminSupabase.from("payments").insert({
            studio_id: member.studio_id,
            member_id: member.id,
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "paid",
            stripe_invoice_id: invoice.id,
            payment_type: "monthly",
            paid_at: new Date().toISOString(),
          });

          const { data: prof } = await adminSupabase
            .from("members")
            .select("profiles(full_name, email)")
            .eq("id", member.id)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", member.studio_id)
            .single();
          const p = (prof as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pf = Array.isArray(p) ? p[0] : p;
          if (pf?.email) {
            const { subject, html } = paymentReceipt({
              memberName: pf.full_name ?? "Member",
              amount: invoice.amount_paid,
              description: "Monthly membership",
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: pf.email,
              subject,
              html,
              studioId: member.studio_id,
              templateName: "payment_receipt",
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id ?? null;

        if (!subscriptionId) break;

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id, plan_status")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (studio) {
          const isPastDue = studio.plan_status === "past_due";
          if (!isPastDue) {
            const in14Days = new Date();
            in14Days.setDate(in14Days.getDate() + 14);
            await adminSupabase
              .from("studios")
              .update({
                plan_status: "past_due",
                grace_period_ends_at: in14Days.toISOString(),
              })
              .eq("id", studio.id);
          }

          await adminSupabase.from("payments").insert({
            studio_id: studio.id,
            member_id: null,
            amount: invoice.amount_due,
            currency: invoice.currency ?? "usd",
            type: "subscription",
            status: "failed",
            stripe_invoice_id: invoice.id,
            payment_type: "subscription",
          });

          const { data: ownerProfile } = await adminSupabase
            .from("profiles")
            .select("full_name, email")
            .eq("studio_id", studio.id)
            .eq("role", "owner")
            .limit(1)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", studio.id)
            .single();
          if (ownerProfile?.email) {
            const { subject, html } = paymentFailed({
              memberName: ownerProfile.full_name ?? "Studio Owner",
              amount: invoice.amount_due,
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: ownerProfile.email,
              subject,
              html,
              studioId: studio.id,
              templateName: "payment_failed",
            });
          }
          break;
        }

        const { data: member } = await adminSupabase
          .from("members")
          .select("id, studio_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (member) {
          await adminSupabase.from("payments").insert({
            studio_id: member.studio_id,
            member_id: member.id,
            amount: invoice.amount_due,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "failed",
            stripe_invoice_id: invoice.id,
            payment_type: "monthly",
          });

          const { data: prof } = await adminSupabase
            .from("members")
            .select("profiles(full_name, email)")
            .eq("id", member.id)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", member.studio_id)
            .single();
          const p = (prof as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pf = Array.isArray(p) ? p[0] : p;
          if (pf?.email) {
            const { subject, html } = paymentFailed({
              memberName: pf.full_name ?? "Member",
              amount: invoice.amount_due,
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: pf.email,
              subject,
              html,
              studioId: member.studio_id,
              templateName: "payment_failed",
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (studio) {
          await adminSupabase
            .from("studios")
            .update({
              plan_status: "canceled",
              stripe_subscription_id: null,
              cancel_at_period_end: false,
              grace_period_ends_at: null,
            })
            .eq("id", studio.id);
          break;
        }

        const { data: member } = await adminSupabase
          .from("members")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (member) {
          await adminSupabase
            .from("members")
            .update({
              plan_type: "drop_in",
              credits: 0,
              stripe_subscription_id: null,
            })
            .eq("id", member.id);
        }
        break;
      }

      default:
        break;
    }

    const studioIdForLog = await getStudioIdFromStripeEvent(event, adminSupabase);
    await insertWebhookLog(adminSupabase, {
      event_type: event.type,
      event_id: event.id,
      studio_id: studioIdForLog,
      status: "success",
      payload: { type: event.type, id: event.id },
    });

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (adminSupabase) {
      await insertWebhookLog(adminSupabase, {
        event_type: "webhook_error",
        event_id: null,
        studio_id: null,
        status: "failure",
        error_message: message,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getStudioIdFromStripeEvent(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      return (session.metadata?.studio_id as string) ?? null;
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const { data: studio } = await supabase
        .from("studios")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .single();
      return studio?.id ?? null;
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
      if (!subId) return null;
      const { data: studio } = await supabase
        .from("studios")
        .select("id")
        .eq("stripe_subscription_id", subId)
        .single();
      if (studio) return studio.id;
      const { data: member } = await supabase
        .from("members")
        .select("studio_id")
        .eq("stripe_subscription_id", subId)
        .single();
      return member?.studio_id ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}
