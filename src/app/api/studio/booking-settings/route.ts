import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

// ============================================================
// PATCH /api/studio/booking-settings
//   Body: { booking_requires_credits: boolean | null }
//   オーナーのみ操作可能
// ============================================================
export async function PATCH(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();

    // プロフィール取得（オーナー確認）
    const { data: profile } = await adminDb
      .from("profiles")
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { booking_requires_credits } = body as {
      booking_requires_credits: boolean | null;
    };

    // null / true / false 以外は拒否
    if (
      booking_requires_credits !== null &&
      typeof booking_requires_credits !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid value. Must be true, false, or null." },
        { status: 400 }
      );
    }

    const { error } = await adminDb
      .from("studios")
      .update({ booking_requires_credits })
      .eq("id", profile.studio_id);

    if (error) {
      console.error("[booking-settings PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, booking_requires_credits });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
