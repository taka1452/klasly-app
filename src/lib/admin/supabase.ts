import { createClient } from "@supabase/supabase-js";

/**
 * Admin API 用の Supabase クライアント（service role key）。
 * RLS をバイパスして全データにアクセスするため、Admin 系 API ルートでのみ使用する。
 * フロントエンドでは絶対に使わない。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin operations."
    );
  }

  return createClient(url, serviceRoleKey);
}
