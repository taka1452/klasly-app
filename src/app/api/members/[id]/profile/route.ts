import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
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
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: member } = await supabase
      .from("members")
      .select("*, profiles(id, full_name, email, phone)")
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

    const rawProfile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    const p = rawProfile as { id?: string; full_name?: string; email?: string; phone?: string } | null;

    // Classes count: bookings + drop_ins with attended
    const { count: bookedCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("attended", true);
    const { count: dropInCount } = await supabase
      .from("drop_in_attendances")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId);
    const classesCount = (bookedCount ?? 0) + (dropInCount ?? 0);

    // Last class (most recent attended)
    const { data: lastBooked } = await supabase
      .from("bookings")
      .select("class_sessions(session_date, start_time)")
      .eq("member_id", memberId)
      .eq("attended", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const { data: lastDropIn } = await supabase
      .from("drop_in_attendances")
      .select("attended_at")
      .eq("member_id", memberId)
      .order("attended_at", { ascending: false })
      .limit(1)
      .single();

    let lastClass: { date: string; time: string } | null = null;
    if (lastBooked?.class_sessions) {
      const cs = lastBooked.class_sessions as { session_date?: string; start_time?: string };
      const arr = Array.isArray(cs) ? cs[0] : cs;
      if (arr?.session_date) {
        lastClass = {
          date: arr.session_date,
          time: arr.start_time ?? "00:00",
        };
      }
    }
    if (lastDropIn?.attended_at && !lastClass) {
      const d = new Date(lastDropIn.attended_at);
      lastClass = {
        date: d.toISOString().split("T")[0],
        time: d.toTimeString().slice(0, 5),
      };
    } else if (lastDropIn?.attended_at && lastClass) {
      const d = new Date(lastDropIn.attended_at);
      const dropInDate = d.toISOString().split("T")[0];
      const dropInTime = d.toTimeString().slice(0, 5);
      const existing = new Date(lastClass.date + "T" + lastClass.time).getTime();
      if (d.getTime() > existing) {
        lastClass = { date: dropInDate, time: dropInTime };
      }
    }

    // Next billing: from payments due_date (upcoming monthly)
    const today = new Date().toISOString().split("T")[0];
    const { data: nextPayment } = await supabase
      .from("payments")
      .select("due_date, amount")
      .eq("member_id", memberId)
      .gte("due_date", today)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(1)
      .single();

    // Months since joined
    const joined = new Date(member.joined_at);
    const now = new Date();
    const months = Math.max(
      1,
      (now.getFullYear() - joined.getFullYear()) * 12 +
        (now.getMonth() - joined.getMonth()) + 1
    );

    return NextResponse.json({
      member: {
        id: member.id,
        profile_id: p?.id ?? null,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "—",
        phone: p?.phone ?? "—",
        plan_type: member.plan_type,
        credits: member.credits,
        status: member.status,
        waiver_signed: member.waiver_signed ?? false,
        waiver_signed_at: member.waiver_signed_at ?? null,
        joined_at: member.joined_at,
        classes_count: classesCount,
        last_class: lastClass,
        next_billing: nextPayment
          ? {
              date: nextPayment.due_date,
              amount: nextPayment.amount,
            }
          : null,
        months,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
