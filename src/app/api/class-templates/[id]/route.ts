import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logClassAudit } from "@/lib/audit/class-audit";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Diff the template's audit-relevant fields and write one history row
 * per material change. Centralised so the dashboard PUT and the
 * (separate) instructor PUT below stay consistent — and so adding new
 * audited fields later only takes one edit.
 */
async function logTemplateAudits(
  supabase: SupabaseClient,
  args: {
    studioId: string;
    templateId: string;
    actorProfileId: string;
    actorRole: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }
): Promise<void> {
  const base = {
    studioId: args.studioId,
    templateId: args.templateId,
    sessionId: null,
    actorProfileId: args.actorProfileId,
    actorRole: args.actorRole,
  };

  const changed = (key: string) =>
    Object.prototype.hasOwnProperty.call(args.after, key) &&
    args.after[key] !== args.before[key];

  if (changed("duration_minutes")) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "template_duration_changed",
      before: { duration_minutes: args.before.duration_minutes },
      after: { duration_minutes: args.after.duration_minutes },
      summary: `Duration ${args.before.duration_minutes ?? "—"} min → ${args.after.duration_minutes ?? "—"} min`,
    });
  }
  if (changed("capacity")) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "template_capacity_changed",
      before: { capacity: args.before.capacity },
      after: { capacity: args.after.capacity },
      summary: `Capacity ${args.before.capacity ?? "—"} → ${args.after.capacity ?? "—"}`,
    });
  }
  if (changed("price_cents")) {
    const fmt = (c: unknown) =>
      typeof c === "number" ? `$${(c / 100).toFixed(2)}` : "—";
    await logClassAudit(supabase, {
      ...base,
      changeType: "template_price_changed",
      before: { price_cents: args.before.price_cents },
      after: { price_cents: args.after.price_cents },
      summary: `Price ${fmt(args.before.price_cents)} → ${fmt(args.after.price_cents)}`,
    });
  }
  if (changed("instructor_id")) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "template_instructor_changed",
      before: { instructor_id: args.before.instructor_id },
      after: { instructor_id: args.after.instructor_id },
      summary: "Default instructor changed",
    });
  }

  // Catch-all for anything else (name, description, public flag, etc.)
  // so the timeline reflects every save without listing micro-fields.
  const otherChangedKeys = Object.keys(args.after).filter(
    (k) =>
      !["duration_minutes", "capacity", "price_cents", "instructor_id"].includes(k) &&
      args.after[k] !== args.before[k]
  );
  if (otherChangedKeys.length > 0) {
    await logClassAudit(supabase, {
      ...base,
      changeType: "template_updated",
      before: pickKeys(args.before, otherChangedKeys),
      after: pickKeys(args.after, otherChangedKeys),
      summary: `Updated ${otherChangedKeys.join(", ")}`,
    });
  }
}

function pickKeys(
  src: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = src[k];
  return out;
}

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
      special_instructions,
      cancellation_policy,
      pricing_mode,
      price_min_cents,
      required_waiver_template_ids,
      confirmation_subject_override,
      confirmation_body_override,
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

      // Verify template belongs to this studio. Pull the audit-relevant
      // columns at the same time so we can diff after the update.
      const { data: existing } = await dashCtx.supabase
        .from("class_templates")
        .select(
          "id, name, duration_minutes, capacity, price_cents, instructor_id, room_id, class_type"
        )
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
      if (special_instructions !== undefined) {
        updates.special_instructions =
          typeof special_instructions === "string" && special_instructions.trim().length > 0
            ? special_instructions.trim()
            : null;
      }
      if (cancellation_policy !== undefined) {
        updates.cancellation_policy =
          typeof cancellation_policy === "string" && cancellation_policy.trim().length > 0
            ? cancellation_policy.trim()
            : null;
      }
      if (pricing_mode !== undefined) {
        updates.pricing_mode =
          pricing_mode === "sliding_scale" ? "sliding_scale" : "fixed";
        // Always pair with the matching price_min_cents — wiping the bound
        // when switching back to "fixed" keeps the check constraint happy.
        if (pricing_mode !== "sliding_scale") {
          updates.price_min_cents = null;
        }
      }
      if (price_min_cents !== undefined && updates.pricing_mode !== "fixed") {
        updates.price_min_cents =
          typeof price_min_cents === "number" && price_min_cents >= 0
            ? price_min_cents
            : null;
      }
      if (required_waiver_template_ids !== undefined) {
        updates.required_waiver_template_ids = Array.isArray(
          required_waiver_template_ids
        )
          ? required_waiver_template_ids
          : [];
      }
      if (confirmation_subject_override !== undefined) {
        updates.confirmation_subject_override =
          typeof confirmation_subject_override === "string" &&
          confirmation_subject_override.trim()
            ? confirmation_subject_override.trim()
            : null;
      }
      if (confirmation_body_override !== undefined) {
        updates.confirmation_body_override =
          typeof confirmation_body_override === "string" &&
          confirmation_body_override.trim()
            ? confirmation_body_override.trim()
            : null;
      }

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

      // Audit log per material change. Description / location / online_link
      // / public-flag / special_instructions are not audited individually
      // — they don't affect contracted hours, and a generic
      // "template_updated" entry covers them.
      await logTemplateAudits(dashCtx.supabase, {
        studioId: dashCtx.studioId,
        templateId: id,
        actorProfileId: dashCtx.userId,
        actorRole: dashCtx.role,
        before: existing as Record<string, unknown>,
        after: updates,
      });

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
