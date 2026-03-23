import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 型付き Admin Supabase クライアント。
 * service role key を使って RLS をバイパスする。
 * Cron ジョブや Webhook ルートなど、サーバーサイドでのみ使用。
 */
export type AdminSupabaseClient = SupabaseClient;

export function createTypedAdminClient(): AdminSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
    );
  }

  return createClient(url, serviceRoleKey);
}
