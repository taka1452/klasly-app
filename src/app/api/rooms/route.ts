import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

// POST: 新規ルーム作成（権限チェック付き）
export async function POST(request: Request) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // マネージャーの場合、can_manage_rooms 権限を確認
    if (ctx.role === "manager" && !ctx.permissions?.can_manage_rooms) {
      return NextResponse.json(
        { error: "You don't have permission to manage rooms" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, capacity } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 }
      );
    }

    if (capacity !== undefined && capacity !== null && (typeof capacity !== "number" || capacity < 1)) {
      return NextResponse.json(
        { error: "Capacity must be a positive number" },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.supabase
      .from("rooms")
      .insert({
        studio_id: ctx.studioId,
        name: name.trim(),
        description: description || null,
        capacity: capacity ?? null,
        is_active: true,
      })
      .select("id, name, description, capacity")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
