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

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      );
    }

    // Get pass subscription and verify ownership
    const { data: passSub } = await adminSupabase
      .from("pass_subscriptions")
      .select("id, member_id, stripe_subscription_id, studio_pass_id")
      .eq("id", subscriptionId)
      .single();

    if (!passSub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Verify the member belongs to this user
    const { data: member } = await adminSupabase
      .from("members")
      .select("id, profile_id, studio_id")
      .eq("id", passSub.member_id)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get studio's Connect account
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_connect_account_id")
      .eq("id", member.studio_id)
      .single();

    if (!studio?.stripe_connect_account_id) {
      return NextResponse.json({ error: "Studio payment not configured" }, { status: 400 });
    }

    const connectOptions = { stripeAccount: studio.stripe_connect_account_id };

    // Cancel at period end (not immediate)
    if (passSub.stripe_subscription_id) {
      await stripe.subscriptions.update(
        passSub.stripe_subscription_id,
        { cancel_at_period_end: true },
        connectOptions
      );
    }

    // Keep status active — pass remains usable until period end.
    // Stripe webhook (customer.subscription.deleted) will set status to 'cancelled'.
    await adminSupabase
      .from("pass_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("id", passSub.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
