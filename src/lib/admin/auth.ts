import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

const ADMIN_EMAILS_KEY = "ADMIN_EMAILS";

/**
 * 環境変数 ADMIN_EMAILS（カンマ区切り）から管理者メールリストを取得。
 *
 * 例: ADMIN_EMAILS="admin1@example.com, admin2@example.com, backup@example.com"
 *
 * ⚠ 単一メールのみの場合は単一障害点となるため、
 *   最低2つ以上の管理者メールを設定することを推奨。
 */
function getAdminEmails(): string[] {
  const raw = process.env[ADMIN_EMAILS_KEY];
  if (!raw || typeof raw !== "string") {
    console.warn(
      "[Admin] ADMIN_EMAILS environment variable is not set. No admin access will be granted."
    );
    return [];
  }

  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.warn("[Admin] ADMIN_EMAILS is set but contains no valid emails.");
  } else if (emails.length === 1) {
    console.warn(
      "[Admin] Only one admin email configured. Consider adding a backup admin for redundancy."
    );
  }

  return emails;
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

/**
 * 現在のログインユーザーのメールアドレスを返す。
 * requireAdmin() の後に呼ぶことで、管理者のメールを監査ログ等に使える。
 */
export async function getAdminEmail(): Promise<string | null> {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  return user?.email ?? null;
}
