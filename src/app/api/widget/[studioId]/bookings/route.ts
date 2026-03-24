import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/supabase";
import { executeBookingAction } from "@/lib/booking/actions";
import {
  getWidgetCorsHeaders,
  corsPreflightResponse,
} from "@/lib/widget/cors";
import { NextResponse } from "next/server";

/**
 * POST /api/widget/[studioId]/bookings
 * Bearer token 認証: ウィジェットからの予約/キャンセル/waitlist アクション。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);

  try {
    // Extract and validate Bearer token
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

    if (!token || token.length === 0) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify user via token
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { action, sessionId, memberId } = body;

    const adminSupabase = createAdminClient();

    // Verify member belongs to this studio
    const { data: member } = await adminSupabase
      .from("members")
      .select("studio_id")
      .eq("id", memberId)
      .single();

    if (!member || member.studio_id !== studioId) {
      return NextResponse.json(
        { error: "Member does not belong to this studio" },
        { status: 403, headers: corsHeaders }
      );
    }

    const result = await executeBookingAction({
      adminSupabase,
      userId: user.id,
      action,
      sessionId,
      memberId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 400, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[widget/bookings] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);
  return corsPreflightResponse(corsHeaders);
}
