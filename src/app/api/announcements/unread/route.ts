import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    // ユーザーのロールを取得
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ unread: [], count: 0 });
    }

    // アクティブな通知を取得
    const { data: announcements } = await supabase
      .from("announcements")
      .select("id, title, body, target_roles, published_at")
      .eq("is_active", true)
      .order("published_at", { ascending: false });

    if (!announcements || announcements.length === 0) {
      return NextResponse.json({ unread: [], count: 0 });
    }

    // ロールでフィルタ
    const roleFiltered = announcements.filter((a) =>
      (a.target_roles as string[]).includes(profile.role)
    );

    if (roleFiltered.length === 0) {
      return NextResponse.json({ unread: [], count: 0 });
    }

    // 既読を取得
    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("profile_id", user.id);

    const readIds = new Set((reads || []).map((r) => r.announcement_id));

    const unread = roleFiltered
      .filter((a) => !readIds.has(a.id))
      .map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        published_at: a.published_at,
      }));

    return NextResponse.json({ unread, count: unread.length });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
