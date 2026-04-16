import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { isTestAccount, TEST_ACCOUNT_STRIPE_ERROR } from "@/lib/auth/test-account-guard";

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (await isTestAccount(user.id)) {
      return NextResponse.json(
        { error: TEST_ACCOUNT_STRIPE_ERROR, code: "TEST_ACCOUNT_BLOCKED" },
        { status: 403 }
      );
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
    const { productId, memberId } = body;

    if (!productId || !memberId) {
      return NextResponse.json(
        { error: "productId and memberId are required" },
        { status: 400 }
      );
    }

    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id, profile_id")
      .eq("id", memberId)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: product } = await adminSupabase
      .from("products")
      .select("id, studio_id, name, type, credits, price, currency, billing_interval, description")
      .eq("id", productId)
      .eq("is_active", true)
      .single();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.studio_id !== member.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_connect_account_id, stripe_connect_onboarding_complete, currency")
      .eq("id", member.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    if (!studio.stripe_connect_account_id || !studio.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        {
          error:
            "This studio has not set up payments yet. Please contact the studio owner.",
        },
        { status: 400 }
      );
    }

    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = feeRow?.value ?? "0";

    let customerId: string | null = null;
    const { data: memberForCustomer } = await adminSupabase
      .from("members")
      .select("stripe_connect_customer_id")
      .eq("id", memberId)
      .single();
    if (memberForCustomer?.stripe_connect_customer_id) {
      customerId = memberForCustomer.stripe_connect_customer_id;
    }

    const connectOptions = {
      stripeAccount: studio.stripe_connect_account_id,
    };

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

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const metadata = {
      studio_id: product.studio_id,
      member_id: memberId,
      product_id: product.id,
      credits: String(product.credits),
    };

    const currency = (product.currency ?? studio.currency ?? "usd").toLowerCase();
    const amount = product.price;

    if (product.type === "subscription") {
      const feePercent = parseFloat(platformFeePercent);
      const interval = product.billing_interval === "year" ? "year" : "month";
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: product.name,
                  description: product.description ?? undefined,
                  metadata: { studio_id: product.studio_id },
                },
                unit_amount: amount,
                recurring: { interval },
              },
              quantity: 1,
            },
          ],
          subscription_data:
            feePercent > 0 ? { application_fee_percent: feePercent } : undefined,
          success_url: `${origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/purchase`,
          metadata,
        },
        connectOptions
      );
      return NextResponse.json({ url: session.url });
    }

    const feePercent = parseFloat(platformFeePercent) / 100;
    const applicationFee =
      feePercent > 0 ? Math.round(amount * feePercent) : undefined;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: product.name,
                description: product.description ?? undefined,
                metadata: { studio_id: product.studio_id },
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data:
          applicationFee !== undefined
            ? { application_fee_amount: applicationFee }
            : undefined,
        success_url: `${origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/purchase`,
        metadata,
      },
      connectOptions
    );

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
