import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const body = await request.json();
    const { passId, memberId } = body;

    if (!passId || !memberId) {
      return NextResponse.json(
        { error: "passId and memberId are required" },
        { status: 400 }
      );
    }

    // Verify member belongs to the current user
    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, profile_id, stripe_connect_customer_id")
      .eq("id", memberId)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabled = await isFeatureEnabled(member.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json({ error: "Studio passes are not enabled for this studio" }, { status: 403 });
    }

    // Get pass details
    const { data: pass } = await adminSupabase
      .from("studio_passes")
      .select("id, studio_id, stripe_price_id, is_active")
      .eq("id", passId)
      .single();

    if (!pass || !pass.is_active || !pass.stripe_price_id) {
      return NextResponse.json({ error: "Pass not found or inactive" }, { status: 404 });
    }

    if (pass.studio_id !== member.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for existing active subscription to this pass
    const { data: existingSub } = await adminSupabase
      .from("pass_subscriptions")
      .select("id")
      .eq("studio_pass_id", passId)
      .eq("member_id", memberId)
      .eq("status", "active")
      .maybeSingle();

    if (existingSub) {
      return NextResponse.json(
        { error: "You already have an active subscription to this pass." },
        { status: 400 }
      );
    }

    // Get studio's Stripe Connect account
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", member.studio_id)
      .single();

    if (!studio?.stripe_connect_account_id || !studio.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Studio payments not set up." },
        { status: 400 }
      );
    }

    const connectOptions = { stripeAccount: studio.stripe_connect_account_id };

    // Get or create Stripe Connect customer
    let customerId = member.stripe_connect_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: {
            studio_id: studio.id,
            member_id: memberId,
          },
        },
        connectOptions
      );
      customerId = customer.id;

      await adminSupabase
        .from("members")
        .update({ stripe_connect_customer_id: customerId })
        .eq("id", memberId);
    }

    // Get platform fee
    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const feePercent = parseFloat(feeRow?.value ?? "0");

    // Use Stripe Checkout Session for subscription (provides card input UI)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.klasly.app";
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: pass.stripe_price_id, quantity: 1 }],
        subscription_data: {
          application_fee_percent: feePercent > 0 ? feePercent : undefined,
          metadata: {
            studio_id: studio.id,
            member_id: memberId,
            studio_pass_id: passId,
            type: "studio_pass",
          },
        },
        success_url: `${baseUrl}/my-passes?subscribed=true`,
        cancel_url: `${baseUrl}/my-passes`,
        metadata: {
          studio_id: studio.id,
          member_id: memberId,
          studio_pass_id: passId,
          type: "studio_pass",
        },
      },
      connectOptions
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
