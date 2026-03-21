import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/studio/instructor-fee-override?instructorId=xxx
 * インストラクター別料率を取得
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

    const url = new URL(request.url);
    const instructorId = url.searchParams.get("instructorId");

    if (instructorId) {
      // Get single instructor override
      const { data: override } = await adminSupabase
        .from("instructor_fee_overrides")
        .select("*")
        .eq("studio_id", profile.studio_id)
        .eq("instructor_id", instructorId)
        .maybeSingle();

      return NextResponse.json({ override });
    }

    // Get all overrides for the studio
    const { data: overrides } = await adminSupabase
      .from("instructor_fee_overrides")
      .select("*")
      .eq("studio_id", profile.studio_id);

    return NextResponse.json({ overrides: overrides ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/studio/instructor-fee-override
 * インストラクター別料率を作成・更新（upsert）
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
    const { instructor_id, fee_type, fee_value } = body;

    if (!instructor_id) {
      return NextResponse.json(
        { error: "instructor_id is required" },
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

    // Verify the instructor belongs to this studio
    const { data: instructor } = await adminSupabase
      .from("instructors")
      .select("id")
      .eq("id", instructor_id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor not found in this studio" },
        { status: 404 }
      );
    }

    // Upsert the override
    await adminSupabase
      .from("instructor_fee_overrides")
      .upsert(
        {
          studio_id: profile.studio_id,
          instructor_id,
          fee_type,
          fee_value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,instructor_id" }
      );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/studio/instructor-fee-override
 * インストラクター別料率を削除（スタジオデフォルトに戻す）
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
    const { instructor_id } = body;

    if (!instructor_id) {
      return NextResponse.json(
        { error: "instructor_id is required" },
        { status: 400 }
      );
    }

    // インストラクターがこのスタジオに属しているか確認
    const { data: instructor } = await adminSupabase
      .from("instructors")
      .select("id")
      .eq("id", instructor_id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor not found in this studio" },
        { status: 404 }
      );
    }

    await adminSupabase
      .from("instructor_fee_overrides")
      .delete()
      .eq("studio_id", profile.studio_id)
      .eq("instructor_id", instructor_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
