import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    const allowedRoles = ["instructor", "owner", "manager"];
    if (!profile?.studio_id || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Parse month filter (YYYY-MM)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");
    const now = new Date();
    const year = monthParam
      ? parseInt(monthParam.split("-")[0], 10)
      : now.getFullYear();
    const month = monthParam
      ? parseInt(monthParam.split("-")[1], 10)
      : now.getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data: earnings } = await adminSupabase
      .from("instructor_earnings")
      .select(
        "id, gross_amount, stripe_fee, platform_fee, studio_fee, instructor_payout, studio_fee_percentage, status, created_at, session_id, class_sessions(session_date, start_time, classes(name))"
      )
      .eq("instructor_id", instructor.id)
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: false });

    // Calculate summary
    const items = earnings ?? [];
    const summary = {
      totalGross: items.reduce((s, e) => s + e.gross_amount, 0),
      totalStripeFee: items.reduce((s, e) => s + e.stripe_fee, 0),
      totalPlatformFee: items.reduce((s, e) => s + e.platform_fee, 0),
      totalStudioFee: items.reduce((s, e) => s + e.studio_fee, 0),
      totalPayout: items.reduce((s, e) => s + e.instructor_payout, 0),
      classCount: items.length,
    };

    // Fetch pass distributions for this month
    const { data: passDistributions } = await adminSupabase
      .from("pass_distributions")
      .select("id, period_start, period_end, total_classes, total_pool_classes, gross_pool_amount, payout_amount, status, created_at")
      .eq("instructor_id", instructor.id)
      .gte("period_start", startDate)
      .lt("period_start", endDate)
      .order("created_at", { ascending: false });

    const passItems = passDistributions ?? [];
    const passSummary = {
      totalPayout: passItems.reduce((s, d) => s + d.payout_amount, 0),
      totalClasses: passItems.reduce((s, d) => s + d.total_classes, 0),
      count: passItems.length,
    };

    return NextResponse.json({
      earnings: items,
      summary,
      passDistributions: passItems,
      passSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
