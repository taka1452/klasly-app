import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns sessions with class info, room bookings, and confirmed booking counts
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

    // ── Fetch class sessions ──
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

    // Format class sessions
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
      event_type: "class" as const,
    }));

    // ── Fetch room bookings ──
    type RoomBookingRow = {
      id: string;
      title: string;
      booking_date: string;
      start_time: string;
      end_time: string;
      is_public: boolean;
      status: string;
      rooms?: { name?: string } | null;
      instructors?: {
        profiles?: { full_name?: string };
      } | null;
    };

    const { data: roomBookings } = await supabase
      .from("instructor_room_bookings")
      .select(
        "id, title, booking_date, start_time, end_time, is_public, status, rooms(name), instructors(profiles(full_name))",
      )
      .eq("studio_id", studioId)
      .eq("status", "confirmed")
      .gte("booking_date", start)
      .lte("booking_date", end)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });

    const typedRoomBookings = (roomBookings ?? []) as RoomBookingRow[];

    // Format room bookings as calendar events
    const formattedRoomBookings = typedRoomBookings.map((rb) => {
      // Calculate duration from start_time and end_time (HH:MM:SS format)
      const [sh, sm] = rb.start_time.split(":").map(Number);
      const [eh, em] = rb.end_time.split(":").map(Number);
      const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

      const room = rb.rooms;
      const roomName = Array.isArray(room) ? room[0]?.name : room?.name || null;
      const instr = rb.instructors;
      const rawInstr = Array.isArray(instr) ? instr[0] : instr;

      return {
        id: rb.id,
        class_id: rb.id, // use booking id for navigation key
        session_date: rb.booking_date,
        start_time: rb.start_time,
        capacity: 1,
        is_cancelled: false,
        class_name: rb.title || "Room Booking",
        duration_minutes: durationMinutes > 0 ? durationMinutes : 60,
        instructor_name: rawInstr?.profiles?.full_name ?? "",
        location: null,
        is_public: rb.is_public,
        room_name: roomName,
        is_online: false,
        event_type: "room_booking" as const,
      };
    });

    // ── Deduplicate: if a room booking overlaps with a class session
    // by the same instructor on the same date, merge them (show class only,
    // attach room name from the booking if the class doesn't have one) ──
    const matchedRoomBookingIds = new Set<string>();

    for (const session of formattedSessions) {
      if (!session.instructor_name) continue;

      for (const rb of formattedRoomBookings) {
        if (matchedRoomBookingIds.has(rb.id)) continue;
        if (rb.session_date !== session.session_date) continue;
        if (rb.instructor_name !== session.instructor_name) continue;

        // Check time overlap: session start_time within room booking window
        // Parse times as minutes for comparison
        const parseMin = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
        const sessStart = parseMin(session.start_time);
        const sessEnd = sessStart + session.duration_minutes;
        const rbStart = parseMin(rb.start_time);
        const rbEnd = rbStart + rb.duration_minutes;

        // Overlap check
        if (sessStart < rbEnd && sessEnd > rbStart) {
          matchedRoomBookingIds.add(rb.id);
          // Attach room name to class if missing
          if (!session.room_name && rb.room_name) {
            session.room_name = rb.room_name;
          }
        }
      }
    }

    // Filter out room bookings that were matched to a class session
    const standaloneRoomBookings = formattedRoomBookings.filter(
      (rb) => !matchedRoomBookingIds.has(rb.id),
    );

    // Merge and sort
    const allEvents = [...formattedSessions, ...standaloneRoomBookings].sort(
      (a, b) => {
        if (a.session_date !== b.session_date)
          return a.session_date.localeCompare(b.session_date);
        return a.start_time.localeCompare(b.start_time);
      },
    );

    return NextResponse.json({
      sessions: allEvents,
      confirmedCounts: confirmedMap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
