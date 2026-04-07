import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateICalFeed } from "@/lib/calendar/ical";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get studio name
  const { data: studio } = await supabase
    .from("studios")
    .select("name")
    .eq("id", studioId)
    .single();

  if (!studio) {
    return new NextResponse("Studio not found", { status: 404 });
  }

  // Get upcoming sessions (next 8 weeks)
  const today = new Date().toISOString().split("T")[0];
  const eightWeeks = new Date();
  eightWeeks.setDate(eightWeeks.getDate() + 56);
  const endDate = eightWeeks.toISOString().split("T")[0];

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select(`
      id,
      session_date,
      start_time,
      is_cancelled,
      classes (name, duration_minutes)
    `)
    .eq("studio_id", studioId)
    .gte("session_date", today)
    .lte("session_date", endDate)
    .eq("is_cancelled", false)
    .order("session_date", { ascending: true });

  const events = (sessions || []).map((s) => {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
    const className = (cls as { name?: string })?.name || "Class";
    const duration = (cls as { duration_minutes?: number })?.duration_minutes || 60;

    return {
      uid: `${s.id}@klasly.app`,
      summary: className,
      dtstart: s.session_date,
      startTime: s.start_time?.slice(0, 5) || "09:00",
      durationMinutes: duration,
    };
  });

  const ical = generateICalFeed(`${studio.name} Schedule`, events);

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${studio.name.replace(/[^a-zA-Z0-9]/g, "_")}_schedule.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
