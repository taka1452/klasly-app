import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { DEFAULT_FEATURES } from "@/lib/features/feature-keys";

/**
 * GET /api/studio/features
 * Returns all feature flags for the authenticated owner's studio.
 *
 * PUT /api/studio/features
 * Toggle a feature flag. Body: { feature_key: string, enabled: boolean }
 *
 * PUT (bulk) /api/studio/features
 * Bulk set features. Body: { features: Record<string, boolean> }
 */

async function getOwnerStudioId() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
    return null;
  }

  return { studioId: profile.studio_id as string, supabase };
}

export async function GET() {
  try {
    const result = await getOwnerStudioId();
    if (!result) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studioId, supabase } = result;

    const { data, error } = await supabase
      .from("studio_features")
      .select("feature_key, enabled")
      .eq("studio_id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Merge with defaults
    const features: Record<string, boolean> = { ...DEFAULT_FEATURES };
    if (data) {
      for (const row of data) {
        features[row.feature_key] = row.enabled;
      }
    }

    return NextResponse.json(features);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const result = await getOwnerStudioId();
    if (!result) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studioId, supabase } = result;
    const body = await request.json();

    // Bulk mode: { features: { "key": true, ... } }
    if (body.features && typeof body.features === "object") {
      const entries = Object.entries(body.features) as [string, boolean][];
      const upserts = entries.map(([key, enabled]) => ({
        studio_id: studioId,
        feature_key: key,
        enabled,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("studio_features")
        .upsert(upserts, { onConflict: "studio_id,feature_key" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Single mode: { feature_key: "...", enabled: true/false }
    const { feature_key, enabled } = body;
    if (!feature_key || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "feature_key and enabled (boolean) are required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("studio_features")
      .upsert(
        {
          studio_id: studioId,
          feature_key,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,feature_key" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, feature_key, enabled });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
