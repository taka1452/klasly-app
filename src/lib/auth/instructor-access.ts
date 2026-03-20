import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type InstructorContext = {
  supabase: SupabaseClient;
  userId: string;
  studioId: string;
  instructorId: string;
  /** 元のプロフィールロール（owner/manager がインストラクターとしてアクセスする場合） */
  role: "owner" | "instructor" | "manager";
};

/**
 * インストラクターとしてAPIにアクセスできるか検証。
 * instructor ロールはもちろん、owner でも instructors テーブルにレコードがあれば許可。
 * 認証失敗時は null を返す。
 */
export async function getInstructorContext(): Promise<InstructorContext | null> {
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

  // instructor, owner, manager のみ許可
  if (profile.role !== "instructor" && profile.role !== "owner" && profile.role !== "manager") return null;

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  // instructors テーブルにレコードがなければ拒否
  if (!instructor) return null;

  return {
    supabase,
    userId: user.id,
    studioId: profile.studio_id,
    instructorId: instructor.id,
    role: profile.role as "owner" | "instructor" | "manager",
  };
}
