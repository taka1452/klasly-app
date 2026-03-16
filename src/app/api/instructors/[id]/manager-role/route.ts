import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getOwnerContext() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "owner") return null;

  return { supabase, studioId: profile.studio_id };
}

// GET: Check if instructor has manager role
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!instructor) return NextResponse.json({ error: "Instructor not found" }, { status: 404 });

    const { data: manager } = await ctx.supabase
      .from("managers")
      .select("*")
      .eq("studio_id", ctx.studioId)
      .eq("profile_id", instructor.profile_id)
      .maybeSingle();

    return NextResponse.json({
      isManager: !!manager,
      manager: manager
        ? {
            id: manager.id,
            canManageMembers: manager.can_manage_members,
            canManageClasses: manager.can_manage_classes,
            canManageInstructors: manager.can_manage_instructors,
            canManageBookings: manager.can_manage_bookings,
            canManageRooms: manager.can_manage_rooms,
            canViewPayments: manager.can_view_payments,
            canSendMessages: manager.can_send_messages,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Grant manager role to instructor
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const permissions = body.permissions || {};

    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!instructor) return NextResponse.json({ error: "Instructor not found" }, { status: 404 });

    // Update profile role to manager
    await ctx.supabase
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", instructor.profile_id);

    // Create managers record (upsert)
    const { data: manager, error } = await ctx.supabase
      .from("managers")
      .upsert(
        {
          studio_id: ctx.studioId,
          profile_id: instructor.profile_id,
          can_manage_members: permissions.canManageMembers ?? true,
          can_manage_classes: permissions.canManageClasses ?? true,
          can_manage_instructors: permissions.canManageInstructors ?? false,
          can_manage_bookings: permissions.canManageBookings ?? true,
          can_manage_rooms: permissions.canManageRooms ?? false,
          can_view_payments: permissions.canViewPayments ?? false,
          can_send_messages: permissions.canSendMessages ?? true,
        },
        { onConflict: "studio_id,profile_id" }
      )
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      isManager: true,
      manager: {
        id: manager.id,
        canManageMembers: manager.can_manage_members,
        canManageClasses: manager.can_manage_classes,
        canManageInstructors: manager.can_manage_instructors,
        canManageBookings: manager.can_manage_bookings,
        canManageRooms: manager.can_manage_rooms,
        canViewPayments: manager.can_view_payments,
        canSendMessages: manager.can_send_messages,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Revoke manager role from instructor
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!instructor) return NextResponse.json({ error: "Instructor not found" }, { status: 404 });

    // Delete managers record
    await ctx.supabase
      .from("managers")
      .delete()
      .eq("studio_id", ctx.studioId)
      .eq("profile_id", instructor.profile_id);

    // Revert profile role back to instructor
    await ctx.supabase
      .from("profiles")
      .update({ role: "instructor" })
      .eq("id", instructor.profile_id);

    return NextResponse.json({ isManager: false, manager: null });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update manager permissions for an instructor
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!instructor) return NextResponse.json({ error: "Instructor not found" }, { status: 404 });

    const updateData: Record<string, boolean> = {};
    if (body.canManageMembers !== undefined) updateData.can_manage_members = body.canManageMembers;
    if (body.canManageClasses !== undefined) updateData.can_manage_classes = body.canManageClasses;
    if (body.canManageInstructors !== undefined) updateData.can_manage_instructors = body.canManageInstructors;
    if (body.canManageBookings !== undefined) updateData.can_manage_bookings = body.canManageBookings;
    if (body.canManageRooms !== undefined) updateData.can_manage_rooms = body.canManageRooms;
    if (body.canViewPayments !== undefined) updateData.can_view_payments = body.canViewPayments;
    if (body.canSendMessages !== undefined) updateData.can_send_messages = body.canSendMessages;

    const { data: manager, error } = await ctx.supabase
      .from("managers")
      .update(updateData)
      .eq("studio_id", ctx.studioId)
      .eq("profile_id", instructor.profile_id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      isManager: true,
      manager: {
        id: manager.id,
        canManageMembers: manager.can_manage_members,
        canManageClasses: manager.can_manage_classes,
        canManageInstructors: manager.can_manage_instructors,
        canManageBookings: manager.can_manage_bookings,
        canManageRooms: manager.can_manage_rooms,
        canViewPayments: manager.can_view_payments,
        canSendMessages: manager.can_send_messages,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
