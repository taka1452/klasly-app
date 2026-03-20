import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/instructor/room-availability?date=YYYY-MM-DD
 * Returns all rooms + sessions (classes & room bookings) for the day
 * from the unified class_sessions table.
 * Own bookings show full detail; others show only "Booked" with time.
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
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "date query param required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    // Get profile to find studio and role
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ rooms: [], events: [] });
    }

    const studioId = profile.studio_id;

    // Get instructor record (may be null for owner/manager without instructor record)
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    const instructorId = instructor?.id ?? "";
    const isOwnerOrManager =
      profile.role === "owner" || profile.role === "manager";

    // Active rooms
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name, capacity")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    // Fetch all sessions with a room for this date from the unified table
    type SessionRow = {
      id: string;
      room_id: string | null;
      instructor_id: string | null;
      start_time: string;
      end_time: string | null;
      duration_minutes: number | null;
      is_cancelled: boolean;
      title: string | null;
      session_type: string;
      is_online?: boolean;
      recurrence_group_id: string | null;
      class_templates?: {
        name?: string;
        duration_minutes?: number;
      } | null;
    };

    const { data: sessions } = await supabase
      .from("class_sessions")
      .select(
        `
        id, room_id, instructor_id, start_time, end_time, duration_minutes,
        is_cancelled, title, session_type, is_online, recurrence_group_id,
        class_templates (name, duration_minutes)
      `,
      )
      .eq("studio_id", studioId)
      .eq("session_date", date)
      .eq("is_cancelled", false)
      .not("room_id", "is", null);

    // Build events
    type AvailEvent = {
      id: string;
      room_id: string;
      start_time: string;
      end_time: string;
      title: string;
      is_own: boolean;
      event_type: "room_booking" | "class";
      is_public: boolean;
      recurring: boolean;
    };

    const events: AvailEvent[] = [];

    for (const s of (sessions ?? []) as SessionRow[]) {
      if (!s.room_id) continue;

      const isRoomOnly = s.session_type === "room_only";
      const template = s.class_templates;
      const isOwn = s.instructor_id === instructorId;

      // Compute end_time
      let endTime = s.end_time;
      if (!endTime) {
        const duration =
          s.duration_minutes ?? template?.duration_minutes ?? 60;
        const [h, m] = s.start_time.split(":").map(Number);
        const endMin = h * 60 + m + duration;
        const endH = Math.floor(endMin / 60);
        const endM = endMin % 60;
        endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
      }

      // Determine title based on ownership/role
      let title: string;
      if (isOwn || isOwnerOrManager) {
        title = isRoomOnly
          ? s.title || "Room Booking"
          : template?.name ?? s.title ?? "Class";
      } else {
        title = "Booked";
      }

      events.push({
        id: s.id,
        room_id: s.room_id,
        start_time: s.start_time,
        end_time: endTime,
        title,
        is_own: isOwn,
        event_type: isRoomOnly ? "room_booking" : "class",
        is_public: !s.is_online,
        recurring: !!s.recurrence_group_id,
      });
    }

    return NextResponse.json({
      rooms: rooms ?? [],
      events,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
