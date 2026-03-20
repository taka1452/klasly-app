import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Manager } from "@/types/database";

export type DashboardContext = {
  supabase: SupabaseClient;
  userId: string;
  studioId: string;
  role: "owner" | "manager";
  /** マネージャーの場合は権限情報。オーナーの場合は null（全権限あり） */
  permissions: Omit<Manager, "id" | "studio_id" | "profile_id" | "created_at"> | null;
};

/**
 * オーナーまたはマネージャーとしてダッシュボードAPIにアクセスできるか検証。
 * 認証失敗時は null を返す。
 */
export async function getDashboardContext(): Promise<DashboardContext | null> {
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

  if (!profile?.studio_id) return null;

  if (profile.role === "owner") {
    return {
      supabase,
      userId: user.id,
      studioId: profile.studio_id,
      role: "owner",
      permissions: null,
    };
  }

  if (profile.role === "manager") {
    const { data: manager } = await supabase
      .from("managers")
      .select(
        "can_manage_members, can_manage_classes, can_manage_instructors, can_manage_bookings, can_manage_rooms, can_view_payments, can_send_messages, can_teach"
      )
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!manager) return null;

    return {
      supabase,
      userId: user.id,
      studioId: profile.studio_id,
      role: "manager",
      permissions: manager as Omit<Manager, "id" | "studio_id" | "profile_id" | "created_at">,
    };
  }

  return null;
}

/**
 * オーナーのみ許可（Settings, Stripe設定など）
 */
export async function getOwnerOnlyContext() {
  const ctx = await getDashboardContext();
  if (!ctx || ctx.role !== "owner") return null;
  return ctx;
}
