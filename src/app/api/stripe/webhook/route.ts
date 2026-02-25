import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.text();
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

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const studioPriceId = process.env.STRIPE_STUDIO_PRICE_ID;
    const growPriceId = process.env.STRIPE_GROW_PRICE_ID;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const studioId = session.metadata?.studio_id;
        const subscriptionId = session.subscription as string | null;

        if (!studioId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        const priceId =
          subscription.items.data[0]?.price?.id ?? "";

        const plan =
          priceId === growPriceId
            ? "grow"
            : priceId === studioPriceId
            ? "studio"
            : "free";

        await adminSupabase
          .from("studios")
          .update({
            stripe_subscription_id: subscriptionId,
            plan,
            plan_status: "active",
          })
          .eq("id", studioId);
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

        if (!studio) break;

        await adminSupabase.from("studios").update({ plan_status: "active" }).eq(
          "id",
          studio.id
        );

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
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!studio) break;

        await adminSupabase
          .from("studios")
          .update({ plan_status: "past_due" })
          .eq("id", studio.id);

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

        if (!studio) break;

        await adminSupabase
          .from("studios")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            plan_status: "active",
          })
          .eq("id", studio.id);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
