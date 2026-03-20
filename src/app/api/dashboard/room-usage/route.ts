import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/room-usage?date=YYYY-MM-DD
 * Returns all room bookings AND class sessions with rooms assigned for a given date,
 * grouped by room. For the owner/manager room timeline view.
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ rooms: [], events: [] });
    }
    if (profile.role !== "owner" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studioId = profile.studio_id;

    // Fetch all active rooms
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name, capacity")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    // Fetch room bookings for the date
    type RBRow = {
      id: string;
      room_id: string;
      title: string;
      start_time: string;
      end_time: string;
      is_public: boolean;
      recurrence_group_id: string | null;
      instructors?: { profiles?: { full_name?: string } } | null;
    };

    const { data: roomBookings } = await supabase
      .from("instructor_room_bookings")
      .select("id, room_id, title, start_time, end_time, is_public, recurrence_group_id, instructors(profiles(full_name))")
      .eq("studio_id", studioId)
      .eq("booking_date", date)
      .eq("status", "confirmed");

    // Fetch class sessions with rooms for the date
    type CSRow = {
      id: string;
      start_time: string;
      is_cancelled: boolean;
      classes?: {
        name?: string;
        duration_minutes?: number;
        room_id?: string | null;
        is_public?: boolean;
        instructors?: { profiles?: { full_name?: string } };
      };
    };

    const { data: classSessions } = await supabase
      .from("class_sessions")
      .select("id, start_time, is_cancelled, classes(name, duration_minutes, room_id, is_public, instructors(profiles(full_name)))")
      .eq("studio_id", studioId)
      .eq("session_date", date)
      .eq("is_cancelled", false);

    // Build events array with event_type
    type RoomEvent = {
      id: string;
      room_id: string;
      title: string;
      start_time: string;
      end_time: string;
      instructor_name: string;
      event_type: "room_booking" | "class";
      is_public: boolean;
      recurring: boolean;
    };

    const events: RoomEvent[] = [];

    // Room bookings
    for (const rb of (roomBookings ?? []) as RBRow[]) {
      const instr = rb.instructors;
      const rawInstr = Array.isArray(instr) ? instr[0] : instr;
      events.push({
        id: rb.id,
        room_id: rb.room_id,
        title: rb.title || "Room Booking",
        start_time: rb.start_time,
        end_time: rb.end_time,
        instructor_name: rawInstr?.profiles?.full_name ?? "",
        event_type: "room_booking",
        is_public: rb.is_public,
        recurring: !!rb.recurrence_group_id,
      });
    }

    // Class sessions with rooms
    for (const cs of (classSessions ?? []) as CSRow[]) {
      const cls = cs.classes;
      if (!cls?.room_id) continue; // Skip classes without rooms
      const rawInstr = cls.instructors;
      const instrName = Array.isArray(rawInstr)
        ? (rawInstr as { profiles?: { full_name?: string } }[])[0]?.profiles?.full_name
        : rawInstr?.profiles?.full_name;

      const duration = cls.duration_minutes ?? 60;
      const [h, m] = cs.start_time.split(":").map(Number);
      const endMin = h * 60 + m + duration;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

      events.push({
        id: cs.id,
        room_id: cls.room_id,
        title: cls.name ?? "Class",
        start_time: cs.start_time,
        end_time: endTime,
        instructor_name: instrName ?? "",
        event_type: "class",
        is_public: cls.is_public ?? true,
        recurring: false,
      });
    }

    // Deduplicate: if room booking + class overlap on same room by same instructor, keep class only
    const classEvents = events.filter((e) => e.event_type === "class");
    const rbEvents = events.filter((e) => e.event_type === "room_booking");
    const matchedRbIds = new Set<string>();

    for (const cls of classEvents) {
      for (const rb of rbEvents) {
        if (matchedRbIds.has(rb.id)) continue;
        if (cls.room_id !== rb.room_id) continue;
        if (cls.instructor_name !== rb.instructor_name) continue;
        // Time overlap
        const parseMin = (t: string) => { const [hh, mm] = t.split(":").map(Number); return hh * 60 + mm; };
        if (parseMin(cls.start_time) < parseMin(rb.end_time) && parseMin(cls.end_time) > parseMin(rb.start_time)) {
          matchedRbIds.add(rb.id);
        }
      }
    }

    const dedupedEvents = events.filter((e) => !(e.event_type === "room_booking" && matchedRbIds.has(e.id)));

    return NextResponse.json({
      rooms: rooms ?? [],
      events: dedupedEvents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
