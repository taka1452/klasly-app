import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/waiver-templates
 * List all waiver templates for the active studio. Used by:
 *   - class / event editors to populate the "Required waivers" picker
 *   - the in-checkout sign-waiver modal (T2-1) — when ?ids=a,b is given,
 *     returns the full content for those templates so the member can
 *     read + sign without leaving the booking flow.
 * Access: Owner, Manager, Instructor — and Member when fetching by
 * explicit ids that belong to their studio.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const requestedIds = idsParam
      ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const includeContent = !!requestedIds;

    let supabase: import("@supabase/supabase-js").SupabaseClient | null = null;
    let studioId: string | null = null;

    const dashCtx = await getDashboardContext();
    if (dashCtx) {
      supabase = dashCtx.supabase;
      studioId = dashCtx.studioId;
    } else {
      const instrCtx = await getInstructorContext();
      if (instrCtx) {
        supabase = instrCtx.supabase;
        studioId = instrCtx.studioId;
      }
    }

    // Member fallback — when fetching by ids for the sign-waiver modal.
    if (!supabase || !studioId) {
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
        .select("studio_id")
        .eq("id", user.id)
        .single();
      if (!profile?.studio_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      supabase = adminSupabase;
      studioId = profile.studio_id;
    }

    const columns = includeContent
      ? "id, title, content, is_active, waiver_type"
      : "id, title, is_active, waiver_type";

    let query = supabase
      .from("waiver_templates")
      .select(columns)
      .eq("studio_id", studioId)
      .order("title", { ascending: true });
    if (requestedIds && requestedIds.length > 0) {
      query = query.in("id", requestedIds);
    }
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
