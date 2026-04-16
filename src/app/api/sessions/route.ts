import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * POST /api/sessions
 * Create session(s) — supports single and weekly recurring.
 * Access: Owner, Manager (can_manage_classes), Instructor
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      template_id,
      room_id,
      date,
      start_time,
      end_time: rawEndTime,
      title,
      is_public,
      price_cents,
      location,
      online_link,
      instructor_id: bodyInstructorId,
      repeat = "single",
      repeat_weeks = 4,
      repeat_never,
    } = body;

    // --- Basic validation ---
    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { error: "date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (!start_time || typeof start_time !== "string") {
      return NextResponse.json(
        { error: "start_time is required (HH:MM)" },
        { status: 400 }
      );
    }

    // Must have template_id (class) or title (room_only)
    if (!template_id && !title) {
      return NextResponse.json(
        { error: "Either template_id or title is required" },
        { status: 400 }
      );
    }

    // Date not in the past
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return NextResponse.json(
        { error: "Cannot create sessions in the past" },
        { status: 400 }
      );
    }

    // Repeat validation
    const validRepeat = ["single", "weekly"] as const;
    if (!validRepeat.includes(repeat)) {
      return NextResponse.json(
        { error: "repeat must be 'single' or 'weekly'" },
        { status: 400 }
      );
    }
    // For "never" (ongoing) repeat, we'll resolve weeks after auth when we have studioId
    let weeks = Math.min(Math.max(repeat_weeks ?? 4, 1), 52);
    const isOngoing = repeat === "weekly" && repeat_never === true;

    // --- Auth: try dashboard first, then instructor ---
    const dashCtx = await getDashboardContext();
    let supabase: SupabaseClient;
    let studioId: string;
    let resolvedInstructorId: string | null = null;
    let authSource: "dashboard" | "instructor" = "dashboard";

    if (dashCtx) {
      // Manager needs can_manage_classes
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
      resolvedInstructorId = instrCtx.instructorId;
      authSource = "instructor";
    }

    // For ongoing (never-ending) repeat, use studio's session_generation_weeks
    if (isOngoing) {
      const { data: studio } = await supabase
        .from("studios")
        .select("session_generation_weeks")
        .eq("id", studioId)
        .single();
      weeks = (studio?.session_generation_weeks as number) || 8;
    }

    // --- Determine session_type and fetch template if needed ---
    const sessionType = template_id ? "class" : "room_only";

    let durationMinutes: number | null = null;
    let templateCapacity: number | null = null;
    let templateIsPublic = true;
    let templatePriceCents: number | null = null;
    let templateTitle: string | null = null;
    let templateLocation: string | null = null;
    let templateOnlineLink: string | null = null;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from("class_templates")
        .select(
          "id, name, duration_minutes, capacity, price_cents, location, online_link, is_public, instructor_id, studio_id"
        )
        .eq("id", template_id)
        .single();

      if (templateError || !template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      // Ensure template belongs to same studio
      if (template.studio_id !== studioId) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      durationMinutes = template.duration_minutes;
      templateCapacity = template.capacity;
      templateIsPublic = template.is_public ?? true;
      templatePriceCents = template.price_cents;
      templateTitle = template.name;
      templateLocation = template.location;
      templateOnlineLink = template.online_link;

      // For dashboard context, allow explicit instructor_id override, else use template's
      if (authSource === "dashboard") {
        if (bodyInstructorId) {
          resolvedInstructorId = bodyInstructorId;
        } else if (template.instructor_id) {
          resolvedInstructorId = template.instructor_id;
        }
      }
    }

    // For dashboard context without template, allow explicit instructor_id
    if (authSource === "dashboard" && !resolvedInstructorId && bodyInstructorId) {
      resolvedInstructorId = bodyInstructorId;
    }

    // --- Calculate end_time ---
    let endTime = rawEndTime as string | undefined;
    if (!endTime) {
      if (!durationMinutes) {
        return NextResponse.json(
          {
            error:
              "end_time is required when no template is provided",
          },
          { status: 400 }
        );
      }
      // Calculate from start_time + duration_minutes
      const [sh, sm] = start_time.split(":").map(Number);
      const totalMinutes = sh * 60 + sm + durationMinutes;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    }

    // start_time < end_time
    if (endTime <= start_time) {
      return NextResponse.json(
        { error: "end_time must be after start_time" },
        { status: 400 }
      );
    }

    // Compute duration_minutes from times if not from template
    if (!durationMinutes) {
      const [sh, sm] = start_time.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      durationMinutes = eh * 60 + em - (sh * 60 + sm);
    }

    // --- Generate booking dates ---
    const sessionDates: string[] = [];
    if (repeat === "weekly") {
      const baseDate = new Date(date + "T00:00:00");
      for (let i = 0; i < weeks; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i * 7);
        sessionDates.push(d.toISOString().split("T")[0]);
      }
    } else {
      sessionDates.push(date);
    }

    // --- Room validation & availability ---
    if (room_id) {
      const { data: room } = await supabase
        .from("rooms")
        .select("id, studio_id, is_active")
        .eq("id", room_id)
        .single();

      if (!room || room.studio_id !== studioId || !room.is_active) {
        return NextResponse.json(
          { error: "Room not found or inactive" },
          { status: 404 }
        );
      }

      // Check availability for each date
      const skippedDates: { date: string; reason: string }[] = [];
      const availableDates: string[] = [];

      for (const sessionDate of sessionDates) {
        const { data: available, error: rpcError } = await supabase.rpc(
          "check_room_availability",
          {
            p_room_id: room_id,
            p_booking_date: sessionDate,
            p_start_time: start_time,
            p_end_time: endTime,
          }
        );

        if (rpcError) {
          // If RPC fails, fall back to manual conflict check
          const { data: conflicts } = await supabase
            .from("class_sessions")
            .select("id")
            .eq("room_id", room_id)
            .eq("session_date", sessionDate)
            .eq("is_cancelled", false)
            .lt("start_time", endTime)
            .gt("end_time", start_time);

          if (conflicts && conflicts.length > 0) {
            skippedDates.push({
              date: sessionDate,
              reason: "Room conflict",
            });
            continue;
          }
        } else if (available === false) {
          skippedDates.push({
            date: sessionDate,
            reason: "Room not available",
          });
          continue;
        }

        availableDates.push(sessionDate);
      }

      // For single bookings, if room is not available, reject
      if (repeat === "single" && availableDates.length === 0) {
        return NextResponse.json(
          {
            error: "Room is not available at the requested time",
            skipped: skippedDates,
          },
          { status: 409 }
        );
      }

      // Replace sessionDates with available dates
      sessionDates.length = 0;
      sessionDates.push(...availableDates);

      // If all dates were skipped for recurring
      if (sessionDates.length === 0) {
        return NextResponse.json(
          {
            error: "No available dates for the requested time slot",
            skipped: skippedDates,
          },
          { status: 409 }
        );
      }

      // --- Quota check (Collective Mode) ---
      let overageWarning: string | null = null;
      if (resolvedInstructorId) {
        const quotaResult = await checkInstructorQuota(
          supabase,
          resolvedInstructorId,
          studioId,
          sessionDates,
          start_time,
          endTime
        );

        if (quotaResult.blocked) {
          return NextResponse.json(
            { error: quotaResult.message, code: "QUOTA_BLOCKED" },
            { status: 403 }
          );
        }
        overageWarning = quotaResult.warning;
      }

      // Generate recurrence_group_id
      const recurrenceGroupId =
        repeat === "weekly" ? crypto.randomUUID() : null;

      // Build insert rows
      const rows = sessionDates.map((sessionDate) => ({
        studio_id: studioId,
        template_id: template_id || null,
        room_id,
        instructor_id: resolvedInstructorId,
        session_type: sessionType,
        session_date: sessionDate,
        start_time,
        end_time: endTime,
        duration_minutes: durationMinutes,
        title: title || templateTitle || "Session",
        capacity: templateCapacity ?? 0,
        is_public: is_public ?? templateIsPublic,
        price_cents: price_cents ?? templatePriceCents ?? null,
        location: location || templateLocation || null,
        online_link: online_link || templateOnlineLink || null,
        is_cancelled: false,
        recurrence_group_id: recurrenceGroupId,
        recurrence_rule: repeat === "weekly" ? "weekly" : null,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("class_sessions")
        .insert(rows)
        .select("*");

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      // For ongoing recurrence, clear recurrence_end_date on the template
      if (isOngoing && template_id) {
        await supabase
          .from("class_templates")
          .update({ recurrence_end_date: null })
          .eq("id", template_id);
      }

      return NextResponse.json(
        {
          sessions: inserted,
          created: sessionDates,
          skipped: skippedDates.length > 0 ? skippedDates : undefined,
          overageWarning: overageWarning || undefined,
        },
        { status: 201 }
      );
    }

    // --- No room_id path (online / external location) ---
    const recurrenceGroupId =
      repeat === "weekly" ? crypto.randomUUID() : null;

    const rows = sessionDates.map((sessionDate) => ({
      studio_id: studioId,
      template_id: template_id || null,
      room_id: null,
      instructor_id: resolvedInstructorId,
      session_type: sessionType,
      session_date: sessionDate,
      start_time,
      end_time: endTime,
      duration_minutes: durationMinutes,
      title: title || templateTitle || "Session",
      capacity: templateCapacity ?? 0,
      is_public: is_public ?? templateIsPublic,
      price_cents: price_cents ?? templatePriceCents ?? null,
      location: location || templateLocation || null,
      online_link: online_link || templateOnlineLink || null,
      is_cancelled: false,
      recurrence_group_id: recurrenceGroupId,
      recurrence_rule: repeat === "weekly" ? "weekly" : null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("class_sessions")
      .insert(rows)
      .select("*");

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // For ongoing recurrence, clear recurrence_end_date on the template
    if (isOngoing && template_id) {
      await supabase
        .from("class_templates")
        .update({ recurrence_end_date: null })
        .eq("id", template_id);
    }

    return NextResponse.json(
      {
        sessions: inserted,
        created: sessionDates,
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

// --- Helper: check instructor quota ---
async function checkInstructorQuota(
  supabase: SupabaseClient,
  instructorId: string,
  studioId: string,
  dates: string[],
  startTime: string,
  endTime: string
): Promise<{ blocked: boolean; message?: string; warning: string | null }> {
  // Look up active membership
  const { data: membership } = await supabase
    .from("instructor_memberships")
    .select(
      "tier_id, instructor_membership_tiers(monthly_minutes, allow_overage, overage_rate_cents)"
    )
    .eq("instructor_id", instructorId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return { blocked: false, warning: null };
  }

  const rawTier = membership.instructor_membership_tiers as unknown;
  const tierData = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
    monthly_minutes: number;
    allow_overage: boolean;
    overage_rate_cents: number | null;
  } | null;

  const monthlyMinutes = tierData?.monthly_minutes ?? -1;
  if (monthlyMinutes === -1) {
    return { blocked: false, warning: null };
  }

  const allowOverage = tierData?.allow_overage ?? true;
  const overageRateCents = tierData?.overage_rate_cents ?? null;

  // Calculate per-booking duration
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const perBookingMinutes = eh * 60 + em - (sh * 60 + sm);
  const totalRequestedMinutes = perBookingMinutes * dates.length;

  // Check quota for the first booking's month
  const firstDate = new Date(dates[0]);
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth() + 1;

  const { data: usedData } = await supabase.rpc(
    "get_instructor_used_minutes",
    {
      p_instructor_id: instructorId,
      p_year: year,
      p_month: month,
    }
  );

  const usedMinutes = typeof usedData === "number" ? usedData : 0;

  const fmtH = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h > 0 && r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${r}m`;
  };

  if (usedMinutes + perBookingMinutes > monthlyMinutes) {
    if (!allowOverage) {
      return {
        blocked: true,
        message:
          "You've reached your monthly hour limit. Please contact the studio to upgrade your membership.",
        warning: null,
      };
    }
    const overMinutes =
      usedMinutes + totalRequestedMinutes - monthlyMinutes;
    const rateStr = overageRateCents
      ? `$${(overageRateCents / 100).toFixed(2)}`
      : null;
    return {
      blocked: false,
      warning: `You've used ${fmtH(usedMinutes)} of ${fmtH(monthlyMinutes)} this month. ${dates.length > 1 ? `These ${dates.length} sessions total ${fmtH(totalRequestedMinutes)}` : "This session"} will put you ${fmtH(overMinutes)} over your limit.${rateStr ? ` Additional hours are charged at ${rateStr}/hour.` : ""}`,
    };
  }

  if (usedMinutes >= monthlyMinutes * 0.9) {
    return {
      blocked: false,
      warning: `You've used ${fmtH(usedMinutes)} of ${fmtH(monthlyMinutes)} this month — approaching your limit.`,
    };
  }

  return { blocked: false, warning: null };
}
