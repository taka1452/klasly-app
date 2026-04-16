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

// GET: スタジオのマネージャー一覧
export async function GET() {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await ctx.supabase
      .from("managers")
      .select("*, profiles(full_name, email)")
      .eq("studio_id", ctx.studioId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const managers = (data || []).map((m) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        id: m.id,
        profileId: m.profile_id,
        fullName: (prof as { full_name?: string })?.full_name || "",
        email: (prof as { email?: string })?.email || "",
        canManageMembers: m.can_manage_members,
        canManageClasses: m.can_manage_classes,
        canManageInstructors: m.can_manage_instructors,
        canManageBookings: m.can_manage_bookings,
        canManageRooms: m.can_manage_rooms,
        canViewPayments: m.can_view_payments,
        canSendMessages: m.can_send_messages,
        canManageSettings: m.can_manage_settings ?? false,
        canTeach: m.can_teach ?? false,
        createdAt: m.created_at,
      };
    });

    return NextResponse.json(managers);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: マネージャーを招待（既存ユーザーのロール変更 or 新規招待）
export async function POST(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { permissions } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // メールでプロフィール検索
    const { data: existingProfile } = await ctx.supabase
      .from("profiles")
      .select("id, role, studio_id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      // 既にこのスタジオのオーナーや別ロールならエラー
      if (existingProfile.studio_id === ctx.studioId && existingProfile.role === "owner") {
        return NextResponse.json({ error: "Cannot change owner to manager" }, { status: 400 });
      }
      if (existingProfile.studio_id && existingProfile.studio_id !== ctx.studioId) {
        return NextResponse.json({ error: "User belongs to another studio" }, { status: 400 });
      }

      // プロフィールをマネージャーに更新
      await ctx.supabase
        .from("profiles")
        .update({ role: "manager", studio_id: ctx.studioId })
        .eq("id", existingProfile.id);

      // managers レコード作成（upsert）
      const { data: manager, error: insertError } = await ctx.supabase
        .from("managers")
        .upsert(
          {
            studio_id: ctx.studioId,
            profile_id: existingProfile.id,
            can_manage_members: permissions?.canManageMembers ?? true,
            can_manage_classes: permissions?.canManageClasses ?? true,
            can_manage_instructors: permissions?.canManageInstructors ?? false,
            can_manage_bookings: permissions?.canManageBookings ?? true,
            can_manage_rooms: permissions?.canManageRooms ?? true,
            can_view_payments: permissions?.canViewPayments ?? true,
            can_send_messages: permissions?.canSendMessages ?? true,
            can_manage_settings: permissions?.canManageSettings ?? false,
            can_teach: permissions?.canTeach ?? false,
          },
          { onConflict: "studio_id,profile_id" }
        )
        .select("*")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json(manager, { status: 201 });
    }

    // 既存ユーザーが見つからない場合 → Supabase Auth で招待
    const { data: authData, error: authError } = await ctx.supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "manager",
        studio_id: ctx.studioId,
        invited_without_password: true,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    if (authData?.user) {
      // プロフィール作成
      await ctx.supabase.from("profiles").upsert({
        id: authData.user.id,
        email,
        role: "manager",
        studio_id: ctx.studioId,
        onboarding_completed: true,
        onboarding_step: 0,
      });

      // managers レコード作成
      await ctx.supabase.from("managers").insert({
        studio_id: ctx.studioId,
        profile_id: authData.user.id,
        can_manage_members: permissions?.canManageMembers ?? true,
        can_manage_classes: permissions?.canManageClasses ?? true,
        can_manage_instructors: permissions?.canManageInstructors ?? false,
        can_manage_bookings: permissions?.canManageBookings ?? true,
        can_manage_rooms: permissions?.canManageRooms ?? true,
        can_view_payments: permissions?.canViewPayments ?? true,
        can_send_messages: permissions?.canSendMessages ?? true,
        can_manage_settings: permissions?.canManageSettings ?? false,
        can_teach: permissions?.canTeach ?? false,
      });
    }

    return NextResponse.json({ success: true, invited: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: マネージャーの権限更新
export async function PATCH(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ...permissions } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updateData: Record<string, boolean> = {};
    if (permissions.canManageMembers !== undefined) updateData.can_manage_members = permissions.canManageMembers;
    if (permissions.canManageClasses !== undefined) updateData.can_manage_classes = permissions.canManageClasses;
    if (permissions.canManageInstructors !== undefined) updateData.can_manage_instructors = permissions.canManageInstructors;
    if (permissions.canManageBookings !== undefined) updateData.can_manage_bookings = permissions.canManageBookings;
    if (permissions.canManageRooms !== undefined) updateData.can_manage_rooms = permissions.canManageRooms;
    if (permissions.canViewPayments !== undefined) updateData.can_view_payments = permissions.canViewPayments;
    if (permissions.canSendMessages !== undefined) updateData.can_send_messages = permissions.canSendMessages;
    if (permissions.canManageSettings !== undefined) updateData.can_manage_settings = permissions.canManageSettings;
    if (permissions.canTeach !== undefined) updateData.can_teach = permissions.canTeach;

    const { data, error } = await ctx.supabase
      .from("managers")
      .update(updateData)
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: マネージャーを解除
export async function DELETE(request: Request) {
  try {
    const ctx = await getOwnerContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // managers レコードからプロフィールIDを取得
    const { data: manager } = await ctx.supabase
      .from("managers")
      .select("profile_id")
      .eq("id", id)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

    // managers レコード削除
    await ctx.supabase
      .from("managers")
      .delete()
      .eq("id", id)
      .eq("studio_id", ctx.studioId);

    // インストラクターレコードが残っている場合もクリーンアップ
    // （can_teach でインストラクター兼任していた場合の孤立防止）
    const { data: instructorRecord } = await ctx.supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", manager.profile_id)
      .eq("studio_id", ctx.studioId)
      .maybeSingle();

    if (instructorRecord) {
      // アクティブなクラスがある場合はインストラクターレコードを残す（ロールを instructor に）
      const { count: activeClasses } = await ctx.supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", instructorRecord.id)
        .eq("is_active", true);

      if (activeClasses && activeClasses > 0) {
        // アクティブなクラスがあるためインストラクターとして保持
        await ctx.supabase
          .from("profiles")
          .update({ role: "instructor" })
          .eq("id", manager.profile_id);

        return NextResponse.json({ success: true, note: "Demoted to instructor (has active classes)" });
      }

      // アクティブなクラスがないのでインストラクターレコードも削除
      await ctx.supabase
        .from("instructors")
        .delete()
        .eq("id", instructorRecord.id);
    }

    // プロフィールのロールをリセット（studio_id は保持、ロールを member に）
    await ctx.supabase
      .from("profiles")
      .update({ role: "member" })
      .eq("id", manager.profile_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
