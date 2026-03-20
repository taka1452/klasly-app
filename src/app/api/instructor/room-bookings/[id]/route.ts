import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

// PATCH: ブッキング更新
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 自分のブッキングか確認
    const { data: existing } = await ctx.supabase
      .from("instructor_room_bookings")
      .select("id, instructor_id, room_id, booking_date")
      .eq("id", id)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.is_public !== undefined) updates.is_public = body.is_public;
    if (body.notes !== undefined) updates.notes = body.notes || null;

    // 時間変更がある場合は重複チェック
    if (updates.start_time || updates.end_time) {
      const newStart = (updates.start_time || body.start_time) as string;
      const newEnd = (updates.end_time || body.end_time) as string;

      if (newEnd <= newStart) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }

      const { data: conflicts } = await ctx.supabase
        .from("instructor_room_bookings")
        .select("id")
        .eq("room_id", existing.room_id)
        .eq("booking_date", existing.booking_date)
        .eq("status", "confirmed")
        .neq("id", id)
        .lt("start_time", newEnd)
        .gt("end_time", newStart);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "This room is already booked during that time" },
          { status: 409 }
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("instructor_room_bookings")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: ブッキングをキャンセル（ソフトデリート）
// ?cancel_future=true で同じ recurrence group の未来分を一括キャンセル
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existing } = await ctx.supabase
      .from("instructor_room_bookings")
      .select("id, instructor_id, recurrence_group_id, booking_date")
      .eq("id", id)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const cancelFuture = url.searchParams.get("cancel_future") === "true";

    if (cancelFuture && existing.recurrence_group_id) {
      // Cancel all future bookings in the same recurrence group
      const today = new Date().toISOString().split("T")[0];
      const { data: cancelled, error } = await ctx.supabase
        .from("instructor_room_bookings")
        .update({ status: "cancelled" })
        .eq("recurrence_group_id", existing.recurrence_group_id)
        .eq("instructor_id", ctx.instructorId)
        .eq("status", "confirmed")
        .gte("booking_date", today)
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        cancelled_count: cancelled?.length ?? 0,
      });
    }

    // Single booking cancel
    const { error } = await ctx.supabase
      .from("instructor_room_bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

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
