import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET /api/passes/distributions?period=YYYY-MM
 * Returns distribution records for the given month.
 */
export async function GET(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period"); // YYYY-MM
    if (!period) return NextResponse.json({ error: "period param required (YYYY-MM)" }, { status: 400 });

    const [year, month] = period.split("-").map(Number);
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: distributions } = await adminSupabase
      .from("pass_distributions")
      .select("id, studio_pass_id, instructor_id, period_start, period_end, total_classes, total_pool_classes, gross_pool_amount, payout_amount, stripe_transfer_id, status, approved_at, created_at")
      .eq("studio_id", profile.studio_id)
      .gte("period_start", periodStart)
      .lte("period_start", periodEnd)
      .order("total_classes", { ascending: false });

    // Get instructor names
    const instructorIds = Array.from(new Set((distributions ?? []).map((d: { instructor_id: string }) => d.instructor_id)));
    let instructorNames: Record<string, string> = {};
    if (instructorIds.length > 0) {
      const { data: instructors } = await adminSupabase
        .from("instructors")
        .select("id, profile_id")
        .in("id", instructorIds);

      if (instructors && instructors.length > 0) {
        const profileIds = instructors.map((i) => i.profile_id).filter(Boolean);
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds);

        const profileNameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
        for (const inst of instructors) {
          instructorNames[inst.id] = profileNameMap.get(inst.profile_id) ?? "Unknown";
        }
      }
    }

    // Get pass info
    const passIds = Array.from(new Set((distributions ?? []).map((d: { studio_pass_id: string }) => d.studio_pass_id)));
    let passInfo: Record<string, { name: string; price_cents: number }> = {};
    if (passIds.length > 0) {
      const { data: passes } = await adminSupabase
        .from("studio_passes")
        .select("id, name, price_cents")
        .in("id", passIds);
      for (const p of passes ?? []) {
        passInfo[p.id] = { name: p.name, price_cents: p.price_cents };
      }
    }

    // Get studio fee info
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("studio_fee_percentage")
      .eq("id", profile.studio_id)
      .single();

    const { data: feeRow } = await adminSupabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();

    return NextResponse.json({
      distributions: distributions ?? [],
      instructorNames,
      passInfo,
      fees: {
        studioFeePercent: studio?.studio_fee_percentage ?? 0,
        platformFeePercent: parseFloat(feeRow?.value ?? "0.5"),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/passes/distributions
 * Update a single distribution's payout_amount (manual adjustment).
 * Body: { distributionId, payout_amount }
 */
export async function PUT(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabledPut = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabledPut) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { distributionId, payout_amount } = body;

    if (!distributionId || typeof payout_amount !== "number" || payout_amount < 0) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    // Verify distribution belongs to this studio and is still pending
    const { data: dist } = await adminSupabase
      .from("pass_distributions")
      .select("id, status, studio_id, studio_pass_id, gross_pool_amount")
      .eq("id", distributionId)
      .single();

    if (!dist || dist.studio_id !== profile.studio_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (dist.status !== "pending") {
      return NextResponse.json({ error: "Can only adjust pending distributions" }, { status: 400 });
    }

    // Validate total doesn't exceed distributable amount
    const roundedAmount = Math.round(payout_amount);
    const { data: siblings } = await adminSupabase
      .from("pass_distributions")
      .select("id, payout_amount")
      .eq("studio_pass_id", dist.studio_pass_id)
      .eq("period_start", (await adminSupabase
        .from("pass_distributions")
        .select("period_start")
        .eq("id", distributionId)
        .single()).data?.period_start ?? "")
      .neq("id", distributionId);

    const othersTotal = (siblings ?? []).reduce((sum, s) => sum + s.payout_amount, 0);
    if (othersTotal + roundedAmount > dist.gross_pool_amount) {
      return NextResponse.json(
        { error: `Total payouts ($${((othersTotal + roundedAmount) / 100).toFixed(2)}) would exceed distributable amount ($${(dist.gross_pool_amount / 100).toFixed(2)}).` },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase
      .from("pass_distributions")
      .update({ payout_amount: roundedAmount })
      .eq("id", distributionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/passes/distributions
 * Approve all pending distributions for a given period.
 * Body: { period: "YYYY-MM" }
 */
export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role, id")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabledPost = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabledPost) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { period } = body; // "YYYY-MM"
    if (!period) return NextResponse.json({ error: "period is required" }, { status: 400 });

    const [year, month] = period.split("-").map(Number);
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { error, count } = await adminSupabase
      .from("pass_distributions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: profile.id,
      })
      .eq("studio_id", profile.studio_id)
      .eq("status", "pending")
      .gte("period_start", periodStart)
      .lte("period_start", periodEnd);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true, approved: count ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
