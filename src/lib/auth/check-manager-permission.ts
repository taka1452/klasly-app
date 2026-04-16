import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type ManagerPermissions = {
  can_manage_members: boolean;
  can_manage_classes: boolean;
  can_manage_instructors: boolean;
  can_manage_bookings: boolean;
  can_manage_rooms: boolean;
  can_view_payments: boolean;
  can_send_messages: boolean;
  can_teach: boolean;
  can_manage_settings: boolean;
};

type PermissionCheckResult = {
  allowed: boolean;
  role: string;
  permissions: ManagerPermissions | null;
};

/**
 * ダッシュボードページでマネージャーの特定権限を検証する。
 * owner は常に許可。manager は指定された権限キーがtrue であれば許可。
 * - permissionKey が undefined の場合は role チェックのみ
 */
export async function checkManagerPermission(
  permissionKey?: keyof ManagerPermissions
): Promise<PermissionCheckResult> {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return { allowed: false, role: "", permissions: null };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) return { allowed: false, role: "", permissions: null };

  // owner は常に許可
  if (profile.role === "owner") {
    return { allowed: true, role: "owner", permissions: null };
  }

  // manager の場合、managers テーブルで権限を確認
  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select(
        "can_manage_members, can_manage_classes, can_manage_instructors, can_manage_bookings, can_manage_rooms, can_view_payments, can_send_messages, can_teach, can_manage_settings"
      )
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!manager) return { allowed: false, role: "manager", permissions: null };

    const permissions = manager as ManagerPermissions;

    // 特定権限のチェック
    if (permissionKey && !permissions[permissionKey]) {
      return { allowed: false, role: "manager", permissions };
    }

    return { allowed: true, role: "manager", permissions };
  }

  return { allowed: false, role: profile.role, permissions: null };
}

/**
 * マネージャーの全権限を取得するユーティリティ（Layout → Sidebar 用）
 */
export async function getManagerPermissions(
  userId: string,
  studioId: string
): Promise<ManagerPermissions | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: manager } = await supabase
    .from("managers")
    .select(
      "can_manage_members, can_manage_classes, can_manage_instructors, can_manage_bookings, can_manage_rooms, can_view_payments, can_send_messages, can_teach, can_manage_settings"
    )
    .eq("profile_id", userId)
    .eq("studio_id", studioId)
    .single();

  return (manager as ManagerPermissions) ?? null;
}
