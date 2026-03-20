import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

// GET: list instructor's own classes (from both legacy classes and class_templates)
export async function GET() {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query legacy classes table
    const { data: legacyClasses } = await ctx.supabase
      .from("classes")
      .select("*, rooms(name)")
      .eq("studio_id", ctx.studioId)
      .eq("instructor_id", ctx.instructorId)
      .order("created_at", { ascending: false });

    // Query new class_templates table
    const { data: templates } = await ctx.supabase
      .from("class_templates")
      .select("*")
      .eq("studio_id", ctx.studioId)
      .eq("instructor_id", ctx.instructorId)
      .order("created_at", { ascending: false });

    // Merge: use legacy classes, add any templates that don't exist in legacy
    const legacyIds = new Set((legacyClasses || []).map((c: { id: string }) => c.id));
    const uniqueTemplates = (templates || [])
      .filter((t: { id: string }) => !legacyIds.has(t.id))
      .map((t: Record<string, unknown>) => ({
        ...t,
        // Map class_templates fields to classes-compatible shape
        day_of_week: null,
        start_time: null,
        is_online: t.class_type === "online",
        rooms: null,
      }));

    return NextResponse.json([...(legacyClasses || []), ...uniqueTemplates]);
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
      is_online,
      online_link,
      schedule_type = "recurring",
      one_time_date,
    } = body;

    if (!name || !start_time || !duration_minutes || !capacity) {
      return NextResponse.json(
        { error: "name, start_time, duration_minutes, capacity are required" },
        { status: 400 }
      );
    }

    // Validate schedule_type specific fields
    if (schedule_type === "recurring") {
      if (day_of_week === undefined || day_of_week === null) {
        return NextResponse.json(
          { error: "day_of_week is required for recurring classes" },
          { status: 400 }
        );
      }
      if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6) {
        return NextResponse.json(
          { error: "day_of_week must be between 0 (Sunday) and 6 (Saturday)" },
          { status: 400 }
        );
      }
    } else if (schedule_type === "one_time") {
      if (!one_time_date) {
        return NextResponse.json(
          { error: "one_time_date is required for one-time classes" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "schedule_type must be 'recurring' or 'one_time'" },
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
        day_of_week: schedule_type === "recurring" ? day_of_week : null,
        start_time: startTimeFormatted,
        duration_minutes,
        capacity,
        room_id: is_online ? null : room_id || null,
        is_public: is_public ?? true,
        price_cents: price_cents ?? null,
        is_online: is_online ?? false,
        online_link: (is_online || online_link) ? online_link || null : null,
        schedule_type,
        one_time_date: schedule_type === "one_time" ? one_time_date : null,
        is_active: true,
      })
      .select("id, start_time, capacity")
      .single();

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 });
    }

    // Generate sessions based on schedule type
    const sessionsToInsert = [];

    if (schedule_type === "one_time") {
      // One-time: single session on the specified date
      sessionsToInsert.push({
        studio_id: ctx.studioId,
        class_id: newClass.id,
        session_date: one_time_date,
        start_time: startTimeFormatted,
        capacity: newClass.capacity,
        is_cancelled: false,
        is_public: is_public ?? true,
        is_online: is_online ?? false,
        online_link: (is_online || online_link) ? online_link || null : null,
      });
    } else {
      // Recurring: generate 4 weeks of sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentDay = today.getDay();
      const daysUntilFirst = (day_of_week - currentDay + 7) % 7;
      const firstSessionDate = new Date(today);
      firstSessionDate.setDate(today.getDate() + daysUntilFirst);

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
          is_online: is_online ?? false,
          online_link: (is_online || online_link) ? online_link || null : null,
        });
      }
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

// PATCH: update an existing class owned by the instructor
export async function PATCH(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id, name, description, capacity, is_active, price_cents,
      day_of_week, start_time, duration_minutes, room_id, is_public, is_online, online_link,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Class id is required" }, { status: 400 });
    }

    // Verify class belongs to the instructor
    const { data: existing } = await ctx.supabase
      .from("classes")
      .select("id, instructor_id, studio_id")
      .eq("id", id)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId || existing.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Validate new fields
    if (day_of_week !== undefined && (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6)) {
      return NextResponse.json({ error: "day_of_week must be between 0 (Sunday) and 6 (Saturday)" }, { status: 400 });
    }
    if (duration_minutes !== undefined && (duration_minutes < 1 || duration_minutes > 180)) {
      return NextResponse.json({ error: "Duration must be between 1 and 180 minutes" }, { status: 400 });
    }
    if (room_id) {
      const { data: room } = await ctx.supabase
        .from("rooms")
        .select("id")
        .eq("id", room_id)
        .eq("studio_id", ctx.studioId)
        .eq("is_active", true)
        .maybeSingle();
      if (!room) {
        return NextResponse.json({ error: "Room not found or inactive" }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description || null;
    if (capacity !== undefined) updates.capacity = capacity;
    if (is_active !== undefined) updates.is_active = is_active;
    if (price_cents !== undefined) updates.price_cents = price_cents;
    if (day_of_week !== undefined) updates.day_of_week = day_of_week;
    if (start_time !== undefined) updates.start_time = start_time.length === 5 ? `${start_time}:00` : start_time;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (room_id !== undefined) updates.room_id = room_id || null;
    if (is_public !== undefined) updates.is_public = is_public;
    if (is_online !== undefined) updates.is_online = is_online;
    if (online_link !== undefined) updates.online_link = online_link || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("classes")
      .update(updates)
      .eq("id", id)
      .select("id, name, description, day_of_week, start_time, duration_minutes, capacity, is_active, is_public, is_online, online_link, price_cents, room_id, rooms(name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: delete a class owned by the instructor
export async function DELETE(request: Request) {
  try {
    const ctx = await getInstructorContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Class id is required" }, { status: 400 });
    }

    // Verify class belongs to the instructor
    const { data: existing } = await ctx.supabase
      .from("classes")
      .select("id, instructor_id, studio_id")
      .eq("id", id)
      .single();

    if (!existing || existing.instructor_id !== ctx.instructorId || existing.studio_id !== ctx.studioId) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check for future confirmed bookings
    const today = new Date().toISOString().split("T")[0];
    const { data: futureSessions } = await ctx.supabase
      .from("class_sessions")
      .select("id")
      .eq("class_id", id)
      .gte("session_date", today)
      .eq("is_cancelled", false);

    if (futureSessions && futureSessions.length > 0) {
      const sessionIds = futureSessions.map((s: { id: string }) => s.id);
      const { count } = await ctx.supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("session_id", sessionIds)
        .eq("status", "confirmed");

      if (count && count > 0) {
        return NextResponse.json(
          { error: "Cannot delete class with future bookings. Deactivate it instead." },
          { status: 409 }
        );
      }

      // Delete future sessions without bookings
      await ctx.supabase
        .from("class_sessions")
        .delete()
        .eq("class_id", id)
        .gte("session_date", today);
    }

    const { error } = await ctx.supabase
      .from("classes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
