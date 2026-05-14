import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const allowedRoles = ["instructor", "owner", "manager"];
    if (!profile?.studio_id || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the instructor record for this user. Without it, we cannot scope
    // PII to "members the instructor has actually taught".
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .maybeSingle();

    if (!instructor) {
      return NextResponse.json({ members: [] });
    }

    // Sessions taught by this instructor (in this studio).
    const { data: instructorSessions } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("instructor_id", instructor.id)
      .eq("studio_id", profile.studio_id);

    const sessionIds = (instructorSessions ?? []).map((s) => s.id);
    if (sessionIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // Members who have a booking against any of those sessions.
    const { data: bookings } = await supabase
      .from("bookings")
      .select("member_id")
      .in("session_id", sessionIds);

    const memberIds = Array.from(
      new Set(
        (bookings ?? [])
          .map((b) => (b as { member_id?: string }).member_id)
          .filter((id): id is string => !!id)
      )
    );

    if (memberIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const { data: members } = await supabase
      .from("members")
      .select("id, profiles(full_name, email)")
      .in("id", memberIds)
      .eq("studio_id", profile.studio_id)
      .eq("status", "active");

    const result = (members || []).map((m) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        id: m.id,
        name: (prof as { full_name?: string })?.full_name || "Unknown",
        email: (prof as { email?: string })?.email || "",
      };
    });

    return NextResponse.json({ members: result });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
