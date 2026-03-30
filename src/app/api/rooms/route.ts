import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

// DELETE: ルーム削除（権限チェック付き）
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabled = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.ROOM_MANAGEMENT);
    if (!roomEnabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    if (ctx.role === "manager" && !ctx.permissions?.can_manage_rooms) {
      return NextResponse.json(
        { error: "You don't have permission to manage rooms" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("id");

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    // Check if room belongs to this studio
    const { data: room } = await ctx.supabase
      .from("rooms")
      .select("id, studio_id")
      .eq("id", roomId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if room has future sessions
    const today = new Date().toISOString().split("T")[0];
    const { count: futureSessionsCount } = await ctx.supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .gte("session_date", today)
      .eq("is_cancelled", false);

    if ((futureSessionsCount ?? 0) > 0) {
      return NextResponse.json(
        { error: `This room has ${futureSessionsCount} upcoming session(s). Please cancel or reassign them before deleting the room.` },
        { status: 409 }
      );
    }

    // Set room_id to null on past sessions (preserve history)
    await ctx.supabase
      .from("class_sessions")
      .update({ room_id: null })
      .eq("room_id", roomId);

    // Delete the room
    const { error } = await ctx.supabase
      .from("rooms")
      .delete()
      .eq("id", roomId)
      .eq("studio_id", ctx.studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: 新規ルーム作成（権限チェック付き）
export async function POST(request: Request) {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabledPost = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.ROOM_MANAGEMENT);
    if (!roomEnabledPost) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
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
