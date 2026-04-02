import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns sessions (classes + room bookings) from the unified class_sessions table
 * with confirmed booking counts for the owner/manager dashboard calendar view.
 *
 * The class_sessions table now holds both class sessions (session_type='class')
 * and room-only bookings (session_type='room_only'). Template info comes from
 * class_templates; instructor/room are directly on class_sessions.
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
    const filterTemplateId = searchParams.get("template_id");

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

    // マネージャーの場合はクラス管理権限を検証
    if (profile.role === "manager") {
      const { data: mgr } = await supabase
        .from("managers")
        .select("can_manage_classes")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .single();
      if (!mgr?.can_manage_classes) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const studioId = profile.studio_id;

    // ── Fetch all sessions (classes + room bookings) from unified table ──
    type SessionRow = {
      id: string;
      template_id: string | null;
      room_id: string | null;
      instructor_id: string | null;
      session_date: string;
      start_time: string;
      end_time: string | null;
      duration_minutes: number | null;
      capacity: number;
      is_cancelled: boolean;
      is_online?: boolean;
      online_link?: string | null;
      title: string | null;
      session_type: string;
      price_cents: number | null;
      location: string | null;
      recurrence_group_id: string | null;
      class_templates?: {
        name?: string;
        duration_minutes?: number;
        location?: string;
        is_public?: boolean;
        price_cents?: number | null;
        online_link?: string | null;
        class_type?: string;
      } | null;
      rooms?: { name?: string } | null;
      instructors?: {
        profiles?: { full_name?: string };
      } | null;
    };

    let query = supabase
      .from("class_sessions")
      .select(
        `
        id, template_id, room_id, instructor_id,
        session_date, start_time, end_time, duration_minutes,
        capacity, is_cancelled, is_online, online_link,
        title, session_type, price_cents, location, recurrence_group_id,
        class_templates (
          name, duration_minutes, location, is_public, price_cents, online_link, class_type
        ),
        rooms (name),
        instructors (
          profiles (full_name)
        )
      `,
      )
      .eq("studio_id", studioId)
      .gte("session_date", start)
      .lte("session_date", end);

    // Optional: filter by template_id
    if (filterTemplateId) {
      query = query.eq("template_id", filterTemplateId);
    }

    const { data: sessions } = await query
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    const typedSessions = (sessions ?? []) as SessionRow[];

    // Only collect IDs of class-type sessions for confirmed counts (room_only has no bookings)
    const classSessionIds = typedSessions
      .filter((s) => s.session_type !== "room_only")
      .map((s) => s.id);

    // Fetch confirmed counts for class sessions
    let confirmedMap: Record<string, number> = {};
    if (classSessionIds.length > 0) {
      const { data: confirmed } = await supabase
        .from("bookings")
        .select("session_id")
        .in("session_id", classSessionIds)
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

    // Format all sessions with backward-compatible fields
    const formattedSessions = typedSessions.map((s) => {
      const isRoomOnly = s.session_type === "room_only";
      const template = s.class_templates;

      // Resolve instructor name
      const instr = s.instructors;
      const rawInstr = Array.isArray(instr) ? instr[0] : instr;
      const instructorName = rawInstr?.profiles?.full_name ?? "";

      // Resolve room name
      const room = s.rooms;
      const roomName = Array.isArray(room)
        ? room[0]?.name
        : room?.name || null;

      // Duration: prefer session-level, then template-level, then compute from end_time
      let durationMinutes = s.duration_minutes;
      if (!durationMinutes && template?.duration_minutes) {
        durationMinutes = template.duration_minutes;
      }
      if (!durationMinutes && s.end_time) {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        durationMinutes = eh * 60 + em - (sh * 60 + sm);
      }
      if (!durationMinutes || durationMinutes <= 0) {
        durationMinutes = 60;
      }

      // Determine is_public / is_online from template's class_type or direct fields
      const classType = template?.class_type;
      const isPublic = template?.is_public ?? true;
      const isOnline =
        s.is_online ?? classType === "online";

      return {
        id: s.id,
        class_id: s.template_id ?? s.id, // backward compat: template_id for classes, id for room_only
        session_date: s.session_date,
        start_time: s.start_time,
        capacity: s.capacity,
        is_cancelled: s.is_cancelled,
        class_name: isRoomOnly
          ? s.title || "Room Booking"
          : template?.name ?? s.title ?? "Class",
        duration_minutes: durationMinutes,
        instructor_id: s.instructor_id ?? null,
        instructor_name: instructorName,
        location: s.location ?? template?.location ?? null,
        is_public: isPublic,
        room_name: roomName,
        is_online: isOnline,
        event_type: isRoomOnly
          ? ("room_booking" as const)
          : ("class" as const),
        price_cents: s.price_cents ?? template?.price_cents ?? null,
      };
    });

    // Sort (should already be sorted by DB, but ensure merge order)
    formattedSessions.sort((a, b) => {
      if (a.session_date !== b.session_date)
        return a.session_date.localeCompare(b.session_date);
      return a.start_time.localeCompare(b.start_time);
    });

    return NextResponse.json({
      sessions: formattedSessions,
      confirmedCounts: confirmedMap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
