import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/supabase";
import {
  getWidgetCorsHeaders,
  corsPreflightResponse,
} from "@/lib/widget/cors";
import { NextResponse } from "next/server";

/**
 * GET /api/widget/[studioId]/member
 * Bearer token 認証: ログインユーザーの member 情報 + 予約一覧を返す。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);

  try {
    // Extract Bearer token
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
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

    const adminSupabase = createAdminClient();

    // Get member record for this studio
    const { data: member } = await adminSupabase
      .from("members")
      .select("id, credits, plan_type, status, waiver_signed")
      .eq("studio_id", studioId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { member: null, bookings: [] },
        { headers: corsHeaders }
      );
    }

    // Get upcoming bookings for this member
    const today = new Date().toISOString().split("T")[0];
    const { data: bookings } = await adminSupabase
      .from("bookings")
      .select("id, session_id, status, class_sessions(session_date)")
      .eq("member_id", member.id)
      .eq("studio_id", studioId)
      .neq("status", "cancelled");

    // Filter to upcoming sessions only
    type BookingRow = {
      id: string;
      session_id: string;
      status: string;
      class_sessions?: { session_date?: string };
    };

    const upcomingBookings = ((bookings as BookingRow[]) || [])
      .filter((b) => {
        const sessionDate = b.class_sessions?.session_date;
        return sessionDate && sessionDate >= today;
      })
      .map((b) => ({
        id: b.id,
        sessionId: b.session_id,
        status: b.status,
      }));

    return NextResponse.json(
      {
        member: {
          id: member.id,
          credits: member.credits,
          planType: member.plan_type,
          status: member.status,
          waiverSigned: member.waiver_signed,
        },
        bookings: upcomingBookings,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("[widget/member] error:", err);
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
