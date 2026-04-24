import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

/**
 * GET /api/class-templates
 * List all class templates for a studio.
 * Access: Owner, Manager (can_manage_classes), Instructor
 */
export async function GET() {
  try {
    // Try dashboard context first (owner/manager)
    const dashCtx = await getDashboardContext();
    if (dashCtx) {
      if (
        dashCtx.role === "manager" &&
        !dashCtx.permissions?.can_manage_classes
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data, error } = await dashCtx.supabase
        .from("class_templates")
        .select("*, instructors(id, profiles(full_name))")
        .eq("studio_id", dashCtx.studioId)
        .order("sort_order", { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // テンプレートごとのスケジュール曜日を取得
      const templateIds = (data || []).map((t: { id: string }) => t.id);
      let scheduleDays: Record<string, number[]> = {};
      if (templateIds.length > 0) {
        const { data: classes } = await dashCtx.supabase
          .from("classes")
          .select("template_id, day_of_week")
          .in("template_id", templateIds);
        if (classes) {
          for (const c of classes) {
            if (!c.template_id) continue;
            if (!scheduleDays[c.template_id]) scheduleDays[c.template_id] = [];
            if (!scheduleDays[c.template_id].includes(c.day_of_week)) {
              scheduleDays[c.template_id].push(c.day_of_week);
            }
          }
        }
      }

      const enriched = (data || []).map((t: { id: string }) => ({
        ...t,
        schedule_days: scheduleDays[t.id] || [],
      }));

      return NextResponse.json(enriched);
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await instrCtx.supabase
      .from("class_templates")
      .select("*, instructors(id, profiles(full_name))")
      .eq("studio_id", instrCtx.studioId)
      .eq("instructor_id", instrCtx.instructorId)
      .eq("is_active", true)
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

/**
 * POST /api/class-templates
 * Create a new class template.
 * Access: Owner, Manager (can_manage_classes), Instructor (forced to own instructor_id)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      duration_minutes,
      capacity,
      price_cents,
      location,
      class_type,
      online_link,
      is_public,
      instructor_id,
      room_id,
      recurrence_end_date,
      transition_minutes,
      special_instructions,
    } = body;

    // --- Validation ---
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (
      typeof duration_minutes !== "number" ||
      duration_minutes <= 0
    ) {
      return NextResponse.json(
        { error: "duration_minutes must be greater than 0" },
        { status: 400 }
      );
    }

    if (typeof capacity !== "number" || capacity <= 0) {
      return NextResponse.json(
        { error: "capacity must be greater than 0" },
        { status: 400 }
      );
    }

    const validClassTypes = ["in_person", "online", "hybrid"] as const;
    if (!class_type || !validClassTypes.includes(class_type)) {
      return NextResponse.json(
        { error: "class_type must be 'in_person', 'online', or 'hybrid'" },
        { status: 400 }
      );
    }

    // Try dashboard context first (owner/manager)
    const dashCtx = await getDashboardContext();
    if (dashCtx) {
      if (
        dashCtx.role === "manager" &&
        !dashCtx.permissions?.can_manage_classes
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // 新規テンプレートを末尾に追加するため、現在の最大sort_orderを取得
      const { data: maxRow } = await dashCtx.supabase
        .from("class_templates")
        .select("sort_order")
        .eq("studio_id", dashCtx.studioId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();
      const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

      const { data, error } = await dashCtx.supabase
        .from("class_templates")
        .insert({
          studio_id: dashCtx.studioId,
          instructor_id: instructor_id || null,
          room_id: room_id || null,
          name: name.trim(),
          description: description || null,
          duration_minutes,
          capacity,
          price_cents: price_cents ?? null,
          location: location || null,
          class_type,
          online_link: online_link || null,
          is_public: is_public ?? true,
          is_active: true,
          sort_order: nextSortOrder,
          recurrence_end_date: recurrence_end_date || null,
          transition_minutes: transition_minutes || null,
          special_instructions: special_instructions?.trim?.() || null,
        })
        .select("*, instructors(id, profiles(full_name))")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Instructors are forced to use their own instructor_id
    const { data, error } = await instrCtx.supabase
      .from("class_templates")
      .insert({
        studio_id: instrCtx.studioId,
        instructor_id: instrCtx.instructorId,
        room_id: room_id || null,
        name: name.trim(),
        description: description || null,
        duration_minutes,
        capacity,
        price_cents: price_cents ?? null,
        location: location || null,
        class_type,
        online_link: online_link || null,
        is_public: is_public ?? true,
        is_active: true,
        recurrence_end_date: recurrence_end_date || null,
        transition_minutes: transition_minutes || null,
        special_instructions: special_instructions?.trim?.() || null,
      })
      .select("*, instructors(id, profiles(full_name))")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
