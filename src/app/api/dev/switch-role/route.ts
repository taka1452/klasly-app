import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/dev/switch-role
 * デモスタジオの全アカウント一覧を取得
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

    // Get current user's profile and studio
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "No studio" }, { status: 400 });
    }

    // Check if studio is demo
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("is_demo, name")
      .eq("id", profile.studio_id)
      .single();

    if (!studio?.is_demo) {
      return NextResponse.json(
        { error: "Only available for demo studios" },
        { status: 403 }
      );
    }

    // Get all profiles in this studio
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("studio_id", profile.studio_id)
      .order("role");

    return NextResponse.json({
      studioName: studio.name,
      currentUserId: user.id,
      currentRole: profile.role,
      accounts: (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "Unknown",
        email: p.email ?? "",
        role: p.role,
        isCurrent: p.id === user.id,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/dev/switch-role
 * デモスタジオ内の別アカウントにログインするマジックリンクを生成
 */
export async function POST(request: Request) {
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

    // Get current user's studio
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "No studio" }, { status: 400 });
    }

    // Verify demo studio
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("is_demo")
      .eq("id", profile.studio_id)
      .single();

    if (!studio?.is_demo) {
      return NextResponse.json(
        { error: "Only available for demo studios" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetProfileId } = body;

    if (!targetProfileId) {
      return NextResponse.json(
        { error: "targetProfileId is required" },
        { status: 400 }
      );
    }

    // Verify target profile belongs to same studio
    const { data: targetProfile } = await adminSupabase
      .from("profiles")
      .select("id, email, studio_id")
      .eq("id", targetProfileId)
      .single();

    if (!targetProfile || targetProfile.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Target user not found in this studio" },
        { status: 404 }
      );
    }

    if (!targetProfile.email) {
      return NextResponse.json(
        { error: "Target user has no email" },
        { status: 400 }
      );
    }

    // Generate magic link using admin API
    const { data: linkData, error: linkError } =
      await adminSupabase.auth.admin.generateLink({
        type: "magiclink",
        email: targetProfile.email,
      });

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: linkError?.message ?? "Failed to generate link" },
        { status: 500 }
      );
    }

    // The generated link has hashed_token and verification_type
    // We need to construct the redirect URL using the auth callback
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://app.klasly.app";

    // Use the token_hash from the generated link
    const properties = linkData.properties;
    const tokenHash = properties?.hashed_token;

    if (!tokenHash) {
      return NextResponse.json(
        { error: "Failed to generate token" },
        { status: 500 }
      );
    }

    // Construct the verify URL that Supabase will handle
    const verifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent(origin + "/auth/callback")}`;

    return NextResponse.json({ url: verifyUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
