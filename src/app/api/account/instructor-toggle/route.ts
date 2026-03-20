import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

/**
 * POST: オーナー/マネージャーが自分をインストラクターとしても登録/解除する
 * body: { action: "enable" | "disable" }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // マネージャーの場合、can_teach 権限を確認
    if (ctx.role === "manager") {
      if (!ctx.permissions?.can_teach) {
        return NextResponse.json(
          { error: "Not authorized to teach. Ask the studio owner to enable this." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { action } = body;

    if (action !== "enable" && action !== "disable") {
      return NextResponse.json(
        { error: "action must be 'enable' or 'disable'" },
        { status: 400 }
      );
    }

    if (action === "enable") {
      // 既に存在するか確認
      const { data: existing } = await ctx.supabase
        .from("instructors")
        .select("id")
        .eq("profile_id", ctx.userId)
        .eq("studio_id", ctx.studioId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, enabled: true });
      }

      const { error } = await ctx.supabase
        .from("instructors")
        .insert({
          studio_id: ctx.studioId,
          profile_id: ctx.userId,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, enabled: true });
    }

    // action === "disable"
    // 紐づくアクティブなクラスがあるか確認
    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", ctx.userId)
      .eq("studio_id", ctx.studioId)
      .maybeSingle();

    if (!instructor) {
      return NextResponse.json({ success: true, enabled: false });
    }

    const { count } = await ctx.supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", instructor.id)
      .eq("is_active", true);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Cannot disable while you have active classes. Deactivate or reassign them first." },
        { status: 409 }
      );
    }

    const { error } = await ctx.supabase
      .from("instructors")
      .delete()
      .eq("id", instructor.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabled: false });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
