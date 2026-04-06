import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/attendance-history?months=6
 * Returns attendance history grouped by month with class breakdown.
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
    const months = Math.min(parseInt(searchParams.get("months") || "6", 10), 12);

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
      : serverSupabase;

    // Get member
    const { data: member } = await supabase
      .from("members")
      .select("id, studio_id")
      .eq("profile_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ history: [], summary: { total: 0, monthlyBreakdown: [], topClasses: [] } });
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startStr = startDate.toISOString().split("T")[0];

    // Fetch attended bookings
    const { data: attendedBookings } = await supabase
      .from("bookings")
      .select(`
        id,
        attended,
        class_sessions (
          session_date,
          start_time,
          classes (id, name)
        )
      `)
      .eq("member_id", member.id)
      .eq("attended", true)
      .gte("class_sessions.session_date", startStr)
      .order("created_at", { ascending: false });

    // Fetch drop-in attendances
    const { data: dropIns } = await supabase
      .from("drop_in_attendances")
      .select(`
        id,
        created_at,
        class_sessions (
          session_date,
          start_time,
          classes (id, name)
        )
      `)
      .eq("member_id", member.id)
      .gte("created_at", startStr);

    // Combine and process
    type AttendanceRecord = {
      date: string;
      className: string;
      classId: string;
      time: string;
      type: "booking" | "drop_in";
    };

    const records: AttendanceRecord[] = [];

    (attendedBookings || []).forEach((b) => {
      const raw = b.class_sessions as unknown;
      const session = (Array.isArray(raw) ? raw[0] : raw) as {
        session_date?: string;
        start_time?: string;
        classes?: { id?: string; name?: string };
      } | null;
      if (!session?.session_date) return;
      const cls = session.classes && !Array.isArray(session.classes) ? session.classes : null;
      records.push({
        date: session.session_date,
        className: cls?.name || "Class",
        classId: cls?.id || "",
        time: session.start_time || "",
        type: "booking",
      });
    });

    (dropIns || []).forEach((d) => {
      const raw = d.class_sessions as unknown;
      const session = (Array.isArray(raw) ? raw[0] : raw) as {
        session_date?: string;
        start_time?: string;
        classes?: { id?: string; name?: string };
      } | null;
      if (!session?.session_date) return;
      const cls = session.classes && !Array.isArray(session.classes) ? session.classes : null;
      records.push({
        date: session.session_date,
        className: cls?.name || "Class",
        classId: cls?.id || "",
        time: session.start_time || "",
        type: "drop_in",
      });
    });

    // Sort by date descending
    records.sort((a, b) => b.date.localeCompare(a.date));

    // Monthly breakdown
    const monthlyMap: Record<string, number> = {};
    const classCountMap: Record<string, { name: string; count: number }> = {};

    records.forEach((r) => {
      const month = r.date.slice(0, 7);
      monthlyMap[month] = (monthlyMap[month] || 0) + 1;

      if (r.classId) {
        if (!classCountMap[r.classId]) {
          classCountMap[r.classId] = { name: r.className, count: 0 };
        }
        classCountMap[r.classId].count += 1;
      }
    });

    const monthlyBreakdown = Object.entries(monthlyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, count]) => ({ month, count }));

    const topClasses = Object.values(classCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      history: records,
      summary: {
        total: records.length,
        monthlyBreakdown,
        topClasses,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
