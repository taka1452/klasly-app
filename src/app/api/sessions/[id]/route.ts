import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

/**
 * PUT /api/sessions/[id]
 * Update a session.
 * Owner/Manager (can_manage_classes): can update any session in their studio.
 * Instructor: can only update own sessions.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // --- Auth: try dashboard first, then instructor ---
    const dashCtx = await getDashboardContext();

    if (dashCtx) {
      if (
        dashCtx.role === "manager" &&
        !dashCtx.permissions?.can_manage_classes
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Verify session belongs to this studio
      const { data: existing } = await dashCtx.supabase
        .from("class_sessions")
        .select("id, studio_id, room_id, session_date, start_time, end_time")
        .eq("id", id)
        .single();

      if (!existing || existing.studio_id !== dashCtx.studioId) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Build updates
      const updates = buildUpdates(body);

      // If room_id changes, check availability
      if (
        updates.room_id !== undefined &&
        updates.room_id !== existing.room_id
      ) {
        const roomAvailResult = await checkRoomForUpdate(
          dashCtx.supabase,
          updates.room_id as string,
          dashCtx.studioId,
          existing.session_date,
          (updates.start_time as string) || existing.start_time,
          (updates.end_time as string) || existing.end_time,
          id
        );
        if (roomAvailResult) return roomAvailResult;
      }

      // If time changes but same room, re-check availability
      if (
        existing.room_id &&
        !updates.room_id &&
        (updates.start_time || updates.end_time)
      ) {
        const newStart =
          (updates.start_time as string) || existing.start_time;
        const newEnd = (updates.end_time as string) || existing.end_time;

        if (newEnd <= newStart) {
          return NextResponse.json(
            { error: "end_time must be after start_time" },
            { status: 400 }
          );
        }

        const roomAvailResult = await checkRoomForUpdate(
          dashCtx.supabase,
          existing.room_id,
          dashCtx.studioId,
          existing.session_date,
          newStart,
          newEnd,
          id
        );
        if (roomAvailResult) return roomAvailResult;
      }

      // Recalculate duration_minutes if times changed
      if (updates.start_time || updates.end_time) {
        const newStart =
          (updates.start_time as string) || existing.start_time;
        const newEnd = (updates.end_time as string) || existing.end_time;
        const [sh, sm] = newStart.split(":").map(Number);
        const [eh, em] = newEnd.split(":").map(Number);
        updates.duration_minutes = eh * 60 + em - (sh * 60 + sm);
      }

      const { data: updated, error } = await dashCtx.supabase
        .from("class_sessions")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(updated);
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session belongs to this instructor
    const { data: existing } = await instrCtx.supabase
      .from("class_sessions")
      .select(
        "id, studio_id, instructor_id, room_id, session_date, start_time, end_time"
      )
      .eq("id", id)
      .single();

    if (
      !existing ||
      existing.studio_id !== instrCtx.studioId ||
      existing.instructor_id !== instrCtx.instructorId
    ) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const updates = buildUpdates(body);

    // If room_id changes, check availability
    if (
      updates.room_id !== undefined &&
      updates.room_id !== existing.room_id
    ) {
      const roomAvailResult = await checkRoomForUpdate(
        instrCtx.supabase,
        updates.room_id as string,
        instrCtx.studioId,
        existing.session_date,
        (updates.start_time as string) || existing.start_time,
        (updates.end_time as string) || existing.end_time,
        id
      );
      if (roomAvailResult) return roomAvailResult;
    }

    // If time changes but same room, re-check availability
    if (
      existing.room_id &&
      !updates.room_id &&
      (updates.start_time || updates.end_time)
    ) {
      const newStart =
        (updates.start_time as string) || existing.start_time;
      const newEnd = (updates.end_time as string) || existing.end_time;

      if (newEnd <= newStart) {
        return NextResponse.json(
          { error: "end_time must be after start_time" },
          { status: 400 }
        );
      }

      const roomAvailResult = await checkRoomForUpdate(
        instrCtx.supabase,
        existing.room_id,
        instrCtx.studioId,
        existing.session_date,
        newStart,
        newEnd,
        id
      );
      if (roomAvailResult) return roomAvailResult;
    }

    // Recalculate duration_minutes if times changed
    if (updates.start_time || updates.end_time) {
      const newStart =
        (updates.start_time as string) || existing.start_time;
      const newEnd = (updates.end_time as string) || existing.end_time;
      const [sh, sm] = newStart.split(":").map(Number);
      const [eh, em] = newEnd.split(":").map(Number);
      updates.duration_minutes = eh * 60 + em - (sh * 60 + sm);
    }

    const { data: updated, error } = await instrCtx.supabase
      .from("class_sessions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 * Cancel a session (soft delete — sets is_cancelled = true).
 * Owner/Manager (can_manage_classes): can cancel any session in their studio.
 * Instructor: can only cancel own sessions.
 * Query params:
 *   ?cancel_future=true — cancel all future sessions in the same recurrence group.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const cancelFuture = url.searchParams.get("cancel_future") === "true";

    // --- Auth: try dashboard first, then instructor ---
    const dashCtx = await getDashboardContext();

    if (dashCtx) {
      if (
        dashCtx.role === "manager" &&
        !dashCtx.permissions?.can_manage_classes
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data: existing } = await dashCtx.supabase
        .from("class_sessions")
        .select("id, studio_id, is_cancelled, recurrence_group_id, session_date")
        .eq("id", id)
        .single();

      if (!existing || existing.studio_id !== dashCtx.studioId) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      if (existing.is_cancelled) {
        return NextResponse.json(
          { error: "Session is already cancelled" },
          { status: 400 }
        );
      }

      return await cancelSession(
        dashCtx.supabase,
        id,
        existing,
        cancelFuture
      );
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existing } = await instrCtx.supabase
      .from("class_sessions")
      .select(
        "id, studio_id, instructor_id, is_cancelled, recurrence_group_id, session_date"
      )
      .eq("id", id)
      .single();

    if (
      !existing ||
      existing.studio_id !== instrCtx.studioId ||
      existing.instructor_id !== instrCtx.instructorId
    ) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (existing.is_cancelled) {
      return NextResponse.json(
        { error: "Session is already cancelled" },
        { status: 400 }
      );
    }

    return await cancelSession(
      instrCtx.supabase,
      id,
      existing,
      cancelFuture
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// --- Helpers ---

function buildUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;
  if (body.room_id !== undefined) updates.room_id = body.room_id || null;
  if (body.template_id !== undefined)
    updates.template_id = body.template_id || null;
  if (body.is_cancelled !== undefined)
    updates.is_cancelled = body.is_cancelled;
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (body.title !== undefined) updates.title = body.title;
  if (body.is_public !== undefined) updates.is_public = body.is_public;
  if (body.price_cents !== undefined) updates.price_cents = body.price_cents;
  if (body.location !== undefined)
    updates.location = body.location || null;
  if (body.online_link !== undefined)
    updates.online_link = body.online_link || null;
  if (body.capacity !== undefined) updates.capacity = body.capacity;

  return updates;
}

async function checkRoomForUpdate(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  roomId: string,
  studioId: string,
  sessionDate: string,
  startTime: string,
  endTime: string,
  excludeSessionId: string
): Promise<NextResponse | null> {
  if (!roomId) return null;

  // Verify room belongs to studio
  const { data: room } = await supabase
    .from("rooms")
    .select("id, studio_id, is_active")
    .eq("id", roomId)
    .single();

  if (!room || room.studio_id !== studioId || !room.is_active) {
    return NextResponse.json(
      { error: "Room not found or inactive" },
      { status: 404 }
    );
  }

  // Check conflicts (excluding current session)
  const { data: conflicts } = await supabase
    .from("class_sessions")
    .select("id")
    .eq("room_id", roomId)
    .eq("session_date", sessionDate)
    .eq("is_cancelled", false)
    .neq("id", excludeSessionId)
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "Room is not available at the requested time" },
      { status: 409 }
    );
  }

  return null;
}

async function cancelSession(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  sessionId: string,
  existing: {
    recurrence_group_id: string | null;
    session_date: string;
  },
  cancelFuture: boolean
) {
  // Cancel future recurring sessions if requested
  if (cancelFuture && existing.recurrence_group_id) {
    const today = new Date().toISOString().split("T")[0];
    const { data: cancelled, error } = await supabase
      .from("class_sessions")
      .update({ is_cancelled: true })
      .eq("recurrence_group_id", existing.recurrence_group_id)
      .eq("is_cancelled", false)
      .gte("session_date", today)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 各キャンセルされたセッションの予約を自動キャンセル
    const cancelledIds = (cancelled || []).map((c: { id: string }) => c.id);
    let bookingsCancelledCount = 0;
    if (cancelledIds.length > 0) {
      bookingsCancelledCount = await autoCancelBookingsForSessions(supabase, cancelledIds);
    }

    return NextResponse.json({
      success: true,
      cancelled_count: cancelled?.length ?? 0,
      bookings_cancelled_count: bookingsCancelledCount,
    });
  }

  // Single session cancel
  const { data: cancelled, error } = await supabase
    .from("class_sessions")
    .update({ is_cancelled: true })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 紐づく予約を自動キャンセル（クレジット/パス返却含む）
  const bookingsCancelledCount = await autoCancelBookingsForSessions(supabase, [sessionId]);

  return NextResponse.json({
    success: true,
    session: cancelled,
    bookings_cancelled_count: bookingsCancelledCount,
  });
}

/**
 * セッションキャンセル時に紐づく confirmed/waitlist 予約を自動キャンセルし、
 * クレジット/パス利用を返却する。
 */
async function autoCancelBookingsForSessions(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  sessionIds: string[]
): Promise<number> {
  // confirmed + waitlist の予約を取得
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, member_id, session_id, booked_via_pass")
    .in("session_id", sessionIds)
    .in("status", ["confirmed", "waitlist"]);

  if (!bookings || bookings.length === 0) return 0;

  const bookingIds = bookings.map((b: { id: string }) => b.id);

  // 一括キャンセル
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .in("id", bookingIds);

  // confirmed 予約のクレジット/パス返却
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;

    if (b.booked_via_pass) {
      // パス利用のリバート
      const { data: usageRows } = await supabase
        .from("pass_class_usage")
        .select("id, pass_subscription_id, pass_subscriptions(id, member_id)")
        .eq("session_id", b.session_id);

      if (usageRows) {
        for (const usage of usageRows) {
          const sub = usage.pass_subscriptions as unknown as {
            id: string;
            member_id: string;
          } | null;
          if (!sub || sub.member_id !== b.member_id) continue;

          await supabase
            .from("pass_class_usage")
            .delete()
            .eq("id", usage.id);
          await supabase.rpc("decrement_pass_usage", {
            p_subscription_id: sub.id,
          });
          break;
        }
      }
    } else {
      // クレジット返却
      await supabase.rpc("increment_member_credits", {
        p_member_id: b.member_id,
      });
    }
  }

  return bookings.length;
}
