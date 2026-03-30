import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET /api/appointments/types/member
 * List active appointment types for the authenticated user's studio.
 * Access: any authenticated member of the studio.
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

    const adminDb = createAdminClient();

    const { data: profile } = await adminDb
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { data, error } = await adminDb
      .from("appointment_types")
      .select(
        "id, name, description, duration_minutes, price_cents, buffer_minutes, is_active"
      )
      .eq("studio_id", profile.studio_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ types: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
