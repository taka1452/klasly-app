import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/instructor/room-availability?date=YYYY-MM-DD
 * Returns all rooms + bookings/classes for the day.
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
    const isOwnerOrManager = profile.role === "owner" || profile.role === "manager";

    // Active rooms
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name, capacity")
      .eq("studio_id", studioId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    // Room bookings for this date
    const { data: roomBookings } = await supabase
      .from("instructor_room_bookings")
      .select(
        "id, room_id, title, start_time, end_time, is_public, instructor_id, recurrence_group_id",
      )
      .eq("studio_id", studioId)
      .eq("booking_date", date)
      .eq("status", "confirmed");

    // Class sessions with rooms for this date
    type CSRow = {
      id: string;
      start_time: string;
      is_cancelled: boolean;
      classes?: {
        name?: string;
        duration_minutes?: number;
        room_id?: string | null;
        instructor_id?: string | null;
      };
    };

    const { data: classSessions } = await supabase
      .from("class_sessions")
      .select(
        "id, start_time, is_cancelled, classes(name, duration_minutes, room_id, instructor_id)",
      )
      .eq("studio_id", studioId)
      .eq("session_date", date)
      .eq("is_cancelled", false);

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

    for (const rb of roomBookings ?? []) {
      const isOwn = rb.instructor_id === instructorId;
      events.push({
        id: rb.id,
        room_id: rb.room_id,
        start_time: rb.start_time,
        end_time: rb.end_time,
        // Owner/manager sees all titles; instructors only see own
        title: isOwn || isOwnerOrManager ? rb.title || "Room Booking" : "Booked",
        is_own: isOwn,
        event_type: "room_booking",
        is_public: rb.is_public,
        recurring: !!rb.recurrence_group_id,
      });
    }

    for (const cs of (classSessions ?? []) as CSRow[]) {
      const cls = cs.classes;
      if (!cls?.room_id) continue;

      const duration = cls.duration_minutes ?? 60;
      const [h, m] = cs.start_time.split(":").map(Number);
      const endMin = h * 60 + m + duration;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

      const isOwn = cls.instructor_id === instructorId;
      events.push({
        id: cs.id,
        room_id: cls.room_id,
        start_time: cs.start_time,
        end_time: endTime,
        title: isOwn || isOwnerOrManager ? cls.name ?? "Class" : "Booked",
        is_own: isOwn,
        event_type: "class",
        is_public: true,
        recurring: false,
      });
    }

    // Deduplicate: if same instructor has room booking + class at same time/room, keep class only
    const classEvts = events.filter((e) => e.event_type === "class");
    const rbEvts = events.filter((e) => e.event_type === "room_booking");
    const matchedRbIds = new Set<string>();

    const parseMin = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return hh * 60 + mm;
    };

    for (const cls of classEvts) {
      for (const rb of rbEvts) {
        if (matchedRbIds.has(rb.id)) continue;
        if (cls.room_id !== rb.room_id) continue;
        if (cls.is_own !== rb.is_own) continue;
        if (
          parseMin(cls.start_time) < parseMin(rb.end_time) &&
          parseMin(cls.end_time) > parseMin(rb.start_time)
        ) {
          matchedRbIds.add(rb.id);
        }
      }
    }

    const dedupedEvents = events.filter(
      (e) => !(e.event_type === "room_booking" && matchedRbIds.has(e.id)),
    );

    return NextResponse.json({
      rooms: rooms ?? [],
      events: dedupedEvents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
