import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * Room booking PATCH/DELETE endpoint. Backward-compatible wrapper around
 * class_sessions (session_type = 'room_only').
 *
 * Access rules:
 *   - The instructor who created the booking: full access.
 *   - The studio owner: full access.
 *   - A manager with can_manage_rooms in the same studio: full access.
 */

type Actor = {
  supabase: SupabaseClient;
  userId: string;
  studioId: string;
  role: "owner" | "manager" | "instructor";
  /** The instructor_id row for the actor if they are an instructor themselves. */
  ownInstructorId: string | null;
  /** true if this actor is managing someone else's booking (owner/manager). */
  isStaffActor: boolean;
};

async function getActor(): Promise<Actor | null> {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) return null;
  if (!["owner", "manager", "instructor"].includes(profile.role)) return null;

  const { data: instructorRow } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    studioId: profile.studio_id,
    role: profile.role as "owner" | "manager" | "instructor",
    ownInstructorId: instructorRow?.id ?? null,
    isStaffActor: profile.role === "owner" || profile.role === "manager",
  };
}

/**
 * Returns true if the actor can manage the given booking.
 * For managers, also requires can_manage_rooms = true.
 */
async function canActOnBooking(
  actor: Actor,
  booking: { instructor_id: string; studio_id: string }
): Promise<boolean> {
  if (booking.studio_id !== actor.studioId) return false;
  if (actor.ownInstructorId && booking.instructor_id === actor.ownInstructorId) {
    return true;
  }
  if (actor.role === "owner") return true;
  if (actor.role === "manager") {
    const { data: mgr } = await actor.supabase
      .from("managers")
      .select("can_manage_rooms")
      .eq("profile_id", actor.userId)
      .eq("studio_id", actor.studioId)
      .maybeSingle();
    return mgr?.can_manage_rooms === true;
  }
  return false;
}

// PATCH: update an existing room booking
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabled = await isFeatureEnabled(
      actor.studioId,
      FEATURE_KEYS.ROOM_MANAGEMENT
    );
    if (!roomEnabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { data: existing } = await actor.supabase
      .from("class_sessions")
      .select("id, instructor_id, room_id, session_date, studio_id, session_type")
      .eq("id", id)
      .eq("is_cancelled", false)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await canActOnBooking(actor, existing))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.is_public !== undefined) updates.is_public = body.is_public;
    if (body.notes !== undefined) updates.location = body.notes || null;

    if (updates.start_time || updates.end_time) {
      const newStart = (updates.start_time || body.start_time) as string;
      const newEnd = (updates.end_time || body.end_time) as string;

      if (newEnd <= newStart) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }

      const [sh, sm] = newStart.split(":").map(Number);
      const [eh, em] = newEnd.split(":").map(Number);
      updates.duration_minutes = eh * 60 + em - (sh * 60 + sm);

      const { data: conflicts } = await actor.supabase
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

    const { data, error } = await actor.supabase
      .from("class_sessions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

// DELETE: cancel the booking (sets is_cancelled=true).
// ?cancel_future=true cancels all remaining sessions in the recurrence group.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabled = await isFeatureEnabled(
      actor.studioId,
      FEATURE_KEYS.ROOM_MANAGEMENT
    );
    if (!roomEnabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { data: existing } = await actor.supabase
      .from("class_sessions")
      .select(
        "id, instructor_id, recurrence_group_id, session_date, room_id, start_time, end_time, title, studio_id, session_type"
      )
      .eq("id", id)
      .eq("is_cancelled", false)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await canActOnBooking(actor, existing))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const cancelFuture = url.searchParams.get("cancel_future") === "true";
    const reasonRaw = url.searchParams.get("reason");
    const reason = reasonRaw ? reasonRaw.slice(0, 500) : null;

    let cancelledCount = 0;

    if (cancelFuture && existing.recurrence_group_id) {
      const today = new Date().toISOString().split("T")[0];
      const { data: cancelled, error } = await actor.supabase
        .from("class_sessions")
        .update({ is_cancelled: true })
        .eq("recurrence_group_id", existing.recurrence_group_id)
        .eq("instructor_id", existing.instructor_id)
        .eq("is_cancelled", false)
        .gte("session_date", today)
        .select("id");
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      cancelledCount = cancelled?.length ?? 0;
    } else {
      const { error } = await actor.supabase
        .from("class_sessions")
        .update({ is_cancelled: true })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      cancelledCount = 1;
    }

    // If the action was taken by staff on the instructor's behalf, notify
    // the instructor. Respect the booking_cancellation preference.
    const actedByStaff =
      actor.isStaffActor && existing.instructor_id !== actor.ownInstructorId;
    if (actedByStaff) {
      notifyInstructorOfStaffCancel(
        actor.supabase,
        actor.studioId,
        existing.instructor_id,
        {
          title: existing.title as string,
          bookingDate: existing.session_date as string,
          startTime: existing.start_time as string,
          endTime: existing.end_time as string,
          roomId: existing.room_id as string,
          reason,
        }
      ).catch((err) =>
        console.warn("[RoomBookings] Instructor cancel notification failed:", err)
      );
    }

    return NextResponse.json({ success: true, cancelled_count: cancelledCount });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function notifyInstructorOfStaffCancel(
  supabase: SupabaseClient,
  studioId: string,
  instructorId: string,
  booking: {
    title: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    roomId: string;
    reason: string | null;
  }
) {
  try {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("profile_id, profiles(email, full_name)")
      .eq("id", instructorId)
      .single();
    if (!instructor?.profile_id) return;
    const rawProfile = instructor.profiles as unknown;
    const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as
      | { email: string; full_name: string }
      | null;
    if (!profile?.email) return;

    const { shouldSendEmail } = await import("@/lib/email/check-preference");
    const allowed = await shouldSendEmail(
      instructor.profile_id,
      studioId,
      "booking_cancellation"
    );
    if (!allowed) return;

    const { data: room } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", booking.roomId)
      .single();
    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();

    const { instructorRoomBookingCancelledByOwner } = await import(
      "@/lib/email/templates"
    );
    const { sendEmail } = await import("@/lib/email/send");

    const template = instructorRoomBookingCancelledByOwner({
      instructorName: profile.full_name || "there",
      roomName: room?.name || "the room",
      title: booking.title,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      studioName: studio?.name || "your studio",
      reason: booking.reason,
    });

    await sendEmail({
      to: profile.email,
      subject: template.subject,
      html: template.html,
      studioId,
      templateName: "instructorRoomBookingCancelledByOwner",
    });
  } catch (err) {
    console.error("[RoomBookings] Failed to notify instructor of cancel:", err);
  }
}
