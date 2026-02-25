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
      .select("id, studio_id, profile_id, stripe_customer_id")
      .eq("id", memberId)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let customerId = member.stripe_customer_id;

    const { data: studio } = await adminSupabase
      .from("studios")
      .select(
        "id, drop_in_price, pack_5_price, pack_10_price, monthly_price"
      )
      .eq("id", member.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const amounts: Record<string, number> = {
      drop_in: studio.drop_in_price ?? 2000,
      pack_5: studio.pack_5_price ?? 8000,
      pack_10: studio.pack_10_price ?? 15000,
      monthly: studio.monthly_price ?? 12000,
    };
    const amount = amounts[purchaseType] ?? 0;
    const credits = CREDITS[purchaseType] ?? 0;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          studio_id: studio.id,
          member_id: memberId,
        },
      });
      customerId = customer.id;

      await adminSupabase
        .from("members")
        .update({ stripe_customer_id: customerId })
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
      const session = await stripe.checkout.sessions.create({
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
        success_url: `${origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/purchase`,
        metadata,
      });
      return NextResponse.json({ url: session.url });
    }

    const productNames: Record<string, string> = {
      drop_in: "Drop-in (1 session)",
      pack_5: "5-Class Pack (5 sessions)",
      pack_10: "10-Class Pack (10 sessions)",
    };

    const session = await stripe.checkout.sessions.create({
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
      success_url: `${origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/purchase`,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
