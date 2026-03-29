import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { NextResponse } from "next/server";

/**
 * GET /api/appointments/types
 * List all appointment types for the authenticated user's studio.
 * Access: Owner, Manager
 */
export async function GET() {
  try {
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      .select(
        "id, studio_id, name, description, duration_minutes, price_cents, buffer_minutes, is_active, sort_order, created_at"
      )
      .eq("studio_id", ctx.studioId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments/types
 * Create a new appointment type.
 * Access: Owner, Manager (with can_manage_bookings)
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { name, description, duration_minutes, price_cents, buffer_minutes } =
      body;

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
        { error: "duration_minutes must be a positive number" },
        { status: 400 }
      );
    }

    // Get next sort_order
    const { data: lastType } = await ctx.supabase
      .from("appointment_types")
      .select("sort_order")
      .eq("studio_id", ctx.studioId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (lastType?.sort_order ?? 0) + 1;

    const { data, error } = await ctx.supabase
      .from("appointment_types")
      .insert({
        studio_id: ctx.studioId,
        name: name.trim(),
        description: description?.trim() || null,
        duration_minutes,
        price_cents: price_cents ?? 0,
        buffer_minutes: buffer_minutes ?? 0,
        is_active: true,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
