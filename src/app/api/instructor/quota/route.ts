import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET: instructor's current month quota usage
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

    if (!profile?.studio_id || profile.role !== "instructor") {
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

    // Get membership with tier
    const { data: membership } = await supabase
      .from("instructor_memberships")
      .select("tier_id, instructor_membership_tiers(name, monthly_minutes)")
      .eq("instructor_id", instructor.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ hasTier: false });
    }

    const rawTier = membership.instructor_membership_tiers as unknown;
    const tierData = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
      name: string;
      monthly_minutes: number;
    } | null;

    if (!tierData) {
      return NextResponse.json({ hasTier: false });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { data: usedMinutes } = await supabase.rpc("get_instructor_used_minutes", {
      p_instructor_id: instructor.id,
      p_year: year,
      p_month: month,
    });

    return NextResponse.json({
      hasTier: true,
      tierName: tierData.name,
      monthlyMinutes: tierData.monthly_minutes,
      usedMinutes: typeof usedMinutes === "number" ? usedMinutes : 0,
      year,
      month,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
