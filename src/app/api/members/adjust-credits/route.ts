import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

/**
 * POST: オーナーまたはマネージャー(can_manage_members)がメンバーのクレジットを調整（絶対値で設定）
 * body: { member_id: string, credits: number }
 * credits: 新しいクレジット数（0以上の整数。-1無制限は別途プラン変更で対応）
 */
export async function POST(request: Request) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (ctx.role === "manager" && !ctx.permissions?.can_manage_members) {
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
    // -1 = Unlimited, 0以上 = クレジット数
    if (!Number.isInteger(creditsNum) || (creditsNum < 0 && creditsNum !== -1)) {
      return NextResponse.json(
        { error: "credits must be a non-negative integer or -1 (unlimited)" },
        { status: 400 }
      );
    }

    const { data: member } = await ctx.supabase
      .from("members")
      .select("id, studio_id")
      .eq("id", memberId)
      .single();

    if (!member || member.studio_id !== ctx.studioId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { error } = await ctx.supabase
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
