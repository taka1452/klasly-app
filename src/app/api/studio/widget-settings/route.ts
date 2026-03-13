import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

// ============================================================
// GET /api/studio/widget-settings
//   Returns widget_settings for the authenticated owner's studio.
// ============================================================
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
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: settings } = await adminDb
      .from("widget_settings")
      .select("enabled, theme_color, allowed_origins")
      .eq("studio_id", profile.studio_id)
      .maybeSingle();

    // Return defaults if no row exists yet
    return NextResponse.json({
      studioId: profile.studio_id,
      enabled: settings?.enabled ?? false,
      themeColor: settings?.theme_color ?? "green",
      allowedOrigins: settings?.allowed_origins ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================================
// PUT /api/studio/widget-settings
//   Body: { enabled, themeColor, allowedOrigins }
//   Upserts widget_settings for the authenticated owner's studio.
// ============================================================
export async function PUT(request: NextRequest) {
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
    const { enabled, themeColor, allowedOrigins } = body as {
      enabled?: boolean;
      themeColor?: string;
      allowedOrigins?: string[];
    };

    const validThemes = [
      "green",
      "blue",
      "purple",
      "red",
      "orange",
      "pink",
      "teal",
    ];
    if (themeColor && !validThemes.includes(themeColor)) {
      return NextResponse.json(
        { error: `Invalid theme. Must be one of: ${validThemes.join(", ")}` },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {
      studio_id: profile.studio_id,
      updated_at: new Date().toISOString(),
    };
    if (typeof enabled === "boolean") updateData.enabled = enabled;
    if (themeColor) updateData.theme_color = themeColor;
    if (Array.isArray(allowedOrigins)) updateData.allowed_origins = allowedOrigins;

    const { error } = await adminDb
      .from("widget_settings")
      .upsert(updateData, { onConflict: "studio_id" });

    if (error) {
      console.error("[widget-settings PUT]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
