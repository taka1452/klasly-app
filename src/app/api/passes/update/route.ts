import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { logStudioAudit } from "@/lib/audit/studio-audit";

export async function PATCH(request: Request) {
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

    if (profile?.role === "manager") {
      const { data: mgr } = await adminSupabase
        .from("managers")
        .select("can_manage_settings, can_view_payments")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!mgr?.can_manage_settings && !mgr?.can_view_payments) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { passId } = body;

    if (!passId) {
      return NextResponse.json({ error: "passId is required" }, { status: 400 });
    }

    // auto_distribute-only toggle (legacy path)
    if (typeof body.auto_distribute === "boolean" && !body.name) {
      const { error } = await adminSupabase
        .from("studio_passes")
        .update({ auto_distribute: body.auto_distribute })
        .eq("id", passId)
        .eq("studio_id", profile.studio_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Full pass update
    const { name, description, price_cents, max_classes_per_month, pass_type, is_active, expires_after_days, expires_on, class_template_ids } = body;

    if (!name || typeof price_cents !== "number" || price_cents <= 0) {
      return NextResponse.json({ error: "name and price_cents are required" }, { status: 400 });
    }

    // Check if price changed — Stripe prices are immutable so we create a new one
    const { data: existing } = await adminSupabase
      .from("studio_passes")
      .select("price_cents, stripe_price_id")
      .eq("id", passId)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    let stripePriceId = existing.stripe_price_id;

    if (existing.price_cents !== price_cents && stripePriceId) {
      try {
        const { stripe } = await import("@/lib/stripe/server");
        const { data: studio } = await adminSupabase
          .from("studios")
          .select("stripe_connect_account_id, currency")
          .eq("id", profile.studio_id)
          .single();

        if (studio?.stripe_connect_account_id) {
          const connectOptions = { stripeAccount: studio.stripe_connect_account_id };
          const oldPrice = await stripe.prices.retrieve(stripePriceId, connectOptions);
          const isRecurring = (pass_type ?? "monthly") === "monthly";
          const newPrice = await stripe.prices.create(
            {
              product: oldPrice.product as string,
              unit_amount: price_cents,
              currency: (studio.currency ?? "usd").toLowerCase(),
              ...(isRecurring ? { recurring: { interval: "month" } } : {}),
            },
            connectOptions
          );
          await stripe.prices.update(stripePriceId, { active: false }, connectOptions);
          stripePriceId = newPrice.id;
        }
      } catch (stripeErr) {
        console.error("[passes/update] Stripe price update failed", stripeErr);
      }
    }

    const { error } = await adminSupabase
      .from("studio_passes")
      .update({
        name,
        description: description ?? null,
        price_cents,
        max_classes_per_month: max_classes_per_month ?? null,
        pass_type: pass_type ?? "monthly",
        is_active: is_active ?? true,
        expires_after_days: expires_after_days ?? null,
        expires_on: expires_on ?? null,
        stripe_price_id: stripePriceId,
      })
      .eq("id", passId)
      .eq("studio_id", profile.studio_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update class template restrictions
    await adminSupabase.from("pass_class_templates").delete().eq("pass_id", passId);
    if (Array.isArray(class_template_ids) && class_template_ids.length > 0) {
      await adminSupabase
        .from("pass_class_templates")
        .insert(class_template_ids.map((tid: string) => ({ pass_id: passId, template_id: tid })));
    }

    const priceChanged = existing.price_cents !== price_cents;
    const priceLabel = `$${(price_cents / 100).toFixed(2)}`;
    await logStudioAudit(adminSupabase, {
      studioId: profile.studio_id,
      actorProfileId: user.id,
      actorRole: profile.role,
      changeType: "pass_updated",
      targetTable: "studio_passes",
      targetId: passId,
      before: { price_cents: existing.price_cents },
      after: { name, price_cents, is_active },
      summary: priceChanged
        ? `Pass "${name}" price changed to ${priceLabel}`
        : `Pass "${name}" updated`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
