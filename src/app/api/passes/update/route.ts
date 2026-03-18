import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export async function PATCH(request: Request) {
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

    if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Feature flag check
    const passEnabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json({ error: "Studio passes are not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { passId, auto_distribute } = body;

    if (!passId || typeof auto_distribute !== "boolean") {
      return NextResponse.json(
        { error: "passId and auto_distribute are required" },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase
      .from("studio_passes")
      .update({ auto_distribute })
      .eq("id", passId)
      .eq("studio_id", profile.studio_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
