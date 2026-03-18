import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

const ALLOWED_WEEKS = [4, 6, 8, 12];

// ============================================================
// PATCH /api/studio/schedule-settings
//   Body: { session_generation_weeks: number }
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

    const { data: profile } = await adminDb
      .from("profiles")
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { session_generation_weeks } = body as {
      session_generation_weeks: number;
    };

    if (!ALLOWED_WEEKS.includes(session_generation_weeks)) {
      return NextResponse.json(
        { error: `Invalid value. Must be one of: ${ALLOWED_WEEKS.join(", ")}` },
        { status: 400 }
      );
    }

    const { error } = await adminDb
      .from("studios")
      .update({ session_generation_weeks })
      .eq("id", profile.studio_id);

    if (error) {
      console.error("[schedule-settings PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, session_generation_weeks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
