import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/instructor/overage-charges
 * Returns the instructor's own overage charge history.
 */
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

    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("instructor_overage_charges")
      .select("id, period_start, period_end, tier_name, included_minutes, used_minutes, overage_minutes, overage_rate_cents, total_charge_cents, status, created_at")
      .eq("instructor_id", instructor.id)
      .order("period_start", { ascending: false })
      .limit(12);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
