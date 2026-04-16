import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * Backward-compatible wrapper around class_sessions.
 * instructor_room_bookings is deprecated — all data now lives in class_sessions
 * with session_type IN ('class', 'room_only').
 *
 * Response format is preserved for the existing room-calendar UI.
 */

// GET: 自分のセッション一覧 (ルーム付き)
export async function GET(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabled = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.ROOM_MANAGEMENT);
    if (!roomEnabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = ctx.supabase
      .from("class_sessions")
      .select("*, rooms(name, capacity)")
      .eq("instructor_id", ctx.instructorId)
      .eq("is_cancelled", false)
      .not("room_id", "is", null)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (from) query = query.gte("session_date", from);
    if (to) query = query.lte("session_date", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to backward-compatible shape for room-calendar UI
    const mapped = (data || []).map(mapSessionToBooking);

    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: 新規ルームブッキング作成 → class_sessions に挿入
export async function POST(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomEnabledPost = await isFeatureEnabled(ctx.studioId, FEATURE_KEYS.ROOM_MANAGEMENT);
    if (!roomEnabledPost) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { room_id, title, booking_date, start_time, end_time, is_public, notes, recurring, day_of_week, weeks } = body;

    if (!room_id || !title || !start_time || !end_time) {
      return NextResponse.json(
        { error: "room_id, title, start_time, end_time are required" },
        { status: 400 }
      );
    }

    if (recurring) {
      if (day_of_week === undefined || day_of_week === null || day_of_week < 0 || day_of_week > 6) {
        return NextResponse.json(
          { error: "day_of_week (0-6) is required for recurring bookings" },
          { status: 400 }
        );
      }
    } else {
      if (!booking_date) {
        return NextResponse.json(
          { error: "booking_date is required" },
          { status: 400 }
        );
      }
    }

    // 過去日バリデーション (one-time only)
    const today = new Date().toISOString().split("T")[0];
    if (!recurring && booking_date < today) {
      return NextResponse.json(
        { error: "Cannot book a room in the past" },
        { status: 400 }
      );
    }

    // 時間帯バリデーション
    if (end_time <= start_time) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // 部屋がこのスタジオに属しているか確認
    const { data: room } = await ctx.supabase
      .from("rooms")
      .select("id, studio_id, is_active")
      .eq("id", room_id)
      .single();

    if (!room || room.studio_id !== ctx.studioId || !room.is_active) {
      return NextResponse.json(
        { error: "Room not found or inactive" },
        { status: 404 }
      );
    }

    // Generate list of booking dates
    const bookingDates: string[] = [];
    if (recurring) {
      const numWeeks = Math.min(Math.max(weeks ?? 8, 1), 52);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const currentDay = todayDate.getDay();
      const daysUntilFirst = (day_of_week - currentDay + 7) % 7 || 7;
      const firstDate = new Date(todayDate);
      firstDate.setDate(todayDate.getDate() + daysUntilFirst);

      for (let i = 0; i < numWeeks; i++) {
        const d = new Date(firstDate);
        d.setDate(firstDate.getDate() + i * 7);
        bookingDates.push(d.toISOString().split("T")[0]);
      }
    } else {
      bookingDates.push(booking_date);
    }

    // 重複チェック: class_sessions で同じ部屋・時間帯の衝突確認
    const { data: conflicts } = await ctx.supabase
      .from("class_sessions")
      .select("id, title, session_date, start_time, end_time")
      .eq("room_id", room_id)
      .in("session_date", bookingDates)
      .eq("is_cancelled", false)
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        {
          error: recurring
            ? `Room conflicts found on ${conflicts.length} date(s)`
            : "This room is already booked during that time",
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

    // Time quota enforcement: check instructor's membership tier
    const { data: membership } = await ctx.supabase
      .from("instructor_memberships")
      .select("tier_id, instructor_membership_tiers(monthly_minutes, allow_overage, overage_rate_cents)")
      .eq("instructor_id", ctx.instructorId)
      .eq("status", "active")
      .maybeSingle();

    let overageWarning: string | null = null;

    if (membership) {
      const rawTier = membership.instructor_membership_tiers as unknown;
      const tierData = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
        monthly_minutes: number;
        allow_overage: boolean;
        overage_rate_cents: number | null;
      } | null;
      const monthlyMinutes = tierData?.monthly_minutes ?? -1;
      const allowOverage = tierData?.allow_overage ?? true;
      const overageRateCents = tierData?.overage_rate_cents ?? null;

      if (monthlyMinutes !== -1) {
        const [sh, sm] = start_time.split(":").map(Number);
        const [eh, em] = end_time.split(":").map(Number);
        const perBookingMinutes = (eh * 60 + em) - (sh * 60 + sm);
        const totalRequestedMinutes = perBookingMinutes * bookingDates.length;

        const fmtH = (m: number) => {
          const h = Math.floor(m / 60);
          const r = m % 60;
          return h > 0 && r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${r}m`;
        };

        // Group booking dates by year-month so multi-month recurring bookings
        // are checked against each month's allowance separately.
        const datesByMonth = new Map<string, { year: number; month: number; count: number }>();
        for (const date of bookingDates) {
          const d = new Date(date);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const key = `${y}-${m}`;
          const existing = datesByMonth.get(key);
          if (existing) existing.count += 1;
          else datesByMonth.set(key, { year: y, month: m, count: 1 });
        }

        // Fetch used minutes and compute overage for each affected month.
        const monthChecks: Array<{
          year: number;
          month: number;
          used: number;
          requested: number;
          overage: number;
        }> = [];
        for (const { year, month, count } of datesByMonth.values()) {
          const { data: usedData } = await ctx.supabase.rpc("get_instructor_used_minutes", {
            p_instructor_id: ctx.instructorId,
            p_year: year,
            p_month: month,
          });
          const used = typeof usedData === "number" ? usedData : 0;
          const requested = perBookingMinutes * count;
          const overage = Math.max(0, used + requested - monthlyMinutes);
          monthChecks.push({ year, month, used, requested, overage });
        }

        const exceedingMonths = monthChecks.filter((c) => c.overage > 0);

        // Block if any month would exceed the allowance and overage is disabled.
        if (exceedingMonths.length > 0 && !allowOverage) {
          return NextResponse.json(
            {
              error:
                exceedingMonths.length === 1
                  ? "You've reached your monthly hour limit. Please contact the studio to upgrade your membership."
                  : `These bookings would exceed your monthly hour limit across ${exceedingMonths.length} months. Please contact the studio to upgrade your membership.`,
              code: "QUOTA_BLOCKED",
            },
            { status: 403 }
          );
        }

        // Build overage / warning messages.
        if (exceedingMonths.length > 0) {
          const rateStr = overageRateCents ? `$${(overageRateCents / 100).toFixed(2)}` : null;
          const totalOverMinutes = exceedingMonths.reduce((s, c) => s + c.overage, 0);
          if (exceedingMonths.length === 1) {
            const m = exceedingMonths[0];
            overageWarning = `You've used ${fmtH(m.used)} of ${fmtH(monthlyMinutes)} this month. ${recurring ? `These ${bookingDates.length} bookings total ${fmtH(totalRequestedMinutes)}` : "This booking"} will put you ${fmtH(m.overage)} over your limit.${rateStr ? ` Additional hours are charged at ${rateStr}/hour.` : ""}`;
          } else {
            overageWarning = `These ${bookingDates.length} bookings span ${exceedingMonths.length} months and total ${fmtH(totalOverMinutes)} over your monthly limits.${rateStr ? ` Additional hours are charged at ${rateStr}/hour.` : ""}`;
          }
        } else {
          const approaching = monthChecks.find(
            (c) => c.used + c.requested >= monthlyMinutes * 0.9
          );
          if (approaching) {
            overageWarning = `You've used ${fmtH(approaching.used)} of ${fmtH(monthlyMinutes)} this month — approaching your limit.`;
          }
        }

        // Fire 90% warning email the first time a month crosses the threshold
        // because of this request.
        const thresholdCrossed = monthChecks.find(
          (c) =>
            c.used + c.requested >= monthlyMinutes * 0.9 &&
            c.used < monthlyMinutes * 0.9
        );
        if (thresholdCrossed) {
          sendOverageWarningEmail(
            ctx.supabase,
            ctx.instructorId,
            ctx.studioId,
            thresholdCrossed.used + thresholdCrossed.requested,
            monthlyMinutes,
            overageRateCents
          ).catch((err) => console.warn("[RoomBookings] Overage warning email failed:", err));
        }
      }
    }

    // Generate recurrence_group_id for recurring bookings
    const recurrenceGroupId = recurring ? crypto.randomUUID() : null;

    // Calculate duration_minutes
    const [sh, sm] = start_time.split(":").map(Number);
    const [eh, em] = end_time.split(":").map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

    // Insert into class_sessions as room_only sessions
    const sessionsToInsert = bookingDates.map((date) => ({
      studio_id: ctx.studioId,
      instructor_id: ctx.instructorId,
      room_id,
      template_id: null,
      session_type: "room_only" as const,
      title,
      session_date: date,
      start_time,
      end_time,
      duration_minutes: durationMinutes,
      is_public: is_public ?? true,
      is_cancelled: false,
      location: notes || null,
      recurrence_group_id: recurrenceGroupId,
      recurrence_rule: recurring ? ("weekly" as const) : null,
    }));

    const { data: insertedSessions, error: insertError } = await ctx.supabase
      .from("class_sessions")
      .insert(sessionsToInsert)
      .select("*");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Return backward-compatible format
    const bookings = (insertedSessions || []).map(mapSessionToBooking);

    // Send email notification to owner + managers with can_manage_rooms (fire-and-forget)
    notifyRoomBooking(ctx.supabase, ctx.studioId, ctx.instructorId, {
      roomId: room_id,
      title,
      dates: bookingDates,
      startTime: start_time,
      endTime: end_time,
    }).catch((err) => console.warn("[RoomBookings] Notification email failed:", err));

    return NextResponse.json(
      {
        bookings,
        count: bookings.length,
        overageWarning,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Map a class_sessions row to the old instructor_room_bookings shape
 * for backward compatibility with the room-calendar UI.
 */
function mapSessionToBooking(session: Record<string, unknown>) {
  return {
    id: session.id,
    studio_id: session.studio_id,
    instructor_id: session.instructor_id,
    room_id: session.room_id,
    title: session.title,
    booking_date: session.session_date,
    start_time: session.start_time,
    end_time: session.end_time,
    is_public: session.is_public,
    notes: session.location,
    status: session.is_cancelled ? "cancelled" : "confirmed",
    recurrence_group_id: session.recurrence_group_id,
    day_of_week: session.session_date
      ? new Date(session.session_date + "T00:00:00").getDay()
      : null,
    rooms: session.rooms,
    // Preserve these for forward compatibility
    session_type: session.session_type,
    template_id: session.template_id,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

// Helper: send 90% warning email (fire-and-forget, deduped by email_logs)
async function sendOverageWarningEmail(
  supabase: SupabaseClient,
  instructorId: string,
  studioId: string,
  usedMinutes: number,
  monthlyMinutes: number,
  overageRateCents: number | null,
) {
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Get instructor email
    const { data: instructor } = await supabase
      .from("instructors")
      .select("profile_id, profiles(email, full_name)")
      .eq("id", instructorId)
      .single();

    if (!instructor) return;
    const rawProfile = instructor.profiles as unknown;
    const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as { email: string; full_name: string } | null;
    if (!profile?.email) return;

    // Check existing email_log for this specific instructor this month
    const { data: alreadySent } = await supabase
      .from("email_logs")
      .select("id")
      .eq("template", "tierOverageWarning")
      .eq("to_email", profile.email)
      .gte("created_at", `${monthKey}-01`)
      .limit(1);

    if (alreadySent && alreadySent.length > 0) return;

    // Get studio name
    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();

    const { tierOverageWarning } = await import("@/lib/email/templates");
    const { sendEmail } = await import("@/lib/email/send");

    const fmtH = (m: number) => {
      const h = Math.floor(m / 60);
      const r = m % 60;
      return h > 0 && r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${r}m`;
    };

    const template = tierOverageWarning({
      instructorName: profile.full_name || "Instructor",
      studioName: studio?.name || "your studio",
      usedTime: fmtH(usedMinutes),
      limitTime: fmtH(monthlyMinutes),
      overageRate: overageRateCents ? `$${(overageRateCents / 100).toFixed(2)}` : null,
    });

    await sendEmail({
      to: profile.email,
      subject: template.subject,
      html: template.html,
      studioId,
      templateName: "tierOverageWarning",
    });
  } catch (err) {
    console.error("[OverageWarning] Failed to send warning email:", err);
  }
}

// Helper: notify owner + managers with can_manage_rooms about a new room booking
async function notifyRoomBooking(
  supabase: SupabaseClient,
  studioId: string,
  instructorId: string,
  booking: {
    roomId: string;
    title: string;
    dates: string[];
    startTime: string;
    endTime: string;
  },
) {
  try {
    // Get instructor name
    const { data: instructor } = await supabase
      .from("instructors")
      .select("profiles(full_name)")
      .eq("id", instructorId)
      .single();
    const instrProfile = instructor?.profiles as unknown;
    const instrP = (Array.isArray(instrProfile) ? instrProfile[0] : instrProfile) as { full_name: string } | null;
    const instructorName = instrP?.full_name || "An instructor";

    // Get room name
    const { data: room } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", booking.roomId)
      .single();
    const roomName = room?.name || "a room";

    // Get studio name
    const { data: studio } = await supabase
      .from("studios")
      .select("name")
      .eq("id", studioId)
      .single();
    const studioName = studio?.name || "your studio";

    // Get owner email
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .single();

    // Get managers with can_manage_rooms
    const { data: managers } = await supabase
      .from("managers")
      .select("profiles(email, full_name)")
      .eq("studio_id", studioId)
      .eq("can_manage_rooms", true);

    const recipients: { email: string; name: string }[] = [];
    if (ownerProfile?.email) {
      recipients.push({ email: ownerProfile.email, name: ownerProfile.full_name || "Owner" });
    }
    if (managers) {
      for (const m of managers) {
        const mp = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { email: string; full_name: string } | null;
        if (mp?.email && !recipients.some((r) => r.email === mp.email)) {
          recipients.push({ email: mp.email, name: mp.full_name || "Manager" });
        }
      }
    }

    if (recipients.length === 0) return;

    const { instructorRoomBooking } = await import("@/lib/email/templates");
    const { sendEmail } = await import("@/lib/email/send");

    const dateStr = booking.dates.length === 1
      ? booking.dates[0]
      : `${booking.dates[0]} (${booking.dates.length} sessions)`;

    for (const recipient of recipients) {
      const template = instructorRoomBooking({
        recipientName: recipient.name,
        instructorName,
        roomName,
        date: dateStr,
        startTime: booking.startTime,
        endTime: booking.endTime,
        title: booking.title || null,
        studioName,
      });

      await sendEmail({
        to: recipient.email,
        subject: template.subject,
        html: template.html,
        studioId,
        templateName: "instructorRoomBooking",
      });
    }
  } catch (err) {
    console.error("[RoomBooking] Failed to send notification:", err);
  }
}
