import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST: オーナーがメンバーのクレジットを調整（絶対値で設定）
 * body: { member_id: string, credits: number }
 * credits: 新しいクレジット数（0以上の整数。-1無制限は別途プラン変更で対応）
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

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { member_id: memberId, credits } = body;

    if (memberId == null || credits === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: member_id, credits" },
        { status: 400 }
      );
    }

    const creditsNum = Number(credits);
    if (!Number.isInteger(creditsNum) || creditsNum < 0) {
      return NextResponse.json(
        { error: "credits must be a non-negative integer" },
        { status: 400 }
      );
    }

    const { data: member } = await adminSupabase
      .from("members")
      .select("id, studio_id")
      .eq("id", memberId)
      .single();

    if (!member || member.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { error } = await adminSupabase
      .from("members")
      .update({ credits: creditsNum })
      .eq("id", memberId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, credits: creditsNum });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
