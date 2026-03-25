import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const dashCtx = await getDashboardContext();
    if (!dashCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (dashCtx.role === "manager" && !dashCtx.permissions?.can_manage_classes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates: { id: string; sort_order: number }[] = body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    // バッチ更新（各テンプレートの sort_order を更新）
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        dashCtx.supabase
          .from("class_templates")
          .update({ sort_order })
          .eq("id", id)
          .eq("studio_id", dashCtx.studioId)
      )
    );

    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      return NextResponse.json(
        { error: `Failed to update ${failed.length} items` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
