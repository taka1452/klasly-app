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

    // Managers need can_view_payments or can_manage_instructors
    if (profile.role === "manager") {
      const { data: mgr } = await adminSupabase
        .from("managers")
        .select("can_view_payments, can_manage_instructors")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!mgr?.can_view_payments && !mgr?.can_manage_instructors) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

    let earnings: Record<string, unknown>[] = [];
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
    const earningIds = new Set(earnings.map((e) => e.id));
    const mergedEarnings = [
      ...earnings,
      ...(noSessionEarnings || []).filter((e) => !earningIds.has(e.id)),
    ];

    // Calculate summary
    const items = mergedEarnings;
    const num = (v: unknown) => (typeof v === "number" ? v : 0);
    const summary = {
      totalGross: items.reduce((s, e) => s + num(e.gross_amount), 0),
      totalStripeFee: items.reduce((s, e) => s + num(e.stripe_fee), 0),
      totalPlatformFee: items.reduce((s, e) => s + num(e.platform_fee), 0),
      totalStudioFee: items.reduce((s, e) => s + num(e.studio_fee), 0),
      totalPayout: items.reduce((s, e) => s + num(e.instructor_payout), 0),
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

    // Personal best + active streak: pull all-time completed earnings,
    // bucket by month, compare against the selected month.
    let isPersonalBest = false;
    let streakMonths = 0;
    try {
      const { data: allCompleted } = await adminSupabase
        .from("instructor_earnings")
        .select("instructor_payout, created_at")
        .eq("instructor_id", instructor.id)
        .eq("status", "completed");
      const monthSums = new Map<string, number>();
      for (const row of (allCompleted ?? []) as Array<{
        instructor_payout: number;
        created_at: string;
      }>) {
        const d = new Date(row.created_at);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        monthSums.set(key, (monthSums.get(key) ?? 0) + (row.instructor_payout ?? 0));
      }
      const selectedKey = `${year}-${String(month).padStart(2, "0")}`;
      const selectedTotal = monthSums.get(selectedKey) ?? 0;
      if (selectedTotal > 0) {
        let max = 0;
        for (const [k, v] of Array.from(monthSums.entries())) {
          if (k === selectedKey) continue;
          if (v > max) max = v;
        }
        if (selectedTotal > max) isPersonalBest = true;
      }
      // Walk backwards from selected month — count consecutive months
      // with payout > 0.
      let cursorY = year;
      let cursorM = month;
      while (true) {
        const key = `${cursorY}-${String(cursorM).padStart(2, "0")}`;
        if ((monthSums.get(key) ?? 0) <= 0) break;
        streakMonths += 1;
        cursorM -= 1;
        if (cursorM === 0) {
          cursorM = 12;
          cursorY -= 1;
        }
        if (streakMonths > 24) break; // safety
      }
    } catch {
      /* decorative — never block */
    }

    return NextResponse.json({
      earnings: items,
      summary,
      passDistributions: passItems,
      passSummary,
      motivation: { isPersonalBest, streakMonths },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
