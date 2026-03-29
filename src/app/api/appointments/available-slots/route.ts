import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

/**
 * GET: Available appointment slots for an instructor on a given date
 * Query params: instructor_id, date (YYYY-MM-DD), appointment_type_id
 */
export async function GET(request: Request) {
  try {
    // Auth check
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();

    // Get user profile to verify same studio
    const { data: profile } = await adminDb
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await isFeatureEnabled(profile.studio_id, FEATURE_KEYS.APPOINTMENTS);
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get("instructor_id");
    const date = searchParams.get("date");
    const appointmentTypeId = searchParams.get("appointment_type_id");

    if (!instructorId || !date || !appointmentTypeId) {
      return NextResponse.json(
        { error: "instructor_id, date, and appointment_type_id are required" },
        { status: 400 }
      );
    }

    // Verify instructor belongs to same studio
    const { data: instructor } = await adminDb
      .from("instructors")
      .select("id, studio_id")
      .eq("id", instructorId)
      .single();

    if (!instructor || instructor.studio_id !== profile.studio_id) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    // Get appointment type
    const { data: appointmentType } = await adminDb
      .from("appointment_types")
      .select("id, duration_minutes, buffer_minutes")
      .eq("id", appointmentTypeId)
      .eq("studio_id", profile.studio_id)
      .single();

    if (!appointmentType) {
      return NextResponse.json({ error: "Appointment type not found" }, { status: 404 });
    }

    const durationMinutes = appointmentType.duration_minutes;
    const bufferMinutes = appointmentType.buffer_minutes ?? 0;
    const totalBlock = durationMinutes + bufferMinutes;

    // Get day of week for the requested date (0=Sun, 1=Mon, ..., 6=Sat)
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();

    // 1. Get instructor availability for this day
    const { data: availability } = await adminDb
      .from("instructor_availability")
      .select("start_time, end_time")
      .eq("instructor_id", instructorId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .order("start_time");

    if (!availability || availability.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    // 2. Get existing confirmed appointments for this instructor + date
    const { data: existingAppointments } = await adminDb
      .from("appointments")
      .select("start_time, end_time")
      .eq("instructor_id", instructorId)
      .eq("appointment_date", date)
      .in("status", ["confirmed", "pending"]);

    // 3. Get existing class sessions for this instructor + date
    const { data: existingSessions } = await adminDb
      .from("class_sessions")
      .select("start_time, end_time")
      .eq("instructor_id", instructorId)
      .eq("session_date", date)
      .neq("status", "cancelled");

    // Build list of busy intervals as [startMin, endMin] (minutes from midnight)
    const busyIntervals: Array<[number, number]> = [];

    if (existingAppointments) {
      for (const apt of existingAppointments) {
        busyIntervals.push([timeToMinutes(apt.start_time), timeToMinutes(apt.end_time)]);
      }
    }

    if (existingSessions) {
      for (const session of existingSessions) {
        busyIntervals.push([timeToMinutes(session.start_time), timeToMinutes(session.end_time)]);
      }
    }

    // 5. Generate available time slots (every 15 min)
    const SLOT_INTERVAL = 15;
    const availableSlots: Array<{ start_time: string; end_time: string }> = [];

    for (const avail of availability) {
      const availStart = timeToMinutes(avail.start_time);
      const availEnd = timeToMinutes(avail.end_time);

      for (let slotStart = availStart; slotStart + totalBlock <= availEnd; slotStart += SLOT_INTERVAL) {
        const slotEnd = slotStart + durationMinutes;

        // Check if this slot (with buffer) overlaps any busy interval
        const slotWithBuffer = slotStart + totalBlock;
        const overlaps = busyIntervals.some(
          ([busyStart, busyEnd]) => slotStart < busyEnd && slotWithBuffer > busyStart
        );

        if (!overlaps) {
          availableSlots.push({
            start_time: minutesToTime(slotStart),
            end_time: minutesToTime(slotEnd),
          });
        }
      }
    }

    return NextResponse.json({ slots: availableSlots });
  } catch (err) {
    console.error("[Available Slots GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
