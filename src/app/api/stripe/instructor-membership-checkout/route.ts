import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

/**
 * POST /api/stripe/instructor-membership-checkout
 *
 * インストラクターが自分のメンバーシップティアの月額料金を
 * スタジオの Stripe Connect アカウント経由で支払うためのチェックアウトセッションを作成。
 */
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

    // インストラクター確認
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "instructor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: instructor } = await adminSupabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 }
      );
    }

    // メンバーシップ＋ティア取得
    const { data: membership } = await adminSupabase
      .from("instructor_memberships")
      .select("id, tier_id, stripe_customer_id, stripe_subscription_id, instructor_membership_tiers(name, monthly_price)")
      .eq("instructor_id", instructor.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "No active membership tier assigned" },
        { status: 400 }
      );
    }

    const rawTier = membership.instructor_membership_tiers as unknown;
    const tier = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
      name: string;
      monthly_price: number;
    } | null;

    if (!tier || tier.monthly_price <= 0) {
      return NextResponse.json(
        { error: "Your tier has no billing requirement" },
        { status: 400 }
      );
    }

    // 既にサブスクリプションがあるか確認
    if (membership.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Subscription already active" },
        { status: 409 }
      );
    }

    // スタジオの Stripe Connect アカウント確認
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("id, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", profile.studio_id)
      .single();

    if (!studio?.stripe_connect_account_id || !studio.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Studio has not set up payments yet. Please contact the studio owner." },
        { status: 400 }
      );
    }

    const connectOptions = {
      stripeAccount: studio.stripe_connect_account_id,
    };

    // プラットフォーム手数料
    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const platformFeePercent = parseFloat(feeRow?.value ?? "0");

    // Stripe Connect 上の顧客を取得・作成
    let customerId = membership.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: {
            studio_id: studio.id,
            instructor_id: instructor.id,
          },
        },
        connectOptions
      );
      customerId = customer.id;

      await adminSupabase
        .from("instructor_memberships")
        .update({ stripe_customer_id: customerId })
        .eq("id", membership.id);
    }

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Membership: ${tier.name}`,
                description: `Monthly studio membership for room booking`,
                metadata: { studio_id: studio.id },
              },
              unit_amount: tier.monthly_price,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        subscription_data:
          platformFeePercent > 0
            ? { application_fee_percent: platformFeePercent }
            : undefined,
        success_url: `${origin}/instructor/membership?success=true`,
        cancel_url: `${origin}/instructor/membership`,
        metadata: {
          type: "instructor_membership",
          studio_id: studio.id,
          instructor_id: instructor.id,
          membership_id: membership.id,
          tier_id: membership.tier_id,
        },
      },
      connectOptions
    );

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
