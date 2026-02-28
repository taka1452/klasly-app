import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

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

    if (profile?.role !== "owner" || !profile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from("class_sessions")
      .select("studio_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const { data: excludedBooking } = await supabase
      .from("bookings")
      .select("member_id")
      .eq("session_id", sessionId)
      .eq("status", "confirmed");

    const { data: excludedDropIn } = await supabase
      .from("drop_in_attendances")
      .select("member_id")
      .eq("session_id", sessionId);

    const excludedIds = new Set([
      ...(excludedBooking || []).map((b) => b.member_id),
      ...(excludedDropIn || []).map((d) => d.member_id),
    ]);

    let query = supabase
      .from("members")
      .select("id, plan_type, credits, profiles(full_name)")
      .eq("studio_id", profile.studio_id)
      .eq("status", "active");

    const { data: members } = await query;

    let filtered = (members || []).filter((m) => !excludedIds.has(m.id));

    if (q) {
      filtered = filtered.filter((m) => {
        const profiles = m.profiles as { full_name?: string } | null;
        const raw = Array.isArray(profiles) ? profiles[0] : profiles;
        const name = (raw?.full_name ?? "").toLowerCase();
        return name.includes(q);
      });
    }

    const result = filtered.slice(0, 20).map((m) => {
      const profiles = m.profiles as { full_name?: string } | null;
      const raw = Array.isArray(profiles) ? profiles[0] : profiles;
      return {
        id: m.id,
        full_name: raw?.full_name ?? "—",
        plan_type: m.plan_type,
        credits: m.credits,
      };
    });

    return NextResponse.json({ members: result });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
