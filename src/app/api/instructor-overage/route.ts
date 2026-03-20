import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/instructor-overage?period=YYYY-MM
 * Returns overage charges for the studio, optionally filtered by period.
 */
export async function GET(request: Request) {
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

    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period"); // YYYY-MM

    let query = supabase
      .from("instructor_overage_charges")
      .select(`
        *,
        instructors!inner(profile_id, profiles(full_name, email))
      `)
      .eq("studio_id", profile.studio_id)
      .order("created_at", { ascending: false });

    if (period) {
      const [y, m] = period.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("period_start", start).lte("period_start", end);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten instructor info
    const charges = (data || []).map((c) => {
      const rawInstructor = c.instructors as unknown;
      const inst = (Array.isArray(rawInstructor) ? rawInstructor[0] : rawInstructor) as {
        profile_id: string;
        profiles: { full_name: string; email: string } | { full_name: string; email: string }[];
      } | null;

      const rawProfile = inst?.profiles;
      const p = rawProfile
        ? (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile)
        : null;

      return {
        id: c.id,
        instructor_id: c.instructor_id,
        instructor_name: (p as { full_name: string } | null)?.full_name || "Unknown",
        period_start: c.period_start,
        period_end: c.period_end,
        tier_name: c.tier_name,
        included_minutes: c.included_minutes,
        used_minutes: c.used_minutes,
        overage_minutes: c.overage_minutes,
        overage_rate_cents: c.overage_rate_cents,
        total_charge_cents: c.total_charge_cents,
        status: c.status,
        created_at: c.created_at,
      };
    });

    return NextResponse.json(charges);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
