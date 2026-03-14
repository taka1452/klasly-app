import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { DEFAULT_FEATURES } from "@/lib/features/feature-keys";

async function getAdminSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );
  }
  return createServerClient();
}

// GET: Get all feature flags for a studio (merged with defaults)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studioId } = await params;
    const supabase = await getAdminSupabase();

    const { data, error } = await supabase
      .from("studio_features")
      .select("feature_key, enabled, metadata, updated_at")
      .eq("studio_id", studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build complete feature map with defaults
    const features: Record<
      string,
      { enabled: boolean; isDefault: boolean; metadata?: Record<string, unknown>; updatedAt?: string }
    > = {};

    for (const [key, defaultVal] of Object.entries(DEFAULT_FEATURES)) {
      features[key] = { enabled: defaultVal, isDefault: true };
    }

    if (data) {
      for (const row of data) {
        features[row.feature_key] = {
          enabled: row.enabled,
          isDefault: false,
          metadata: row.metadata,
          updatedAt: row.updated_at,
        };
      }
    }

    return NextResponse.json(features);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Toggle a feature flag for a studio
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studioId } = await params;
    const body = await request.json();
    const { feature_key, enabled } = body;

    if (!feature_key || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "feature_key and enabled (boolean) are required" },
        { status: 400 }
      );
    }

    const supabase = await getAdminSupabase();

    const { data, error } = await supabase
      .from("studio_features")
      .upsert(
        {
          studio_id: studioId,
          feature_key,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,feature_key" }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
