import { createAdminClient } from "@/lib/admin/supabase";
import {
  getWidgetCorsHeaders,
  corsPreflightResponse,
} from "@/lib/widget/cors";
import { NextResponse } from "next/server";

/**
 * GET /api/widget/[studioId]/schedule
 * 公開API: 認証不要でスケジュール + 空き状況を返す。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;
  const origin = request.headers.get("origin");
  const corsHeaders = await getWidgetCorsHeaders(studioId, origin);

  try {
    const supabase = createAdminClient();

    // Validate studio exists
    const { data: studio } = await supabase
      .from("studios")
      .select("id, name")
      .eq("id", studioId)
      .single();

    if (!studio) {
      return NextResponse.json(
        { error: "Studio not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get week range from query param (default: current week)
    const url = new URL(request.url);
    const weekOffset = parseInt(url.searchParams.get("week") || "0", 10);

    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0=Sun
    const startOfWeek = new Date(now);
    startOfWeek.setDate(
      now.getDate() - currentDayOfWeek + weekOffset * 7
    );
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startDate = startOfWeek.toISOString().split("T")[0];
    const endDate = endOfWeek.toISOString().split("T")[0];

    // Fetch sessions for the week with class + instructor info
    const { data: sessions, error: sessionsError } = await supabase
      .from("class_sessions")
      .select(
        `
        id,
        session_date,
        start_time,
        capacity,
        is_cancelled,
        classes (
          id,
          name,
          description,
          duration_minutes,
          location,
          instructor_id,
          instructors (
            id,
            profiles (full_name)
          )
        )
      `
      )
      .eq("studio_id", studioId)
      .eq("is_cancelled", false)
      .eq("is_public", true)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (sessionsError) {
      console.error("[widget/schedule] sessions query error:", sessionsError);
      return NextResponse.json(
        { error: "Failed to fetch schedule" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Get availability counts via DB function
    const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
    let availabilityMap: Record<string, number> = {};

    if (sessionIds.length > 0) {
      const { data: availability } = await supabase.rpc(
        "get_session_availability",
        {
          p_studio_id: studioId,
          p_session_ids: sessionIds,
        }
      );

      if (availability) {
        availabilityMap = (
          availability as { session_id: string; confirmed_count: number }[]
        ).reduce(
          (acc, row) => {
            acc[row.session_id] = Number(row.confirmed_count);
            return acc;
          },
          {} as Record<string, number>
        );
      }
    }

    // Transform response
    type SessionRow = {
      id: string;
      session_date: string;
      start_time: string;
      capacity: number;
      is_cancelled: boolean;
      classes?: {
        id?: string;
        name?: string;
        description?: string;
        duration_minutes?: number;
        location?: string;
        instructor_id?: string;
        instructors?: {
          id?: string;
          profiles?: { full_name?: string };
        };
      };
    };

    const formattedSessions = (sessions as SessionRow[] || []).map((s) => ({
      id: s.id,
      date: s.session_date,
      startTime: s.start_time,
      className: s.classes?.name ?? "Class",
      description: s.classes?.description ?? "",
      instructorName:
        s.classes?.instructors?.profiles?.full_name ?? "",
      durationMinutes: s.classes?.duration_minutes ?? 60,
      capacity: s.capacity,
      confirmedCount: availabilityMap[s.id] ?? 0,
      location: s.classes?.location ?? null,
    }));

    return NextResponse.json(
      {
        studio: { name: studio.name },
        weekStart: startDate,
        weekEnd: endDate,
        sessions: formattedSessions,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("[widget/schedule] error:", err);
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
