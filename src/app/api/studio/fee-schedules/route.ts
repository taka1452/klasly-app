import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET /api/studio/fee-schedules
 * 時間帯別料金ルール一覧
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
      FEATURE_KEYS.FEE_SCHEDULES
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    const { data: schedules } = await adminSupabase
      .from("fee_schedules")
      .select("*")
      .eq("studio_id", profile.studio_id)
      .order("priority", { ascending: false });

    return NextResponse.json({ schedules: schedules ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/studio/fee-schedules
 * 新しい時間帯ルールを作成
 */
export async function POST(request: Request) {
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
      FEATURE_KEYS.FEE_SCHEDULES
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, day_of_week, start_time, end_time, fee_type, fee_value, priority } = body;

    if (!name || !start_time || !end_time) {
      return NextResponse.json(
        { error: "name, start_time, and end_time are required" },
        { status: 400 }
      );
    }

    if (!fee_type || (fee_type !== "percentage" && fee_type !== "fixed")) {
      return NextResponse.json(
        { error: "fee_type must be 'percentage' or 'fixed'" },
        { status: 400 }
      );
    }

    if (fee_value === undefined || fee_value === null || fee_value < 0) {
      return NextResponse.json(
        { error: "fee_value must be >= 0" },
        { status: 400 }
      );
    }

    if (fee_type === "percentage" && fee_value > 100) {
      return NextResponse.json(
        { error: "Percentage fee_value must be between 0 and 100" },
        { status: 400 }
      );
    }

    const { data, error } = await adminSupabase
      .from("fee_schedules")
      .insert({
        studio_id: profile.studio_id,
        name,
        day_of_week: day_of_week ?? null,
        start_time,
        end_time,
        fee_type,
        fee_value,
        priority: priority ?? 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/studio/fee-schedules
 * 時間帯ルールを更新
 */
export async function PUT(request: Request) {
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

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Clean updates
    const cleanUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.day_of_week !== undefined) cleanUpdates.day_of_week = updates.day_of_week;
    if (updates.start_time !== undefined) cleanUpdates.start_time = updates.start_time;
    if (updates.end_time !== undefined) cleanUpdates.end_time = updates.end_time;
    if (updates.fee_type !== undefined) cleanUpdates.fee_type = updates.fee_type;
    if (updates.fee_value !== undefined) cleanUpdates.fee_value = updates.fee_value;
    if (updates.priority !== undefined) cleanUpdates.priority = updates.priority;
    if (updates.is_active !== undefined) cleanUpdates.is_active = updates.is_active;
    cleanUpdates.updated_at = new Date().toISOString();

    await adminSupabase
      .from("fee_schedules")
      .update(cleanUpdates)
      .eq("id", id)
      .eq("studio_id", profile.studio_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/studio/fee-schedules
 * 時間帯ルールを削除
 */
export async function DELETE(request: Request) {
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

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    await adminSupabase
      .from("fee_schedules")
      .delete()
      .eq("id", id)
      .eq("studio_id", profile.studio_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
