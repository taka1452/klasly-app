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

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_subscription_id, plan_status")
      .eq("id", profile.studio_id)
      .single();

    const planStatus = studio?.plan_status ?? "active";
    const body = (await request.json().catch(() => ({}))) as {
      isTrialing?: boolean;
      requestRefund?: boolean;
    };
    const isTrialing = body?.isTrialing ?? planStatus === "trialing";

    // トライアルキャンセル: 「今後課金しない」だけにして、ステータスは trialing のまま
    if (isTrialing) {
      if (studio?.stripe_subscription_id) {
        await stripe.subscriptions.update(studio.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }
      await adminSupabase
        .from("studios")
        .update({ cancel_at_period_end: true })
        .eq("id", profile.studio_id);
      return NextResponse.json({ success: true });
    }

    // 本契約のキャンセルは Stripe サブスク必須
    if (!studio?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription" },
        { status: 400 }
      );
    }

    await stripe.subscriptions.update(studio.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    await adminSupabase
      .from("studios")
      .update({ cancel_at_period_end: true })
      .eq("id", profile.studio_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
