import { createAdminClient } from "@/lib/admin/supabase";

/**
 * Widget API 用の CORS ヘッダーを生成する。
 * widget_settings.allowed_origins に登録されたオリジンのみ許可。
 * allowed_origins が空の場合は全オリジンを許可（開発用）。
 */
export async function getWidgetCorsHeaders(
  studioId: string,
  origin: string | null
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };

  try {
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from("widget_settings")
      .select("allowed_origins")
      .eq("studio_id", studioId)
      .maybeSingle();

    const allowedOrigins: string[] = settings?.allowed_origins ?? [];

    if (allowedOrigins.length === 0) {
      // No origins configured: allow all (for development / initial setup)
      headers["Access-Control-Allow-Origin"] = "*";
    } else if (origin && allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    } else {
      // Origin not allowed — still return headers but without Allow-Origin
      // The browser will block the request
    }
  } catch {
    // If widget_settings doesn't exist yet, allow all origins
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

/**
 * OPTIONS プリフライトリクエスト用レスポンスを返す。
 */
export function corsPreflightResponse(
  corsHeaders: Record<string, string>
): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
