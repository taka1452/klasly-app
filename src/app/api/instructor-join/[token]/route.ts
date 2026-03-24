import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/instructor-join/[token]
 * トークン検証 — 招待リンクの有効性を確認
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: invite } = await adminSupabase
      .from("instructor_invite_tokens")
      .select("*, studios(name)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invite link has expired" },
        { status: 410 }
      );
    }

    // Check max uses
    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return NextResponse.json(
        { error: "This invite link has reached its maximum uses" },
        { status: 410 }
      );
    }

    const studioName = Array.isArray(invite.studios)
      ? (invite.studios[0] as { name?: string })?.name
      : (invite.studios as { name?: string })?.name;

    return NextResponse.json({
      valid: true,
      studioName: studioName ?? "Unknown Studio",
      studioId: invite.studio_id,
      inviteRole: invite.invite_role ?? "instructor",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/instructor-join/[token]
 * トークンを使ってスタジオにインストラクターとして参加
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Validate token
    const { data: invite } = await adminSupabase
      .from("instructor_invite_tokens")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invite link has expired" },
        { status: 410 }
      );
    }

    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return NextResponse.json(
        { error: "This invite link has reached its maximum uses" },
        { status: 410 }
      );
    }

    // Check if user already has a profile in this studio
    const { data: existingProfile } = await adminSupabase
      .from("profiles")
      .select("id, studio_id, role")
      .eq("id", user.id)
      .single();

    if (existingProfile?.studio_id === invite.studio_id) {
      return NextResponse.json(
        { error: "You are already a member of this studio" },
        { status: 409 }
      );
    }

    // Determine role from invite
    const joinRole = invite.invite_role === "manager" ? "manager" : "instructor";

    // Update profile
    await adminSupabase
      .from("profiles")
      .update({
        studio_id: invite.studio_id,
        role: joinRole,
      })
      .eq("id", user.id);

    if (joinRole === "instructor") {
      // Create instructor record
      const { data: existingInstructor } = await adminSupabase
        .from("instructors")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", invite.studio_id)
        .maybeSingle();

      if (!existingInstructor) {
        await adminSupabase.from("instructors").insert({
          studio_id: invite.studio_id,
          profile_id: user.id,
        });
      }
    } else if (joinRole === "manager") {
      // Create manager record with default permissions
      const { data: existingManager } = await adminSupabase
        .from("managers")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", invite.studio_id)
        .maybeSingle();

      if (!existingManager) {
        await adminSupabase.from("managers").insert({
          studio_id: invite.studio_id,
          profile_id: user.id,
          can_manage_members: true,
          can_manage_classes: true,
          can_manage_instructors: false,
          can_manage_bookings: true,
          can_manage_rooms: false,
          can_view_payments: false,
          can_send_messages: true,
        });
      }
    }

    // Atomically increment use_count with optimistic locking to prevent race conditions.
    // Only update if use_count hasn't changed since we read it.
    const { data: updatedToken, error: incrementError } = await adminSupabase
      .from("instructor_invite_tokens")
      .update({ use_count: invite.use_count + 1 })
      .eq("id", invite.id)
      .eq("use_count", invite.use_count) // optimistic lock: only update if unchanged
      .select("id")
      .maybeSingle();

    if (incrementError || !updatedToken) {
      return NextResponse.json(
        { error: "This invite link was used by someone else. Please try again." },
        { status: 409 }
      );
    }

    const roleLabel = joinRole === "manager" ? "a manager" : "an instructor";
    return NextResponse.json({
      success: true,
      message: `You have joined as ${roleLabel}!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
