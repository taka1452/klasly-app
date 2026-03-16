import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns sessions, member bookings, and confirmed counts for a date range.
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

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ sessions: [], bookings: {}, confirmedCounts: {} });
    }

    const studioId = profile.studio_id;

    // Get member
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("studio_id", studioId)
      .eq("profile_id", user.id)
      .single();

    const memberId = member?.id ?? null;

    // Fetch sessions with expanded class + instructor info
    type SessionRow = {
      id: string;
      session_date: string;
      start_time: string;
      capacity: number;
      is_cancelled: boolean;
      classes?: {
        name?: string;
        duration_minutes?: number;
        location?: string;
        is_public?: boolean;
        price_cents?: number | null;
        room_id?: string | null;
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
        id, session_date, start_time, capacity, is_cancelled,
        classes (
          name, duration_minutes, location, is_public, price_cents, room_id,
          rooms (name),
          instructors (
            profiles (full_name)
          )
        )
      `,
      )
      .eq("studio_id", studioId)
      .eq("is_cancelled", false)
      .gte("session_date", start)
      .lte("session_date", end)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    // Filter out non-public classes (private sessions should not appear on member schedule)
    const typedSessions = ((sessions ?? []) as SessionRow[]).filter(
      (s) => s.classes?.is_public !== false
    );
    const sessionIds = typedSessions.map((s) => s.id);

    // Fetch member bookings
    let bookingsMap: Record<string, { id: string; status: string }> = {};
    if (sessionIds.length > 0 && memberId) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("session_id, status, id")
        .eq("member_id", memberId)
        .in("session_id", sessionIds);

      if (bookings) {
        bookingsMap = (bookings as { session_id: string; id: string; status: string }[]).reduce(
          (acc: Record<string, { id: string; status: string }>, b) => {
            acc[b.session_id] = { id: b.id, status: b.status };
            return acc;
          },
          {},
        );
      }
    }

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

    // Format sessions
    const formattedSessions = typedSessions.map((s) => ({
      id: s.id,
      session_date: s.session_date,
      start_time: s.start_time,
      capacity: s.capacity,
      is_cancelled: s.is_cancelled,
      class_name: s.classes?.name ?? "Class",
      duration_minutes: s.classes?.duration_minutes ?? 60,
      instructor_name: s.classes?.instructors?.profiles?.full_name ?? "",
      location: s.classes?.location ?? null,
      price_cents: s.classes?.price_cents ?? null,
      room_name: s.classes?.rooms?.name ?? null,
    }));

    return NextResponse.json({
      sessions: formattedSessions,
      bookings: bookingsMap,
      confirmedCounts: confirmedMap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
