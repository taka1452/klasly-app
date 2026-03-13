import { createClient } from "@supabase/supabase-js";

/**
 * Widget (iframe) 用の Supabase クライアント。
 * 3rd party cookie がブロックされるため、@supabase/ssr (cookie) ではなく
 * @supabase/supabase-js + localStorage でセッションを管理する。
 */
export function createWidgetClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      storageKey: "klasly-widget-auth",
      storage:
        typeof window !== "undefined" ? window.localStorage : undefined,
      flowType: "pkce",
    },
  });
}
