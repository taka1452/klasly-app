import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";

/**
 * GET /api/referral/code
 * 自分のスタジオのreferral_codeを取得。なければ生成して返す。
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

    const adminDb = createAdminClient();

    const { data: profile } = await adminDb
      .from("profiles")
      .select("role, studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id || (profile.role !== "owner" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 既存のコードを確認
    const { data: existing } = await adminDb
      .from("referral_codes")
      .select("code")
      .eq("studio_id", profile.studio_id)
      .single();

    if (existing) {
      return NextResponse.json({ code: existing.code });
    }

    // なければ生成（リトライ付き）
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { error } = await adminDb
        .from("referral_codes")
        .insert({ studio_id: profile.studio_id, code });

      if (!error) {
        return NextResponse.json({ code });
      }
      // UNIQUE制約違反の場合はリトライ
    }

    return NextResponse.json(
      { error: "Failed to generate referral code" },
      { status: 500 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
