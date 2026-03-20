import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns sessions with class info and confirmed booking counts
 * for the owner/manager dashboard calendar view.
 */
export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end query params required" },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    // Get profile with role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ sessions: [], confirmedCounts: {} });
    }

    // Only owners and managers can access this endpoint
    if (profile.role !== "owner" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studioId = profile.studio_id;

    // Fetch sessions with expanded class + instructor info (no is_public filter for dashboard)
    type SessionRow = {
      id: string;
      class_id: string;
      session_date: string;
      start_time: string;
      capacity: number;
      is_cancelled: boolean;
      is_online?: boolean;
      online_link?: string | null;
      classes?: {
        name?: string;
        duration_minutes?: number;
        location?: string;
        is_public?: boolean;
        price_cents?: number | null;
        room_id?: string | null;
        is_online?: boolean;
        online_link?: string | null;
        rooms?: { name?: string } | null;
        instructors?: {
          profiles?: { full_name?: string };
        };
      };
    };

    const { data: sessions } = await supabase
      .from("class_sessions")
      .select(
        `
        id, class_id, session_date, start_time, capacity, is_cancelled, is_online, online_link,
        classes (
          name, duration_minutes, location, is_public, price_cents, room_id, is_online, online_link,
          rooms (name),
          instructors (
            profiles (full_name)
          )
        )
      `,
      )
      .eq("studio_id", studioId)
      .gte("session_date", start)
      .lte("session_date", end)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    const typedSessions = (sessions ?? []) as SessionRow[];
    const sessionIds = typedSessions.map((s) => s.id);

    // Fetch confirmed counts
    let confirmedMap: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: confirmed } = await supabase
        .from("bookings")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("status", "confirmed");

      if (confirmed) {
        confirmedMap = (confirmed as { session_id: string }[]).reduce(
          (acc: Record<string, number>, b) => {
            acc[b.session_id] = (acc[b.session_id] || 0) + 1;
            return acc;
          },
          {},
        );
      }
    }

    // Format sessions (include class_id for navigation)
    const formattedSessions = typedSessions.map((s) => ({
      id: s.id,
      class_id: s.class_id,
      session_date: s.session_date,
      start_time: s.start_time,
      capacity: s.capacity,
      is_cancelled: s.is_cancelled,
      class_name: s.classes?.name ?? "Class",
      duration_minutes: s.classes?.duration_minutes ?? 60,
      instructor_name: s.classes?.instructors?.profiles?.full_name ?? "",
      location: s.classes?.location ?? null,
      is_public: s.classes?.is_public ?? true,
      room_name: s.classes?.rooms?.name ?? null,
      is_online: s.is_online ?? s.classes?.is_online ?? false,
    }));

    return NextResponse.json({
      sessions: formattedSessions,
      confirmedCounts: confirmedMap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
