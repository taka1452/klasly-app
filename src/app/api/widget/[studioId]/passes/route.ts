import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { getWidgetCorsHeaders, corsPreflightResponse } from "@/lib/widget/cors";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export const runtime = "nodejs";

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);
  return corsPreflightResponse(corsHeaders);
}

/**
 * GET /api/widget/[studioId]/passes
 * 公開パス一覧を返す（購入ボタンウィジェット用）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);

  try {
    const supabase = createAdminClient();

    // フィーチャーフラグ確認
    const passEnabled = await isFeatureEnabled(studioId, FEATURE_KEYS.STUDIO_PASS);
    if (!passEnabled) {
      return NextResponse.json(
        { passes: [], studioName: "" },
        { headers: corsHeaders },
      );
    }

    // スタジオ名取得
    const { data: studio } = await supabase
      .from("studios")
      .select("name, currency")
      .eq("id", studioId)
      .single();

    // アクティブなパス一覧
    const { data: passes } = await supabase
      .from("studio_passes")
      .select("id, name, description, price_cents, max_classes_per_month, billing_interval")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .order("price_cents", { ascending: true });

    return NextResponse.json(
      {
        passes: passes || [],
        studioName: studio?.name || "",
        currency: studio?.currency || "usd",
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[Widget Passes API]", err);
    return NextResponse.json(
      { passes: [], studioName: "" },
      { status: 500, headers: corsHeaders },
    );
  }
}
