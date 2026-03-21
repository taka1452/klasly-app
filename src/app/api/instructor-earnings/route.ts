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

    // session_date ベースでフィルター（月末セッションの収益が翌月の created_at で記録されるケースに対応）
    // まず対象月のセッションIDを取得
    const { data: monthSessions } = await adminSupabase
      .from("class_sessions")
      .select("id")
      .eq("instructor_id", instructor.id)
      .gte("session_date", startDate)
      .lt("session_date", endDate);

    const monthSessionIds = (monthSessions || []).map((s: { id: string }) => s.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let earnings: any[] = [];
    if (monthSessionIds.length > 0) {
      const { data: earningsData } = await adminSupabase
        .from("instructor_earnings")
        .select(
          "id, gross_amount, stripe_fee, platform_fee, studio_fee, instructor_payout, studio_fee_percentage, status, created_at, session_id, class_sessions(session_date, start_time, classes(name))"
        )
        .eq("instructor_id", instructor.id)
        .in("session_id", monthSessionIds)
        .order("created_at", { ascending: false });
      earnings = earningsData ?? [];
    }

    // session_id が null の収益（パス配分など）は created_at でフォールバック
    const { data: noSessionEarnings } = await adminSupabase
      .from("instructor_earnings")
      .select(
        "id, gross_amount, stripe_fee, platform_fee, studio_fee, instructor_payout, studio_fee_percentage, status, created_at, session_id, class_sessions(session_date, start_time, classes(name))"
      )
      .eq("instructor_id", instructor.id)
      .is("session_id", null)
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: false });

    // マージして重複排除
    const earningIds = new Set(earnings.map((e: { id: string }) => e.id));
    const mergedEarnings = [
      ...earnings,
      ...(noSessionEarnings || []).filter((e: { id: string }) => !earningIds.has(e.id)),
    ];

    // Calculate summary
    const items = mergedEarnings;
    const summary = {
      totalGross: items.reduce((s: number, e: { gross_amount: number }) => s + e.gross_amount, 0),
      totalStripeFee: items.reduce((s: number, e: { stripe_fee: number }) => s + e.stripe_fee, 0),
      totalPlatformFee: items.reduce((s: number, e: { platform_fee: number }) => s + e.platform_fee, 0),
      totalStudioFee: items.reduce((s: number, e: { studio_fee: number }) => s + e.studio_fee, 0),
      totalPayout: items.reduce((s: number, e: { instructor_payout: number }) => s + e.instructor_payout, 0),
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
