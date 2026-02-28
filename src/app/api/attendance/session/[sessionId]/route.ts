import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = serviceRoleKey
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        )
      : serverSupabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile.role !== "owner" && profile.role !== "instructor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: session } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time, capacity, class_id, studio_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const { data: classData } = await supabase
      .from("classes")
      .select("name")
      .eq("id", session.class_id)
      .single();

    const class_name = classData?.name ?? "—";

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        `
        id,
        attended,
        credit_deducted,
        member_id,
        members (
          plan_type,
          credits,
          profiles (full_name)
        )
      `
      )
      .eq("session_id", sessionId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    const booked = (bookings || []).map((b) => {
      const members = b.members as {
        plan_type?: string;
        credits?: number;
        profiles?: { full_name?: string };
      } | null;
      const raw = Array.isArray(members) ? members[0] : members;
      const profiles = raw?.profiles;
      const pf = Array.isArray(profiles) ? profiles[0] : profiles;
      return {
        booking_id: b.id,
        member_id: b.member_id,
        member_name: pf?.full_name || "—",
        plan_type: raw?.plan_type || "drop_in",
        credits: raw?.credits ?? 0,
        attended: b.attended ?? false,
        credit_deducted: b.credit_deducted ?? false,
      };
    });

    const { data: dropIns } = await supabase
      .from("drop_in_attendances")
      .select(
        `
        id,
        attended_at,
        credit_deducted,
        member_id,
        members (
          plan_type,
          credits,
          profiles (full_name)
        )
      `
      )
      .eq("session_id", sessionId)
      .order("attended_at", { ascending: true });

    const drop_ins = (dropIns || []).map((d) => {
      const members = d.members as {
        plan_type?: string;
        credits?: number;
        profiles?: { full_name?: string };
      } | null;
      const raw = Array.isArray(members) ? members[0] : members;
      const profiles = raw?.profiles;
      const pf = Array.isArray(profiles) ? profiles[0] : profiles;
      return {
        drop_in_id: d.id,
        member_id: d.member_id,
        member_name: pf?.full_name || "—",
        plan_type: raw?.plan_type || "drop_in",
        credits: raw?.credits ?? 0,
        attended_at: d.attended_at,
        credit_deducted: d.credit_deducted ?? false,
      };
    });

    const booked_attended = booked.filter((b) => b.attended).length;
    const drop_in_attended = drop_ins.length;
    const total_attended = booked_attended + drop_in_attended;
    const total_booked = booked.length;

    const startTime =
      typeof session.start_time === "string" && session.start_time.length >= 5
        ? session.start_time.slice(0, 5)
        : "00:00";

    return NextResponse.json({
      session: {
        id: session.id,
        class_id: session.class_id,
        class_name,
        session_date: session.session_date,
        start_time: startTime,
        capacity: session.capacity,
      },
      booked,
      drop_ins,
      summary: {
        total_booked,
        booked_attended,
        drop_in_attended,
        total_attended,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
