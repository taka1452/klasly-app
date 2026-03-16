import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

// GET: list instructor's own classes
export async function GET() {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await ctx.supabase
      .from("classes")
      .select("*, rooms(name)")
      .eq("studio_id", ctx.studioId)
      .eq("instructor_id", ctx.instructorId)
      .order("created_at", { ascending: false });

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

// POST: create a new class (Collective Mode — instructor self-scheduling)
export async function POST(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify studio is in Collective Mode (owners can always create classes)
    if (ctx.role !== "owner") {
      const { data: studio } = await ctx.supabase
        .from("studios")
        .select("payout_model")
        .eq("id", ctx.studioId)
        .single();

      if (!studio || studio.payout_model !== "instructor_direct") {
        return NextResponse.json(
          { error: "Self-scheduling is only available in Collective Mode" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      name,
      description,
      day_of_week,
      start_time,
      duration_minutes,
      capacity,
      room_id,
      is_public,
      price_cents,
    } = body;

    if (!name || day_of_week === undefined || !start_time || !duration_minutes || !capacity) {
      return NextResponse.json(
        { error: "name, day_of_week, start_time, duration_minutes, capacity are required" },
        { status: 400 }
      );
    }

    if (price_cents !== undefined && price_cents !== null && price_cents < 0) {
      return NextResponse.json(
        { error: "Price must be a positive number" },
        { status: 400 }
      );
    }

    // Duration must be <= 180 minutes (3 hours)
    if (duration_minutes > 180) {
      return NextResponse.json(
        { error: "Duration must be 3 hours or less" },
        { status: 400 }
      );
    }

    // Validate room belongs to studio
    if (room_id) {
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
    }

    // Format start_time for PostgreSQL
    const startTimeFormatted = start_time.length === 5
      ? `${start_time}:00`
      : start_time;

    // Check time quota (instructor membership) — skip for owners
    if (ctx.role === "owner") {
      // Owners have no quota restrictions
    } else {
    const { data: membership } = await ctx.supabase
      .from("instructor_memberships")
      .select("tier_id, instructor_membership_tiers(monthly_minutes)")
      .eq("instructor_id", ctx.instructorId)
      .eq("status", "active")
      .maybeSingle();

    if (membership) {
      const rawTier = membership.instructor_membership_tiers as unknown;
      const tierData = (Array.isArray(rawTier) ? rawTier[0] : rawTier) as {
        monthly_minutes: number;
      } | null;
      const monthlyMinutes = tierData?.monthly_minutes ?? -1;

      if (monthlyMinutes !== -1) {
        // For recurring classes, check if there's enough quota for one session
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const { data: usedData } = await ctx.supabase.rpc(
          "get_instructor_used_minutes",
          {
            p_instructor_id: ctx.instructorId,
            p_year: year,
            p_month: month,
          }
        );

        const usedMinutes = typeof usedData === "number" ? usedData : 0;
        const remainingMinutes = monthlyMinutes - usedMinutes;

        if (duration_minutes > remainingMinutes) {
          return NextResponse.json(
            {
              error: `Not enough monthly hours. Remaining: ${Math.floor(remainingMinutes / 60)}h${remainingMinutes % 60 > 0 ? ` ${remainingMinutes % 60}m` : ""}`,
            },
            { status: 403 }
          );
        }
      }
    }
    } // end else (non-owner quota check)

    // Create the class
    const { data: newClass, error: classError } = await ctx.supabase
      .from("classes")
      .insert({
        studio_id: ctx.studioId,
        instructor_id: ctx.instructorId,
        name,
        description: description || null,
        day_of_week,
        start_time: startTimeFormatted,
        duration_minutes,
        capacity,
        room_id: room_id || null,
        is_public: is_public ?? true,
        price_cents: price_cents ?? null,
        is_active: true,
      })
      .select("id, start_time, capacity")
      .single();

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 });
    }

    // Generate 4 weeks of sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDay = today.getDay();
    const daysUntilFirst = (day_of_week - currentDay + 7) % 7;
    const firstSessionDate = new Date(today);
    firstSessionDate.setDate(today.getDate() + daysUntilFirst);

    const sessionsToInsert = [];
    for (let i = 0; i < 4; i++) {
      const sessionDate = new Date(firstSessionDate);
      sessionDate.setDate(firstSessionDate.getDate() + i * 7);
      sessionsToInsert.push({
        studio_id: ctx.studioId,
        class_id: newClass.id,
        session_date: sessionDate.toISOString().split("T")[0],
        start_time: startTimeFormatted,
        capacity: newClass.capacity,
        is_cancelled: false,
        is_public: is_public ?? true,
      });
    }

    await ctx.supabase.from("class_sessions").insert(sessionsToInsert);

    return NextResponse.json(newClass, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
