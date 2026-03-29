import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/appointments/types/[id]
 * Update an appointment type.
 * Access: Owner, Manager (with can_manage_bookings)
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      ctx.role === "manager" &&
      !ctx.permissions?.can_manage_bookings
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(
      ctx.studioId,
      FEATURE_KEYS.APPOINTMENTS
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Appointments feature is not enabled" },
        { status: 403 }
      );
    }

    // Verify the type belongs to this studio
    const { data: existing } = await ctx.supabase
      .from("appointment_types")
      .select("id")
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Appointment type not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      duration_minutes,
      price_cents,
      buffer_minutes,
      is_active,
      sort_order,
    } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "name must be a non-empty string" },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }
    if (description !== undefined)
      updates.description = description?.trim() || null;
    if (duration_minutes !== undefined) {
      if (typeof duration_minutes !== "number" || duration_minutes <= 0) {
        return NextResponse.json(
          { error: "duration_minutes must be a positive number" },
          { status: 400 }
        );
      }
      updates.duration_minutes = duration_minutes;
    }
    if (price_cents !== undefined) updates.price_cents = price_cents;
    if (buffer_minutes !== undefined) updates.buffer_minutes = buffer_minutes;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.supabase
      .from("appointment_types")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .select()
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
 * DELETE /api/appointments/types/[id]
 * Soft-delete an appointment type (set is_active = false).
 * Access: Owner, Manager (with can_manage_bookings)
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      ctx.role === "manager" &&
      !ctx.permissions?.can_manage_bookings
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(
      ctx.studioId,
      FEATURE_KEYS.APPOINTMENTS
    );
    if (!enabled) {
      return NextResponse.json(
        { error: "Appointments feature is not enabled" },
        { status: 403 }
      );
    }

    const { data, error } = await ctx.supabase
      .from("appointment_types")
      .update({ is_active: false })
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Appointment type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
