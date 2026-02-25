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
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json(
        { error: "Only studio owners can export data" },
        { status: 403 }
      );
    }

    const studioId = profile.studio_id;

    const [
      { data: studio },
      { data: members },
      { data: instructors },
      { data: classes },
      { data: classSessions },
      { data: bookings },
    ] = await Promise.all([
      adminSupabase.from("studios").select("*").eq("id", studioId).single(),
      adminSupabase
        .from("members")
        .select("*, profiles(full_name, email, phone)")
        .eq("studio_id", studioId),
      adminSupabase
        .from("instructors")
        .select("*, profiles(full_name, email, phone)")
        .eq("studio_id", studioId),
      adminSupabase.from("classes").select("*").eq("studio_id", studioId),
      adminSupabase
        .from("class_sessions")
        .select("*")
        .eq("studio_id", studioId),
      adminSupabase.from("bookings").select("*").eq("studio_id", studioId),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      studio,
      members: members || [],
      instructors: instructors || [],
      classes: classes || [],
      class_sessions: classSessions || [],
      bookings: bookings || [],
    };

    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="klasly-export.json"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
