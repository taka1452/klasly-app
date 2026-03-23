import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getOwnerContext() {
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
    .select("role, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.studio_id) return null;
  if (profile.role !== "owner" && profile.role !== "manager") return null;

  // マネージャーの場合はメッセージ送信権限を検証
  if (profile.role === "manager") {
    const { data: mgr } = await supabase
      .from("managers")
      .select("can_send_messages")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!mgr?.can_send_messages) return null;
  }

  return { supabase, userId: user.id, studioId: profile.studio_id };
}

// GET: スタジオのアナウンス一覧
export async function GET() {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await ctx.supabase
      .from("announcements")
      .select("*")
      .eq("studio_id", ctx.studioId)
      .order("published_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: 新規作成
export async function POST(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, body: announcementBody, target_roles } = body;

    if (!title || !announcementBody) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("announcements")
      .insert({
        title,
        body: announcementBody,
        target_roles: target_roles || ["instructor", "member"],
        studio_id: ctx.studioId,
        created_by: ctx.userId,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: is_active の切り替え
export async function PATCH(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, is_active } = body;

    if (!id || is_active === undefined) {
      return NextResponse.json({ error: "id and is_active are required" }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("announcements")
      .update({ is_active })
      .eq("id", id)
      .eq("studio_id", ctx.studioId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: アナウンス削除
export async function DELETE(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("studio_id", ctx.studioId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
