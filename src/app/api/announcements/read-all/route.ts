import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
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
      return NextResponse.json({ success: true });
    }

    // アクティブな通知を取得
    const { data: announcements } = await supabase
      .from("announcements")
      .select("id, target_roles")
      .eq("is_active", true);

    if (!announcements || announcements.length === 0) {
      return NextResponse.json({ success: true });
    }

    // ロールでフィルタ
    const roleFiltered = announcements.filter((a) =>
      (a.target_roles as string[]).includes(profile.role)
    );

    // 既読を取得
    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("profile_id", user.id);

    const readIds = new Set((reads || []).map((r) => r.announcement_id));

    // 未読のみ既読にする
    const unreadIds = roleFiltered
      .filter((a) => !readIds.has(a.id))
      .map((a) => a.id);

    if (unreadIds.length > 0) {
      const inserts = unreadIds.map((announcement_id) => ({
        announcement_id,
        profile_id: user.id,
      }));

      await supabase.from("announcement_reads").upsert(inserts, {
        onConflict: "announcement_id,profile_id",
      });
    }

    return NextResponse.json({ success: true, marked: unreadIds.length });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
