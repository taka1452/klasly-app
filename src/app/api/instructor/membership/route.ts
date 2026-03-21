import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET: instructor's membership info (tier + payment status)
export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    const allowedRoles = ["instructor", "owner", "manager"];
    if (!profile?.studio_id || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("instructor_memberships")
      .select(
        "id, tier_id, status, stripe_subscription_id, cancel_at_period_end, current_period_end, instructor_membership_tiers(name, monthly_minutes, monthly_price)"
      )
      .eq("instructor_id", instructor.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ hasTier: false });
    }

    const rawTier = membership.instructor_membership_tiers as unknown;
    const tier = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
      name: string;
      monthly_minutes: number;
      monthly_price: number;
    } | null;

    if (!tier) {
      return NextResponse.json({ hasTier: false });
    }

    return NextResponse.json({
      hasTier: true,
      tierName: tier.name,
      monthlyMinutes: tier.monthly_minutes,
      monthlyPrice: tier.monthly_price,
      subscriptionActive: !!membership.stripe_subscription_id,
      cancelAtPeriodEnd: membership.cancel_at_period_end ?? false,
      currentPeriodEnd: membership.current_period_end,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
