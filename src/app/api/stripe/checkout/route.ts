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
    const { priceId } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing priceId" },
        { status: 400 }
      );
    }

    const validPrices = [
      process.env.STRIPE_STUDIO_PRICE_ID,
      process.env.STRIPE_GROW_PRICE_ID,
    ].filter(Boolean);

    if (!validPrices.includes(priceId)) {
      return NextResponse.json(
        { error: "Invalid price" },
        { status: 400 }
      );
    }

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_customer_id")
      .eq("id", profile.studio_id)
      .single();

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    let customerId = studio.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { studio_id: studio.id },
      });
      customerId = customer.id;

      await adminSupabase
        .from("studios")
        .update({ stripe_customer_id: customerId })
        .eq("id", studio.id);
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/billing`,
      metadata: { studio_id: studio.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
