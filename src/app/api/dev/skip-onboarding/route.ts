/**
 * ⚠️ DEV ONLY - Skip Stripe checkout for local development.
 * - Returns 404 in production (NODE_ENV !== 'development')
 * - Button is hidden in production build (NODE_ENV check)
 * - No action needed for production; safe to deploy as-is.
 */
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  await adminSupabase
    .from("studios")
    .update({
      stripe_subscription_id: "dev_skip_trial",
      plan: "pro",
      plan_status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_period: "monthly",
    })
    .eq("id", profile.studio_id);

  return NextResponse.json({ success: true, redirect: "/dashboard" });
}
