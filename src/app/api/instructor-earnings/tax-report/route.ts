import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET /api/instructor-earnings/tax-report?year=2025
 * 年間税務レポート（1099コンプライアンス）
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

    const enabled = await isFeatureEnabled(
      profile.studio_id,
      FEATURE_KEYS.TAX_REPORT
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get all earnings for this studio in the given year
    const { data: earnings } = await adminSupabase
      .from("instructor_earnings")
      .select("instructor_id, gross_amount, instructor_payout, studio_fee, platform_fee, stripe_fee, status, created_at")
      .eq("studio_id", profile.studio_id)
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", `${endDate}T23:59:59`);

    // Get instructors
    const { data: instructors } = await adminSupabase
      .from("instructors")
      .select("id, profiles(full_name, email)")
      .eq("studio_id", profile.studio_id);

    const instructorMap = new Map(
      (instructors ?? []).map((i) => {
        const prof = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
        return [
          i.id,
          {
            name: (prof as { full_name?: string })?.full_name ?? "Unknown",
            email: (prof as { email?: string })?.email ?? "",
          },
        ];
      })
    );

    // Aggregate by instructor
    const aggregated = new Map<
      string,
      {
        instructor_id: string;
        name: string;
        email: string;
        total_gross: number;
        total_payout: number;
        total_studio_fee: number;
        total_platform_fee: number;
        total_stripe_fee: number;
        transaction_count: number;
      }
    >();

    for (const earning of earnings ?? []) {
      const existing = aggregated.get(earning.instructor_id);
      const info = instructorMap.get(earning.instructor_id) ?? {
        name: "Unknown",
        email: "",
      };

      if (existing) {
        existing.total_gross += earning.gross_amount;
        existing.total_payout += earning.instructor_payout;
        existing.total_studio_fee += earning.studio_fee;
        existing.total_platform_fee += earning.platform_fee;
        existing.total_stripe_fee += earning.stripe_fee;
        existing.transaction_count += 1;
      } else {
        aggregated.set(earning.instructor_id, {
          instructor_id: earning.instructor_id,
          name: info.name,
          email: info.email,
          total_gross: earning.gross_amount,
          total_payout: earning.instructor_payout,
          total_studio_fee: earning.studio_fee,
          total_platform_fee: earning.platform_fee,
          total_stripe_fee: earning.stripe_fee,
          transaction_count: 1,
        });
      }
    }

    const report = Array.from(aggregated.values()).map((item) => ({
      ...item,
      // 1099-NEC threshold: $600
      requires_1099: item.total_payout >= 60000, // cents: $600 = 60000 cents
    }));

    // Sort by total payout descending
    report.sort((a, b) => b.total_payout - a.total_payout);

    const totalGross = report.reduce((sum, r) => sum + r.total_gross, 0);
    const totalPayout = report.reduce((sum, r) => sum + r.total_payout, 0);
    const totalStudioFee = report.reduce((sum, r) => sum + r.total_studio_fee, 0);
    const instructorsRequiring1099 = report.filter((r) => r.requires_1099).length;

    return NextResponse.json({
      year,
      summary: {
        total_gross: totalGross,
        total_payout: totalPayout,
        total_studio_fee: totalStudioFee,
        instructor_count: report.length,
        instructors_requiring_1099: instructorsRequiring1099,
      },
      instructors: report,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
