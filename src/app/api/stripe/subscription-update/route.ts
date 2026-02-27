import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

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

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { period } = body as { period?: string };

    if (period !== "monthly" && period !== "yearly") {
      return NextResponse.json(
        { error: "Invalid period. Use monthly or yearly." },
        { status: 400 }
      );
    }

    const monthlyId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const yearlyId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;

    if (!monthlyId || !yearlyId) {
      return NextResponse.json(
        { error: "Stripe price IDs not configured" },
        { status: 500 }
      );
    }

    const newPriceId = period === "monthly" ? monthlyId : yearlyId;

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_subscription_id")
      .eq("id", profile.studio_id)
      .single();

    if (!studio?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription" },
        { status: 400 }
      );
    }

    const sub = await stripe.subscriptions.retrieve(
      studio.stripe_subscription_id,
      { expand: ["items.data.price"] }
    );

    const itemId = sub.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json(
        { error: "Subscription has no items" },
        { status: 400 }
      );
    }

    await stripe.subscriptions.update(studio.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "always_invoice",
    });

    await adminSupabase
      .from("studios")
      .update({ subscription_period: period })
      .eq("id", profile.studio_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
