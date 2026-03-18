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

    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, price_cents, max_classes_per_month } = body;

    if (!name || typeof price_cents !== "number" || price_cents <= 0) {
      return NextResponse.json(
        { error: "name and price_cents are required" },
        { status: 400 }
      );
    }

    // Get studio Stripe Connect account
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", profile.studio_id)
      .single();

    if (!studio?.stripe_connect_account_id || !studio.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Stripe Connect must be set up before creating passes." },
        { status: 400 }
      );
    }

    const connectOptions = { stripeAccount: studio.stripe_connect_account_id };

    // Create Stripe Product + recurring Price on the Connected Account
    const product = await stripe.products.create(
      {
        name,
        description: description ?? undefined,
        metadata: { studio_id: studio.id, type: "studio_pass" },
      },
      connectOptions
    );

    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: price_cents,
        currency: "usd",
        recurring: { interval: "month" },
      },
      connectOptions
    );

    // Insert pass record
    const { data: pass, error } = await adminSupabase
      .from("studio_passes")
      .insert({
        studio_id: studio.id,
        name,
        description: description ?? null,
        price_cents,
        max_classes_per_month: max_classes_per_month ?? null,
        stripe_price_id: price.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(pass);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
