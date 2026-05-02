import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * Admin endpoint: create a room booking on behalf of an instructor.
 *
 * Jamie feedback (2026-04): owners/managers need to book rooms for instructors
 * (the instructor-side calendar only lets them book for themselves).
 *
 * Auth: caller must be owner OR manager with can_manage_rooms = true.
 * Writes a `room_only` session into class_sessions (same table the instructor
 * path uses), bypassing quota/overage enforcement because the admin is doing it.
 */
async function getAdminContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return null;

  if (profile.role === "owner") {
    return { supabase, studioId: profile.studio_id, userId: user.id, role: "owner" as const };
  }

  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select("can_manage_rooms")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();
    if (!manager?.can_manage_rooms) return null;
    return { supabase, studioId: profile.studio_id, userId: user.id, role: "manager" as const };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabled = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.ROOM_MANAGEMENT);
    if (!roomEnabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const {
      room_id,
      instructor_id,
      title,
      booking_date,
      start_time,
      end_time,
      is_public,
      notes,
      member_id,
      use_pass,
    } = body as {
      room_id?: string;
      instructor_id?: string;
      title?: string;
      booking_date?: string;
      start_time?: string;
      end_time?: string;
      is_public?: boolean;
      notes?: string;
      member_id?: string | null;
      use_pass?: boolean;
    };

    if (!room_id || !instructor_id || !title || !booking_date || !start_time || !end_time) {
      return NextResponse.json(
        {
          error:
            "room_id, instructor_id, title, booking_date, start_time, end_time are required",
        },
        { status: 400 }
      );
    }

    if (end_time <= start_time) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // Validate room belongs to this studio.
    const { data: room } = await ctx.supabase
      .from("rooms")
      .select("id, studio_id, is_active")
      .eq("id", room_id)
      .single();
    if (!room || room.studio_id !== ctx.studioId || !room.is_active) {
      return NextResponse.json({ error: "Room not found or inactive" }, { status: 404 });
    }

    // Validate instructor belongs to this studio.
    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("id, studio_id")
      .eq("id", instructor_id)
      .single();
    if (!instructor || instructor.studio_id !== ctx.studioId) {
      return NextResponse.json(
        { error: "Instructor not found in this studio" },
        { status: 404 }
      );
    }

    // Check for conflicting sessions in the same room/time.
    const { data: conflicts } = await ctx.supabase
      .from("class_sessions")
      .select("id, title, session_date, start_time, end_time")
      .eq("room_id", room_id)
      .eq("session_date", booking_date)
      .eq("is_cancelled", false)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "This room is already booked during that time",
          conflicts: conflicts.map((c) => ({
            id: c.id,
            title: c.title,
            booking_date: c.session_date,
            start_time: c.start_time,
            end_time: c.end_time,
          })),
        },
        { status: 409 }
      );
    }

    const [sh, sm] = start_time.split(":").map(Number);
    const [eh, em] = end_time.split(":").map(Number);
    const durationMinutes = eh * 60 + em - (sh * 60 + sm);

    // Validate member if provided, and resolve an active pass if use_pass is requested.
    let validMemberId: string | null = null;
    let passSubscriptionId: string | null = null;
    let passSubscriptionForUsage: {
      id: string;
      classes_used: number;
    } | null = null;

    if (member_id) {
      const { data: memberRow } = await ctx.supabase
        .from("members")
        .select("id, studio_id")
        .eq("id", member_id)
        .single();
      if (!memberRow || memberRow.studio_id !== ctx.studioId) {
        return NextResponse.json(
          { error: "Member not found in this studio" },
          { status: 404 }
        );
      }
      validMemberId = memberRow.id;

      if (use_pass) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: passSubs } = await ctx.supabase
          .from("pass_subscriptions")
          .select(
            "id, classes_used_this_period, studio_passes(max_classes_per_month)"
          )
          .eq("member_id", validMemberId)
          .eq("status", "active")
          .gte("current_period_end", today);

        let chosen: { id: string; classes_used: number } | null = null;
        for (const sub of passSubs ?? []) {
          const sp = sub.studio_passes as
            | { max_classes_per_month: number | null }
            | { max_classes_per_month: number | null }[]
            | null;
          const max = Array.isArray(sp)
            ? sp[0]?.max_classes_per_month ?? null
            : sp?.max_classes_per_month ?? null;
          const used = sub.classes_used_this_period ?? 0;
          if (max === null || used < max) {
            chosen = { id: sub.id, classes_used: used };
            break;
          }
        }
        if (!chosen) {
          return NextResponse.json(
            {
              error:
                "No active pass with remaining sessions for this member.",
            },
            { status: 400 }
          );
        }
        passSubscriptionId = chosen.id;
        passSubscriptionForUsage = chosen;
      }
    }

    const { data: inserted, error: insertError } = await ctx.supabase
      .from("class_sessions")
      .insert({
        studio_id: ctx.studioId,
        instructor_id,
        room_id,
        template_id: null,
        session_type: "room_only",
        title,
        session_date: booking_date,
        start_time,
        end_time,
        duration_minutes: durationMinutes,
        is_public: is_public ?? false,
        is_cancelled: false,
        location: notes || null,
        client_member_id: validMemberId,
        client_pass_subscription_id: passSubscriptionId,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Record pass usage after the booking row exists so we can revert on cancel.
    if (passSubscriptionForUsage && validMemberId) {
      const { error: usageErr } = await ctx.supabase
        .from("pass_class_usage")
        .insert({
          pass_subscription_id: passSubscriptionForUsage.id,
          session_id: inserted.id,
          instructor_id,
        });
      if (usageErr) {
        // Roll back the session row so the booking and pass stay consistent.
        await ctx.supabase
          .from("class_sessions")
          .delete()
          .eq("id", inserted.id);
        return NextResponse.json(
          { error: `Failed to deduct pass session: ${usageErr.message}` },
          { status: 500 }
        );
      }
      await ctx.supabase.rpc("increment_pass_usage", {
        p_subscription_id: passSubscriptionForUsage.id,
      });
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
