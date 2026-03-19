import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";

async function getAdminSupabase() {
  const ok = await isAdmin();
  if (!ok) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}

// GET: 全通知一覧
export async function GET() {
  try {
    const supabase = await getAdminSupabase();
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .is("studio_id", null)
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
    const supabase = await getAdminSupabase();
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, body: announcementBody, target_roles } = body;

    if (!title || !announcementBody) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        body: announcementBody,
        target_roles: target_roles || ["owner", "instructor", "member"],
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: is_activeの切り替え
export async function PATCH(request: Request) {
  try {
    const supabase = await getAdminSupabase();
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, is_active } = body;

    if (!id || is_active === undefined) {
      return NextResponse.json({ error: "id and is_active are required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("announcements")
      .update({ is_active })
      .eq("id", id)
      .is("studio_id", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
