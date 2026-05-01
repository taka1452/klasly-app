import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrapRelation } from "@/lib/supabase/relation";
import { sendEmail } from "@/lib/email/send";
import {
  sessionInstructorChanged,
  sessionRescheduled,
  sessionCancelledNotice,
} from "@/lib/email/templates";
import { logClassAudit } from "@/lib/audit/class-audit";

type Scope = "single" | "future" | "all";

/**
 * PUT /api/sessions/[id]
 * Update a session.
 *
 * Body may include `scope`:
 *   - "single" (default) — only this session.
 *   - "future" — this session and all later sessions in the same recurrence series.
 *   - "all"    — every session in the same recurrence series (past and future).
 *
 * For series scopes, only "series-safe" fields are propagated (title, room_id,
 * times, duration). The session_date is always single-session only — even with
 * scope=future/all — because shifting every session's calendar date doesn't
 * have an obvious meaning. Times do propagate.
 *
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
    const scope = parseScope(body?.scope);

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
        .select(
          "id, studio_id, instructor_id, room_id, session_date, start_time, end_time, recurrence_group_id, template_id"
        )
        .eq("id", id)
        .single();

      if (!existing || existing.studio_id !== dashCtx.studioId) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return await handleUpdate({
        supabase: dashCtx.supabase,
        studioId: dashCtx.studioId,
        sessionId: id,
        existing,
        body,
        scope,
        actor: { profileId: dashCtx.userId, role: dashCtx.role },
      });
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
        "id, studio_id, instructor_id, room_id, session_date, start_time, end_time, recurrence_group_id, template_id"
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

    return await handleUpdate({
      supabase: instrCtx.supabase,
      studioId: instrCtx.studioId,
      sessionId: id,
      existing,
      body,
      scope,
      actor: { profileId: instrCtx.userId, role: "instructor" },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function parseScope(raw: unknown): Scope {
  return raw === "future" || raw === "all" ? raw : "single";
}

type ExistingSession = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  room_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  recurrence_group_id: string | null;
  template_id?: string | null;
};

type Actor = { profileId: string; role: "owner" | "manager" | "instructor" };

async function handleUpdate(args: {
  supabase: SupabaseClient;
  studioId: string;
  sessionId: string;
  existing: ExistingSession;
  body: Record<string, unknown>;
  scope: Scope;
  actor: Actor;
}): Promise<NextResponse> {
  const { supabase, studioId, sessionId, existing, body, scope, actor } = args;

  const allUpdates = buildUpdates(body);

  // session_date is intentionally single-session only. Apply it to the
  // target session, but never propagate it across the series.
  const seriesUpdates: Record<string, unknown> = { ...allUpdates };
  delete seriesUpdates.session_date;

  const newDate = (allUpdates.session_date as string) || existing.session_date;
  const newStart = (allUpdates.start_time as string) || existing.start_time;
  const newEnd = (allUpdates.end_time as string) || existing.end_time;

  if (newEnd <= newStart) {
    return NextResponse.json(
      { error: "end_time must be after start_time" },
      { status: 400 }
    );
  }

  // Recalculate duration_minutes once if times changed — applies to both
  // single and series updates.
  if (allUpdates.start_time || allUpdates.end_time) {
    const [sh, sm] = newStart.split(":").map(Number);
    const [eh, em] = newEnd.split(":").map(Number);
    const duration = eh * 60 + em - (sh * 60 + sm);
    allUpdates.duration_minutes = duration;
    seriesUpdates.duration_minutes = duration;
  }

  // Single-session room conflict check (date + new times).
  // For series scopes we skip per-occurrence conflict checks — the studio
  // can resolve any future-room conflicts after the bulk apply, and the
  // alternative would silently skip rows.
  if (scope === "single") {
    if (
      allUpdates.room_id !== undefined &&
      allUpdates.room_id !== existing.room_id
    ) {
      const conflict = await checkRoomForUpdate(
        supabase,
        allUpdates.room_id as string,
        studioId,
        newDate,
        newStart,
        newEnd,
        sessionId
      );
      if (conflict) return conflict;
    }
    if (
      existing.room_id &&
      !allUpdates.room_id &&
      (allUpdates.session_date || allUpdates.start_time || allUpdates.end_time)
    ) {
      const conflict = await checkRoomForUpdate(
        supabase,
        existing.room_id,
        studioId,
        newDate,
        newStart,
        newEnd,
        sessionId
      );
      if (conflict) return conflict;
    }

    const { data: updated, error } = await supabase
      .from("class_sessions")
      .update(allUpdates)
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await maybeNotifyInstructorChange(supabase, studioId, [sessionId], {
      body,
      previousInstructorId: existing.instructor_id,
    });
    // Date/time change notifications. The instructor-change email already
    // mentions the slot, so we only fire the reschedule notice when the
    // request didn't change the instructor (otherwise members get two
    // overlapping emails for one edit).
    if (
      !Object.prototype.hasOwnProperty.call(body, "instructor_id") ||
      (body.instructor_id ?? null) === (existing.instructor_id ?? null)
    ) {
      await maybeNotifyTimeChange(supabase, studioId, [sessionId], {
        body,
        previous: {
          session_date: existing.session_date,
          start_time: existing.start_time,
        },
        next: {
          session_date: newDate,
          start_time: newStart,
          end_time: newEnd,
        },
      });
    }

    await logSessionEditAudits(supabase, {
      studioId,
      sessionId,
      templateId: existing.template_id ?? null,
      actor,
      previous: existing,
      next: { session_date: newDate, start_time: newStart, end_time: newEnd },
      body,
    });

    return NextResponse.json({ session: updated, updated_count: 1, scope });
  }

  // --- Series scopes ---
  if (!existing.recurrence_group_id) {
    return NextResponse.json(
      { error: "This session is not part of a recurring series" },
      { status: 400 }
    );
  }

  // 1) Update the originating session in full (includes session_date).
  const { error: anchorError } = await supabase
    .from("class_sessions")
    .update(allUpdates)
    .eq("id", sessionId);

  if (anchorError) {
    return NextResponse.json(
      { error: anchorError.message },
      { status: 500 }
    );
  }

  // 2) Update the rest of the series with series-safe fields only.
  // When the user picked a series scope but the only change is the
  // session_date (stripped from seriesUpdates because dates don't fan
  // out), seriesUpdates is empty and we skip the bulk update. Audit and
  // notifications still need to fire for the anchor session in that
  // case, so we move them out of this guard.
  let bulkUpdated = 1;
  let bulkIds: string[] = [];
  if (Object.keys(seriesUpdates).length > 0) {
    let query = supabase
      .from("class_sessions")
      .update(seriesUpdates)
      .eq("recurrence_group_id", existing.recurrence_group_id)
      .eq("studio_id", studioId)
      .neq("id", sessionId);

    if (scope === "future") {
      query = query.gte("session_date", existing.session_date);
    }

    const { data: bulk, error: bulkError } = await query.select("id");
    if (bulkError) {
      return NextResponse.json(
        { error: bulkError.message },
        { status: 500 }
      );
    }
    bulkIds = (bulk ?? []).map((b) => b.id) as string[];
    bulkUpdated = 1 + bulkIds.length;
  }

  const notifyIds = [sessionId, ...bulkIds];
  await maybeNotifyInstructorChange(supabase, studioId, notifyIds, {
    body,
    previousInstructorId: existing.instructor_id,
  });
  if (
    !Object.prototype.hasOwnProperty.call(body, "instructor_id") ||
    (body.instructor_id ?? null) === (existing.instructor_id ?? null)
  ) {
    await maybeNotifyTimeChange(supabase, studioId, notifyIds, {
      body,
      previous: {
        session_date: existing.session_date,
        start_time: existing.start_time,
      },
      next: {
        session_date: newDate,
        start_time: newStart,
        end_time: newEnd,
      },
    });
  }
  // Log the anchor session's diff plus a roll-up note of the fan-out count.
  // Per-fan-out session entries would 10× the audit log without adding
  // much insight, so we keep them as a single summary row.
  await logSessionEditAudits(supabase, {
    studioId,
    sessionId,
    templateId: existing.template_id ?? null,
    actor,
    previous: existing,
    next: { session_date: newDate, start_time: newStart, end_time: newEnd },
    body,
    seriesScope: scope,
    seriesUpdatedCount: bulkUpdated,
  });

  return NextResponse.json({
    updated_count: bulkUpdated,
    scope,
  });
}

/**
 * GET /api/sessions/[id]?action=scope-impact
 *
 * Returns the number of sessions and active bookings that would be affected
 * by scope=future and scope=all on this session's recurrence series.
 * Used by the edit modal to show a "this affects N sessions / M bookings"
 * preview before the user commits.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    if (url.searchParams.get("action") !== "scope-impact") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const dashCtx = await getDashboardContext();
    let supabase: SupabaseClient;
    let studioId: string;
    let instructorId: string | null = null;

    if (dashCtx) {
      if (
        dashCtx.role === "manager" &&
        !dashCtx.permissions?.can_manage_classes
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      supabase = dashCtx.supabase;
      studioId = dashCtx.studioId;
    } else {
      const instrCtx = await getInstructorContext();
      if (!instrCtx) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      supabase = instrCtx.supabase;
      studioId = instrCtx.studioId;
      instructorId = instrCtx.instructorId;
    }

    const { data: existing } = await supabase
      .from("class_sessions")
      .select(
        "id, studio_id, instructor_id, recurrence_group_id, session_date"
      )
      .eq("id", id)
      .single();

    if (
      !existing ||
      existing.studio_id !== studioId ||
      (instructorId && existing.instructor_id !== instructorId)
    ) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const groupId = existing.recurrence_group_id;
    if (!groupId) {
      return NextResponse.json({
        recurring: false,
        future: { sessions: 1, bookings: 0 },
        all: { sessions: 1, bookings: 0 },
      });
    }

    const { data: futureSessions } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("recurrence_group_id", groupId)
      .eq("studio_id", studioId)
      .eq("is_cancelled", false)
      .gte("session_date", existing.session_date);

    const { data: allSessions } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("recurrence_group_id", groupId)
      .eq("studio_id", studioId)
      .eq("is_cancelled", false);

    const futureIds = (futureSessions ?? []).map((s) => s.id);
    const allIds = (allSessions ?? []).map((s) => s.id);

    const futureBookings = futureIds.length
      ? await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("session_id", futureIds)
          .in("status", ["confirmed", "waitlist"])
      : { count: 0 };

    const allBookings = allIds.length
      ? await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("session_id", allIds)
          .in("status", ["confirmed", "waitlist"])
      : { count: 0 };

    return NextResponse.json({
      recurring: true,
      future: {
        sessions: futureIds.length,
        bookings: futureBookings.count ?? 0,
      },
      all: {
        sessions: allIds.length,
        bookings: allBookings.count ?? 0,
      },
    });
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
    // Notification opt-out: ?notify=false suppresses the cancelled-session
    // email blast (used when the cancellation is a silent fix or the studio
    // has already messaged members another way). Default is to notify.
    const notifyParam = url.searchParams.get("notify");
    let notifyMembers = notifyParam !== "false";

    // Optional cancellation reason — accept either query string or JSON body.
    // Body takes precedence when both are provided.
    let cancellationReason: string | null = null;
    const reasonParam = url.searchParams.get("reason");
    if (reasonParam && reasonParam.trim()) {
      cancellationReason = reasonParam.trim().slice(0, 500);
    }
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text) as { reason?: unknown; notify_members?: unknown };
        if (typeof body.reason === "string" && body.reason.trim()) {
          cancellationReason = body.reason.trim().slice(0, 500);
        }
        if (body.notify_members === false) {
          notifyMembers = false;
        }
      }
    } catch {
      // body wasn't JSON — ignore
    }

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
        dashCtx.studioId,
        id,
        existing,
        cancelFuture,
        cancellationReason,
        notifyMembers,
        dashCtx.role, // 'owner' | 'manager' — defaults hours_returned=true
        { profileId: dashCtx.userId, role: dashCtx.role }
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
      instrCtx.studioId,
      id,
      existing,
      cancelFuture,
      cancellationReason,
      notifyMembers,
      "instructor", // self-cancel — defaults hours_returned=false
      { profileId: instrCtx.userId, role: "instructor" }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// --- Helpers ---

/**
 * Send the "instructor changed" email to every confirmed booker on the
 * sessions in `sessionIds`, but only when the request actually changed the
 * instructor. Failures are swallowed — email outages must not break the
 * underlying schedule edit.
 */
async function maybeNotifyInstructorChange(
  supabase: SupabaseClient,
  studioId: string,
  sessionIds: string[],
  args: {
    body: Record<string, unknown>;
    previousInstructorId: string | null;
  }
): Promise<void> {
  // Did the caller actually pass an instructor_id?
  if (!Object.prototype.hasOwnProperty.call(args.body, "instructor_id")) {
    return;
  }
  // Caller can suppress notifications explicitly (default: notify).
  if (args.body.notify_members === false) return;

  const newInstructorId =
    typeof args.body.instructor_id === "string" && args.body.instructor_id
      ? args.body.instructor_id
      : null;

  if (newInstructorId === (args.previousInstructorId ?? null)) {
    return;
  }
  if (sessionIds.length === 0) return;

  try {
    // Fetch all confirmed bookings on the affected sessions.
    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, session_id, member_id, profiles!inner(full_name, email), class_sessions!inner(session_date, start_time, class_templates(name), studios(name)), instructors(profiles(full_name))"
      )
      .in("session_id", sessionIds)
      .eq("status", "confirmed");

    if (!bookings || bookings.length === 0) return;

    // Resolve instructor display names just once.
    let newInstructorName = "your studio";
    if (newInstructorId) {
      const { data: instr } = await supabase
        .from("instructors")
        .select("profiles(full_name)")
        .eq("id", newInstructorId)
        .single();
      const p = instr?.profiles
        ? unwrapRelation<{ full_name?: string }>(instr.profiles)
        : null;
      if (p?.full_name) newInstructorName = p.full_name;
    }

    let previousInstructorName: string | null = null;
    if (args.previousInstructorId) {
      const { data: prev } = await supabase
        .from("instructors")
        .select("profiles(full_name)")
        .eq("id", args.previousInstructorId)
        .single();
      const p = prev?.profiles
        ? unwrapRelation<{ full_name?: string }>(prev.profiles)
        : null;
      previousInstructorName = p?.full_name ?? null;
    }

    type BookingRow = {
      id: string;
      session_id: string;
      member_id: string;
      profiles: { full_name: string; email: string } | { full_name: string; email: string }[];
      class_sessions:
        | {
            session_date: string;
            start_time: string;
            class_templates: { name: string } | { name: string }[] | null;
            studios: { name: string } | { name: string }[] | null;
          }
        | {
            session_date: string;
            start_time: string;
            class_templates: { name: string } | { name: string }[] | null;
            studios: { name: string } | { name: string }[] | null;
          }[];
    };

    await Promise.all(
      (bookings as unknown as BookingRow[]).map(async (b) => {
        const member = unwrapRelation<{ full_name?: string; email?: string }>(
          b.profiles
        );
        const session = unwrapRelation<{
          session_date: string;
          start_time: string;
          class_templates: { name?: string } | { name?: string }[] | null;
          studios: { name?: string } | { name?: string }[] | null;
        }>(b.class_sessions);
        if (!member?.email || !session) return;

        const tmpl = session.class_templates
          ? unwrapRelation<{ name?: string }>(session.class_templates)
          : null;
        const studio = session.studios
          ? unwrapRelation<{ name?: string }>(session.studios)
          : null;

        const tpl = sessionInstructorChanged({
          memberName: member.full_name || "there",
          className: tmpl?.name || "your class",
          sessionDate: session.session_date,
          startTime: session.start_time.slice(0, 5),
          studioName: studio?.name || "Klasly",
          newInstructorName,
          previousInstructorName,
        });
        await sendEmail({
          to: member.email,
          subject: tpl.subject,
          html: tpl.html,
          studioId,
          templateName: "session_instructor_changed",
        });
      })
    );
  } catch (err) {
    console.error("[notify] instructor change email batch failed", err);
  }
}

/**
 * Email confirmed bookers when a session's date or start time has been
 * changed. We only fire when there's an *observable* change in either —
 * end-time-only edits aren't worth a notification because the start time
 * is what most members put in their calendar.
 *
 * Caller may pass `notify_members: false` in the body to suppress this
 * (used when the change is a silent data fix, e.g. correcting a typo).
 *
 * Jamie feedback 2026-04-30 (Editing error thread): "when we make those
 * changes, can we have an option to notify any bookings of the change?"
 */
async function maybeNotifyTimeChange(
  supabase: SupabaseClient,
  studioId: string,
  sessionIds: string[],
  args: {
    body: Record<string, unknown>;
    previous: { session_date: string; start_time: string };
    next: {
      session_date: string;
      start_time: string;
      end_time: string;
    };
  }
): Promise<void> {
  if (args.body.notify_members === false) return;
  const dateChanged = args.previous.session_date !== args.next.session_date;
  const timeChanged =
    args.previous.start_time.slice(0, 5) !== args.next.start_time.slice(0, 5);
  if (!dateChanged && !timeChanged) return;
  if (sessionIds.length === 0) return;

  try {
    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, profiles!inner(full_name, email), class_sessions!inner(session_date, start_time, end_time, class_templates(name), studios(name))"
      )
      .in("session_id", sessionIds)
      .eq("status", "confirmed");

    if (!bookings || bookings.length === 0) return;

    type BookingRow = {
      profiles: { full_name: string; email: string } | { full_name: string; email: string }[];
      class_sessions:
        | {
            session_date: string;
            start_time: string;
            end_time: string | null;
            class_templates: { name: string } | { name: string }[] | null;
            studios: { name: string } | { name: string }[] | null;
          }
        | {
            session_date: string;
            start_time: string;
            end_time: string | null;
            class_templates: { name: string } | { name: string }[] | null;
            studios: { name: string } | { name: string }[] | null;
          }[];
    };

    await Promise.all(
      (bookings as unknown as BookingRow[]).map(async (b) => {
        const member = unwrapRelation<{ full_name?: string; email?: string }>(
          b.profiles
        );
        const session = unwrapRelation<{
          session_date: string;
          start_time: string;
          end_time: string | null;
          class_templates: { name?: string } | { name?: string }[] | null;
          studios: { name?: string } | { name?: string }[] | null;
        }>(b.class_sessions);
        if (!member?.email || !session) return;
        const tmpl = session.class_templates
          ? unwrapRelation<{ name?: string }>(session.class_templates)
          : null;
        const studio = session.studios
          ? unwrapRelation<{ name?: string }>(session.studios)
          : null;

        const tpl = sessionRescheduled({
          memberName: member.full_name || "there",
          className: tmpl?.name || "your class",
          oldDate: args.previous.session_date,
          oldStartTime: args.previous.start_time.slice(0, 5),
          newDate: session.session_date,
          newStartTime: session.start_time.slice(0, 5),
          newEndTime: session.end_time ? session.end_time.slice(0, 5) : null,
          studioName: studio?.name || "Klasly",
        });
        await sendEmail({
          to: member.email,
          subject: tpl.subject,
          html: tpl.html,
          studioId,
          templateName: "session_rescheduled",
        });
      })
    );
  } catch (err) {
    console.error("[notify] reschedule email batch failed", err);
  }
}

/**
 * Email confirmed bookers that a session has been cancelled by the studio
 * (distinct from a member cancelling their own booking). The cancel route
 * accepts `?notify=false` to suppress, which is wired through to here.
 */
async function maybeNotifyCancellation(
  supabase: SupabaseClient,
  studioId: string,
  sessionIds: string[],
  args: { reason: string | null; notify: boolean }
): Promise<void> {
  if (!args.notify || sessionIds.length === 0) return;

  try {
    // Bookings list — pulls members who were confirmed *before* the
    // auto-cancel ran. The booking rows may now be status=cancelled, so
    // we don't filter on status here; we rely on the session_id match.
    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, profiles!inner(full_name, email), class_sessions!inner(session_date, start_time, class_templates(name), studios(name))"
      )
      .in("session_id", sessionIds);

    if (!bookings || bookings.length === 0) return;

    type Row = {
      profiles: { full_name: string; email: string } | { full_name: string; email: string }[];
      class_sessions:
        | {
            session_date: string;
            start_time: string;
            class_templates: { name: string } | { name: string }[] | null;
            studios: { name: string } | { name: string }[] | null;
          }
        | {
            session_date: string;
            start_time: string;
            class_templates: { name: string } | { name: string }[] | null;
            studios: { name: string } | { name: string }[] | null;
          }[];
    };

    await Promise.all(
      (bookings as unknown as Row[]).map(async (b) => {
        const member = unwrapRelation<{ full_name?: string; email?: string }>(
          b.profiles
        );
        const session = unwrapRelation<{
          session_date: string;
          start_time: string;
          class_templates: { name?: string } | { name?: string }[] | null;
          studios: { name?: string } | { name?: string }[] | null;
        }>(b.class_sessions);
        if (!member?.email || !session) return;
        const tmpl = session.class_templates
          ? unwrapRelation<{ name?: string }>(session.class_templates)
          : null;
        const studio = session.studios
          ? unwrapRelation<{ name?: string }>(session.studios)
          : null;

        const tpl = sessionCancelledNotice({
          memberName: member.full_name || "there",
          className: tmpl?.name || "your class",
          sessionDate: session.session_date,
          startTime: session.start_time.slice(0, 5),
          studioName: studio?.name || "Klasly",
          reason: args.reason,
        });
        await sendEmail({
          to: member.email,
          subject: tpl.subject,
          html: tpl.html,
          studioId,
          templateName: "session_cancelled_notice",
        });
      })
    );
  } catch (err) {
    console.error("[notify] cancellation email batch failed", err);
  }
}

/**
 * Write one or more rows to class_audit_log for the change just applied
 * to a session. We split by change_type so the timeline UI can
 * filter/colour individual updates (instructor swap vs reschedule vs
 * room move) instead of having to parse a single blob.
 */
async function logSessionEditAudits(
  supabase: SupabaseClient,
  args: {
    studioId: string;
    sessionId: string;
    templateId: string | null;
    actor: Actor;
    previous: ExistingSession;
    next: { session_date: string; start_time: string; end_time: string };
    body: Record<string, unknown>;
    seriesScope?: Scope;
    seriesUpdatedCount?: number;
  }
): Promise<void> {
  const base = {
    studioId: args.studioId,
    templateId: args.templateId,
    sessionId: args.sessionId,
    actorProfileId: args.actor.profileId,
    actorRole: args.actor.role,
  };
  const seriesSuffix =
    args.seriesScope && args.seriesScope !== "single"
      ? ` (across ${args.seriesUpdatedCount ?? 1} sessions in series)`
      : "";

  // Instructor change
  if (
    Object.prototype.hasOwnProperty.call(args.body, "instructor_id") &&
    (args.body.instructor_id ?? null) !== (args.previous.instructor_id ?? null)
  ) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "session_instructor_changed",
      before: { instructor_id: args.previous.instructor_id },
      after: { instructor_id: args.body.instructor_id ?? null },
      summary: `Instructor changed${seriesSuffix}`,
    });
  }

  // Date change
  if (args.previous.session_date !== args.next.session_date) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "session_date_changed",
      before: { session_date: args.previous.session_date },
      after: { session_date: args.next.session_date },
      summary: `Date moved ${args.previous.session_date} → ${args.next.session_date}`,
    });
  }

  // Time change (start). End-time-only edits aren't worth a row — they
  // don't affect contracted hours unless start moves too.
  const prevStart = args.previous.start_time.slice(0, 5);
  const nextStart = args.next.start_time.slice(0, 5);
  const prevEnd = args.previous.end_time.slice(0, 5);
  const nextEnd = args.next.end_time.slice(0, 5);
  if (prevStart !== nextStart || prevEnd !== nextEnd) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "session_time_changed",
      before: { start_time: prevStart, end_time: prevEnd },
      after: { start_time: nextStart, end_time: nextEnd },
      summary: `Time changed ${prevStart}–${prevEnd} → ${nextStart}–${nextEnd}${seriesSuffix}`,
    });
  }

  // Room change
  if (
    Object.prototype.hasOwnProperty.call(args.body, "room_id") &&
    (args.body.room_id ?? null) !== (args.previous.room_id ?? null)
  ) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "session_room_changed",
      before: { room_id: args.previous.room_id },
      after: { room_id: args.body.room_id ?? null },
      summary: `Room changed${seriesSuffix}`,
    });
  }
}

function buildUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (body.session_date !== undefined) updates.session_date = body.session_date;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;
  if (body.room_id !== undefined) updates.room_id = body.room_id || null;
  if (body.instructor_id !== undefined)
    updates.instructor_id = body.instructor_id || null;
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
  studioId: string,
  sessionId: string,
  existing: {
    recurrence_group_id: string | null;
    session_date: string;
  },
  cancelFuture: boolean,
  cancellationReason: string | null,
  notifyMembers: boolean,
  cancelledByRole: "owner" | "manager" | "instructor",
  actor: Actor
) {
  // Pull the template_id once so we can index audit rows under the
  // template even after the session is soft-deleted via is_cancelled.
  const { data: parent } = await supabase
    .from("class_sessions")
    .select("template_id")
    .eq("id", sessionId)
    .single();
  const templateId = (parent as { template_id?: string | null } | null)
    ?.template_id ?? null;
  // Build the update payload. Only include cancellation_reason when one
  // was provided so we don't blow away an existing reason on subsequent
  // cancel calls.
  const updatePayload: Record<string, unknown> = {
    is_cancelled: true,
    cancelled_by_role: cancelledByRole,
    // Cancellation policy (Jamie 2026-04-30): admin cancellations refund
    // the instructor's monthly minutes by default; instructor self-cancels
    // forfeit them until an admin flips the toggle on the cancelled tile.
    hours_returned: cancelledByRole !== "instructor",
  };
  if (cancellationReason) {
    updatePayload.cancellation_reason = cancellationReason;
  }

  // Cancel future recurring sessions if requested
  if (cancelFuture && existing.recurrence_group_id) {
    const today = new Date().toISOString().split("T")[0];
    const { data: cancelled, error } = await supabase
      .from("class_sessions")
      .update(updatePayload)
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
      await maybeNotifyCancellation(supabase, studioId, cancelledIds, {
        reason: cancellationReason,
        notify: notifyMembers,
      });
      await logClassAudit(supabase, {
        studioId,
        templateId,
        sessionId,
        actorProfileId: actor.profileId,
        actorRole: actor.role,
        changeType: "session_cancelled",
        before: { is_cancelled: false },
        after: {
          is_cancelled: true,
          cancellation_reason: cancellationReason,
          cancelled_by_role: cancelledByRole,
          cascaded_session_count: cancelledIds.length,
        },
        summary: `Cancelled ${cancelledIds.length} future session${cancelledIds.length === 1 ? "" : "s"}${cancellationReason ? `: ${cancellationReason}` : ""}`,
      });
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
    .update(updatePayload)
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 紐づく予約を自動キャンセル（クレジット/パス返却含む）
  const bookingsCancelledCount = await autoCancelBookingsForSessions(supabase, [sessionId]);
  await maybeNotifyCancellation(supabase, studioId, [sessionId], {
    reason: cancellationReason,
    notify: notifyMembers,
  });
  await logClassAudit(supabase, {
    studioId,
    templateId,
    sessionId,
    actorProfileId: actor.profileId,
    actorRole: actor.role,
    changeType: "session_cancelled",
    before: { is_cancelled: false },
    after: {
      is_cancelled: true,
      cancellation_reason: cancellationReason,
      cancelled_by_role: cancelledByRole,
    },
    summary:
      cancelledByRole === "instructor"
        ? `Cancelled by teacher${cancellationReason ? `: ${cancellationReason}` : ""}`
        : `Cancelled${cancellationReason ? `: ${cancellationReason}` : ""}`,
  });

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
          const sub = unwrapRelation<{
            id: string;
            member_id: string;
          }>(usage.pass_subscriptions);
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
