import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

const ADMIN_EMAILS_KEY = "ADMIN_EMAILS";

/**
 * 環境変数 ADMIN_EMAILS（カンマ区切り）から管理者メールリストを取得
 */
function getAdminEmails(): string[] {
  const raw = process.env[ADMIN_EMAILS_KEY];
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * ログイン中ユーザーのメールが管理者リストに含まれるかチェック
 */
export async function isAdmin(): Promise<boolean> {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user?.email) return false;

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return false;

  const email = user.email.trim().toLowerCase();
  return adminEmails.includes(email);
}

/**
 * 管理者でない場合は 404 を返す（管理画面の存在を隠す）
 */
export async function requireAdmin(): Promise<void> {
  const ok = await isAdmin();
  if (!ok) {
    notFound();
  }
}
