import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// GET: 自分のルームブッキング一覧
export async function GET(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = ctx.supabase
      .from("instructor_room_bookings")
      .select("*, rooms(name, capacity)")
      .eq("instructor_id", ctx.instructorId)
      .eq("status", "confirmed")
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (from) query = query.gte("booking_date", from);
    if (to) query = query.lte("booking_date", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: 新規ルームブッキング作成
export async function POST(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { room_id, title, booking_date, start_time, end_time, is_public, notes, recurring, day_of_week, weeks } = body;

    // For recurring: day_of_week + start/end required, booking_date derived
    // For one-time: booking_date + start/end required
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
      // Generate N weeks of dates starting from next occurrence of day_of_week
      const numWeeks = Math.min(Math.max(weeks ?? 8, 1), 52);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const currentDay = todayDate.getDay();
      const daysUntilFirst = (day_of_week - currentDay + 7) % 7 || 7; // at least next week
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

    // 重複チェック: 全日付について同じ部屋で時間帯が重なるブッキングがないか
    const { data: conflicts } = await ctx.supabase
      .from("instructor_room_bookings")
      .select("id, title, booking_date, start_time, end_time")
      .eq("room_id", room_id)
      .in("booking_date", bookingDates)
      .eq("status", "confirmed")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        {
          error: recurring
            ? `Room conflicts found on ${conflicts.length} date(s)`
            : "This room is already booked during that time",
          conflicts,
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
        // Calculate per-booking duration
        const [sh, sm] = start_time.split(":").map(Number);
        const [eh, em] = end_time.split(":").map(Number);
        const perBookingMinutes = (eh * 60 + em) - (sh * 60 + sm);
        const totalRequestedMinutes = perBookingMinutes * bookingDates.length;

        // For simplicity: check quota for the first booking's month
        // (recurring bookings may span months, but this is a reasonable approximation)
        const firstBookingMonth = new Date(bookingDates[0]);
        const year = firstBookingMonth.getFullYear();
        const month = firstBookingMonth.getMonth() + 1;

        const { data: usedData } = await ctx.supabase.rpc("get_instructor_used_minutes", {
          p_instructor_id: ctx.instructorId,
          p_year: year,
          p_month: month,
        });

        const usedMinutes = typeof usedData === "number" ? usedData : 0;
        const remainingMinutes = monthlyMinutes - usedMinutes;

        const fmtH = (m: number) => {
          const h = Math.floor(m / 60);
          const r = m % 60;
          return h > 0 && r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${r}m`;
        };

        if (perBookingMinutes > remainingMinutes) {
          if (!allowOverage) {
            return NextResponse.json(
              {
                error: "You've reached your monthly hour limit. Please contact the studio to upgrade your membership.",
                code: "QUOTA_BLOCKED",
              },
              { status: 403 }
            );
          }
          const overMinutes = usedMinutes + totalRequestedMinutes - monthlyMinutes;
          const rateStr = overageRateCents ? `$${(overageRateCents / 100).toFixed(2)}` : null;
          overageWarning = `You've used ${fmtH(usedMinutes)} of ${fmtH(monthlyMinutes)} this month. ${recurring ? `These ${bookingDates.length} bookings total ${fmtH(totalRequestedMinutes)}` : "This booking"} will put you ${fmtH(overMinutes)} over your limit.${rateStr ? ` Additional hours are charged at ${rateStr}/hour.` : ""}`;
        } else if (usedMinutes >= monthlyMinutes * 0.9) {
          overageWarning = `You've used ${fmtH(usedMinutes)} of ${fmtH(monthlyMinutes)} this month — approaching your limit.`;
        }

        if (usedMinutes + perBookingMinutes >= monthlyMinutes * 0.9 && usedMinutes < monthlyMinutes * 0.9) {
          sendOverageWarningEmail(ctx.supabase, ctx.instructorId, ctx.studioId, usedMinutes + perBookingMinutes, monthlyMinutes, overageRateCents).catch(() => {});
        }
      }
    }

    // Generate recurrence_group_id for recurring bookings
    const recurrenceGroupId = recurring ? crypto.randomUUID() : null;

    // Insert booking(s)
    const bookingsToInsert = bookingDates.map((date) => ({
      studio_id: ctx.studioId,
      instructor_id: ctx.instructorId,
      room_id,
      title,
      booking_date: date,
      start_time,
      end_time,
      is_public: is_public ?? true,
      notes: notes || null,
      status: "confirmed" as const,
      recurrence_group_id: recurrenceGroupId,
      day_of_week: recurring ? day_of_week : null,
    }));

    const { data: insertedBookings, error: insertError } = await ctx.supabase
      .from("instructor_room_bookings")
      .insert(bookingsToInsert)
      .select("*");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        bookings: insertedBookings,
        count: insertedBookings?.length ?? 0,
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
    // Check if warning already sent this month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: existing } = await supabase
      .from("email_logs")
      .select("id")
      .eq("template", "tierOverageWarning")
      .eq("studio_id", studioId)
      .gte("created_at", `${monthKey}-01`)
      .like("to_email", `%`) // filter by instructor later
      .limit(1);

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
