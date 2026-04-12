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

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, price_cents, max_classes_per_month, pass_type, expires_after_days, class_template_ids } = body;

    if (!name || typeof price_cents !== "number" || price_cents <= 0) {
      return NextResponse.json(
        { error: "name and price_cents are required" },
        { status: 400 }
      );
    }

    // Get studio Stripe Connect account
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_connect_account_id, stripe_connect_onboarding_complete, currency")
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
        currency: (studio.currency ?? "usd").toLowerCase(),
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
        pass_type: pass_type ?? "monthly",
        expires_after_days: expires_after_days ?? null,
      })
      .select()
      .single();

    if (error) {
      // DB insert 失敗時は Stripe product を非活性化（ロールバック）
      try {
        await stripe.products.update(product.id, { active: false }, connectOptions);
      } catch (rollbackErr) {
        console.error("[passes/create] Stripe product rollback failed", rollbackErr);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Save class template restrictions if provided
    if (pass && Array.isArray(class_template_ids) && class_template_ids.length > 0) {
      await adminSupabase
        .from("pass_class_templates")
        .insert(
          class_template_ids.map((tid: string) => ({ pass_id: pass.id, template_id: tid }))
        );
    }

    return NextResponse.json(pass);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
