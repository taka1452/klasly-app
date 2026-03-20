import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

/**
 * Backward-compatible wrapper around class_sessions for room booking
 * PATCH/DELETE operations. instructor_room_bookings is deprecated.
 */

// PATCH: セッション更新
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

    // 自分のセッションか確認
    const { data: existing } = await ctx.supabase
      .from("class_sessions")
      .select("id, instructor_id, room_id, session_date")
      .eq("id", id)
      .eq("is_cancelled", false)
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
    if (body.notes !== undefined) updates.location = body.notes || null;

    // 時間変更がある場合は重複チェック (class_sessions)
    if (updates.start_time || updates.end_time) {
      const newStart = (updates.start_time || body.start_time) as string;
      const newEnd = (updates.end_time || body.end_time) as string;

      if (newEnd <= newStart) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }

      // Recalculate duration_minutes
      const [sh, sm] = newStart.split(":").map(Number);
      const [eh, em] = newEnd.split(":").map(Number);
      updates.duration_minutes = (eh * 60 + em) - (sh * 60 + sm);

      const { data: conflicts } = await ctx.supabase
        .from("class_sessions")
        .select("id")
        .eq("room_id", existing.room_id)
        .eq("session_date", existing.session_date)
        .eq("is_cancelled", false)
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
      .from("class_sessions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return backward-compatible format
    return NextResponse.json({
      id: data.id,
      studio_id: data.studio_id,
      instructor_id: data.instructor_id,
      room_id: data.room_id,
      title: data.title,
      booking_date: data.session_date,
      start_time: data.start_time,
      end_time: data.end_time,
      is_public: data.is_public,
      notes: data.location,
      status: data.is_cancelled ? "cancelled" : "confirmed",
      recurrence_group_id: data.recurrence_group_id,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: セッションをキャンセル（is_cancelled = true）
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
      .from("class_sessions")
      .select("id, instructor_id, recurrence_group_id, session_date")
      .eq("id", id)
      .eq("is_cancelled", false)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const cancelFuture = url.searchParams.get("cancel_future") === "true";

    if (cancelFuture && existing.recurrence_group_id) {
      // Cancel all future sessions in the same recurrence group
      const today = new Date().toISOString().split("T")[0];
      const { data: cancelled, error } = await ctx.supabase
        .from("class_sessions")
        .update({ is_cancelled: true })
        .eq("recurrence_group_id", existing.recurrence_group_id)
        .eq("instructor_id", ctx.instructorId)
        .eq("is_cancelled", false)
        .gte("session_date", today)
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        cancelled_count: cancelled?.length ?? 0,
      });
    }

    // Single session cancel
    const { error } = await ctx.supabase
      .from("class_sessions")
      .update({ is_cancelled: true })
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
