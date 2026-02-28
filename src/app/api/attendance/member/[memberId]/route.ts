import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
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

    const { data: member } = await supabase
      .from("members")
      .select("id, studio_id, plan_type, credits, profile_id")
      .eq("id", memberId)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (member.studio_id !== profile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile.role === "member") {
      const memberProfileId = member.profile_id;
      if (memberProfileId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", member.profile_id)
      .single();

    const member_name = (profiles as { full_name?: string })?.full_name ?? "—";

    const { data: bookedAttendances } = await supabase
      .from("bookings")
      .select(
        `
        credit_deducted,
        class_sessions (
          session_date,
          start_time,
          classes (name)
        )
      `
      )
      .eq("member_id", memberId)
      .eq("attended", true)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    const bookedHistory = (bookedAttendances || [])
      .filter((b) => b.class_sessions)
      .map((b) => {
        const cs = b.class_sessions as {
          session_date?: string;
          start_time?: string;
          classes?: { name?: string };
        } | null;
        const raw = Array.isArray(cs) ? cs[0] : cs;
        const classes = raw?.classes;
        const c = Array.isArray(classes) ? classes[0] : classes;
        return {
          date: raw?.session_date ?? "",
          class_name: c?.name ?? "—",
          start_time: raw?.start_time ?? "00:00",
          type: "booked" as const,
          credit_deducted: b.credit_deducted ?? false,
        };
      });

    const { data: dropInAttendances } = await supabase
      .from("drop_in_attendances")
      .select(
        `
        credit_deducted,
        class_sessions (
          session_date,
          start_time,
          classes (name)
        )
      `
      )
      .eq("member_id", memberId)
      .order("attended_at", { ascending: false });

    const dropInHistory = (dropInAttendances || [])
      .filter((d) => d.class_sessions)
      .map((d) => {
        const cs = d.class_sessions as {
          session_date?: string;
          start_time?: string;
          classes?: { name?: string };
        } | null;
        const raw = Array.isArray(cs) ? cs[0] : cs;
        const classes = raw?.classes;
        const c = Array.isArray(classes) ? classes[0] : classes;
        return {
          date: raw?.session_date ?? "",
          class_name: c?.name ?? "—",
          start_time: raw?.start_time ?? "00:00",
          type: "drop_in" as const,
          credit_deducted: d.credit_deducted ?? false,
        };
      });

    const history = [...bookedHistory, ...dropInHistory].sort((a, b) => {
      const da = new Date(a.date + "T" + (a.start_time || "00:00")).getTime();
      const db = new Date(b.date + "T" + (b.start_time || "00:00")).getTime();
      return db - da;
    });

    const total_attendances = history.length;

    return NextResponse.json({
      member: {
        id: member.id,
        name: member_name,
        plan_type: member.plan_type,
        credits: member.credits,
        total_attendances,
      },
      history,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
