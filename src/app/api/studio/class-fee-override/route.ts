import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET /api/studio/class-fee-override?classId=xxx
 * クラス別料率を取得
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

    // Feature flag check
    const enabled = await isFeatureEnabled(
      profile.studio_id,
      FEATURE_KEYS.CLASS_FEE_OVERRIDE
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");

    if (classId) {
      const { data: override } = await adminSupabase
        .from("class_fee_overrides")
        .select("*")
        .eq("studio_id", profile.studio_id)
        .eq("class_id", classId)
        .maybeSingle();

      return NextResponse.json({ override });
    }

    const { data: overrides } = await adminSupabase
      .from("class_fee_overrides")
      .select("*, classes(name)")
      .eq("studio_id", profile.studio_id);

    return NextResponse.json({ overrides: overrides ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/studio/class-fee-override
 * クラス別料率を作成・更新（upsert）
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

    const enabled = await isFeatureEnabled(
      profile.studio_id,
      FEATURE_KEYS.CLASS_FEE_OVERRIDE
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Feature not enabled" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { class_id, fee_type, fee_value } = body;

    if (!class_id) {
      return NextResponse.json(
        { error: "class_id is required" },
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

    // Verify the class belongs to this studio
    const { data: classData } = await adminSupabase
      .from("classes")
      .select("id")
      .eq("id", class_id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!classData) {
      return NextResponse.json(
        { error: "Class not found in this studio" },
        { status: 404 }
      );
    }

    await adminSupabase
      .from("class_fee_overrides")
      .upsert(
        {
          studio_id: profile.studio_id,
          class_id,
          fee_type,
          fee_value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,class_id" }
      );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/studio/class-fee-override
 * クラス別料率を削除
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
    const { class_id } = body;

    if (!class_id) {
      return NextResponse.json(
        { error: "class_id is required" },
        { status: 400 }
      );
    }

    await adminSupabase
      .from("class_fee_overrides")
      .delete()
      .eq("studio_id", profile.studio_id)
      .eq("class_id", class_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
