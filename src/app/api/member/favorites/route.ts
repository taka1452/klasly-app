import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/favorites
 * Returns all favorites for the current member.
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
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: member } = await supabase
      .from("members")
      .select("id, studio_id")
      .eq("profile_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ favorites: [] });
    }

    const enabled = await isFeatureEnabled(supabase, member.studio_id, FEATURE_KEYS.MEMBER_FAVORITES);
    if (!enabled) {
      return NextResponse.json({ favorites: [] });
    }

    const { data: favorites } = await supabase
      .from("member_favorites")
      .select("id, favorite_type, target_id, created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ favorites: favorites || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/member/favorites
 * Add a favorite. Body: { favorite_type: "class"|"instructor", target_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { favorite_type, target_id } = body;

    if (!favorite_type || !target_id) {
      return NextResponse.json(
        { error: "favorite_type and target_id are required" },
        { status: 400 },
      );
    }

    if (!["class", "instructor"].includes(favorite_type)) {
      return NextResponse.json(
        { error: "favorite_type must be 'class' or 'instructor'" },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: member } = await supabase
      .from("members")
      .select("id, studio_id")
      .eq("profile_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const enabled = await isFeatureEnabled(supabase, member.studio_id, FEATURE_KEYS.MEMBER_FAVORITES);
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { data: favorite, error } = await supabase
      .from("member_favorites")
      .upsert(
        {
          member_id: member.id,
          studio_id: member.studio_id,
          favorite_type,
          target_id,
        },
        { onConflict: "member_id,favorite_type,target_id" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ favorite });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/member/favorites?favorite_type=class&target_id=xxx
 * Remove a favorite.
 */
export async function DELETE(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const favorite_type = searchParams.get("favorite_type");
    const target_id = searchParams.get("target_id");

    if (!favorite_type || !target_id) {
      return NextResponse.json(
        { error: "favorite_type and target_id are required" },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    const { data: member } = await supabase
      .from("members")
      .select("id, studio_id")
      .eq("profile_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await supabase
      .from("member_favorites")
      .delete()
      .eq("member_id", member.id)
      .eq("favorite_type", favorite_type)
      .eq("target_id", target_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
