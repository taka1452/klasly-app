import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/class-templates/[id]
 * Get a single class template with instructor info.
 * Access: Owner, Manager (can_manage_classes), Instructor
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Try dashboard context first
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
        .eq("id", id)
        .eq("studio_id", dashCtx.studioId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await instrCtx.supabase
      .from("class_templates")
      .select("*, instructors(id, profiles(full_name))")
      .eq("id", id)
      .eq("studio_id", instrCtx.studioId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/class-templates/[id]
 * Update a class template (partial update).
 * Owner/Manager: can update any template in their studio.
 * Instructor: can only update templates where instructor_id matches their own.
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
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
    } = body;

    // --- Validation ---
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "name must be a non-empty string" },
          { status: 400 }
        );
      }
    }

    if (duration_minutes !== undefined) {
      if (typeof duration_minutes !== "number" || duration_minutes <= 0) {
        return NextResponse.json(
          { error: "duration_minutes must be greater than 0" },
          { status: 400 }
        );
      }
    }

    if (capacity !== undefined) {
      if (typeof capacity !== "number" || capacity <= 0) {
        return NextResponse.json(
          { error: "capacity must be greater than 0" },
          { status: 400 }
        );
      }
    }

    if (class_type !== undefined) {
      const validClassTypes = ["in_person", "online", "hybrid"] as const;
      if (!validClassTypes.includes(class_type)) {
        return NextResponse.json(
          { error: "class_type must be 'in_person', 'online', or 'hybrid'" },
          { status: 400 }
        );
      }
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

      // Verify template belongs to this studio
      const { data: existing } = await dashCtx.supabase
        .from("class_templates")
        .select("id")
        .eq("id", id)
        .eq("studio_id", dashCtx.studioId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description || null;
      if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
      if (capacity !== undefined) updates.capacity = capacity;
      if (price_cents !== undefined) updates.price_cents = price_cents ?? null;
      if (location !== undefined) updates.location = location || null;
      if (class_type !== undefined) updates.class_type = class_type;
      if (online_link !== undefined) updates.online_link = online_link || null;
      if (is_public !== undefined) updates.is_public = is_public;
      if (instructor_id !== undefined) updates.instructor_id = instructor_id || null;
      if (room_id !== undefined) updates.room_id = room_id || null;
      if (recurrence_end_date !== undefined) updates.recurrence_end_date = recurrence_end_date || null;
      if (transition_minutes !== undefined) updates.transition_minutes = transition_minutes || null;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 }
        );
      }

      const { data, error } = await dashCtx.supabase
        .from("class_templates")
        .update(updates)
        .eq("id", id)
        .eq("studio_id", dashCtx.studioId)
        .select("*, instructors(id, profiles(full_name))")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Instructors can only update their own templates
    const { data: existing } = await instrCtx.supabase
      .from("class_templates")
      .select("id, instructor_id")
      .eq("id", id)
      .eq("studio_id", instrCtx.studioId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (existing.instructor_id !== instrCtx.instructorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (capacity !== undefined) updates.capacity = capacity;
    if (price_cents !== undefined) updates.price_cents = price_cents ?? null;
    if (location !== undefined) updates.location = location || null;
    if (class_type !== undefined) updates.class_type = class_type;
    if (online_link !== undefined) updates.online_link = online_link || null;
    if (is_public !== undefined) updates.is_public = is_public;
    if (room_id !== undefined) updates.room_id = room_id || null;
    // Instructors cannot change instructor_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await instrCtx.supabase
      .from("class_templates")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", instrCtx.studioId)
      .select("*, instructors(id, profiles(full_name))")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/class-templates/[id]
 * Soft-delete a class template (set is_active = false).
 * Owner/Manager: can delete any template in their studio.
 * Instructor: can only delete templates where instructor_id matches their own.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

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
        .update({ is_active: false })
        .eq("id", id)
        .eq("studio_id", dashCtx.studioId)
        .select("id")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Fallback: instructor context
    const instrCtx = await getInstructorContext();
    if (!instrCtx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify template belongs to the instructor
    const { data: existing } = await instrCtx.supabase
      .from("class_templates")
      .select("id, instructor_id")
      .eq("id", id)
      .eq("studio_id", instrCtx.studioId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (existing.instructor_id !== instrCtx.instructorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await instrCtx.supabase
      .from("class_templates")
      .update({ is_active: false })
      .eq("id", id)
      .eq("studio_id", instrCtx.studioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
