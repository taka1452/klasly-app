import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

const CREDITS: Record<string, number> = {
  drop_in: 1,
  pack_5: 5,
  pack_10: 10,
  monthly: -1, // unlimited
};

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
    const { purchaseType, memberId } = body;

    const validTypes = ["drop_in", "pack_5", "pack_10", "monthly"];
    if (!validTypes.includes(purchaseType) || !memberId) {
      return NextResponse.json(
        { error: "Invalid purchaseType or memberId" },
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

    const { data: studio } = await adminSupabase
      .from("studios")
      .select(
        "id, drop_in_price, pack_5_price, pack_10_price, monthly_price, stripe_connect_account_id, stripe_connect_onboarding_complete"
      )
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

    // Connect 利用時は顧客は必ず Connected Account 側に作成する。
    // 既存の stripe_customer_id はプラットフォーム時代の可能性があるため参照せず、
    // Connect 用は stripe_connect_customer_id のみ使う。
    let customerId: string | null = null;
    const { data: memberForCustomer } = await adminSupabase
      .from("members")
      .select("stripe_connect_customer_id")
      .eq("id", memberId)
      .single();
    if (memberForCustomer?.stripe_connect_customer_id) {
      customerId = memberForCustomer.stripe_connect_customer_id;
    }

    const amounts: Record<string, number> = {
      drop_in: studio.drop_in_price ?? 2000,
      pack_5: studio.pack_5_price ?? 8000,
      pack_10: studio.pack_10_price ?? 15000,
      monthly: studio.monthly_price ?? 12000,
    };
    const amount = amounts[purchaseType] ?? 0;
    const credits = CREDITS[purchaseType] ?? 0;

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
      studio_id: studio.id,
      member_id: memberId,
      purchase_type: purchaseType,
      credits: String(credits),
    };

    if (purchaseType === "monthly") {
      const feePercent = parseFloat(platformFeePercent);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Monthly Unlimited",
                  description: "Unlimited classes per month",
                  metadata: { studio_id: studio.id },
                },
                unit_amount: amount,
                recurring: { interval: "month" },
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

    const productNames: Record<string, string> = {
      drop_in: "Drop-in (1 session)",
      pack_5: "5-Class Pack (5 sessions)",
      pack_10: "10-Class Pack (10 sessions)",
    };

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
              currency: "usd",
              product_data: {
                name: productNames[purchaseType] ?? purchaseType,
                metadata: { studio_id: studio.id },
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
