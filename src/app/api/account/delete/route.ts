import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
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
        { error: "Only studio owners can delete their account" },
        { status: 403 }
      );
    }

    const studioId = profile.studio_id;

    // Get all user IDs (profiles) for this studio before deletion
    const { data: studioProfiles } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("studio_id", studioId);
    const userIdsToDelete = (studioProfiles || []).map((p) => p.id);

    // Delete in order (respecting FK constraints)
    await adminSupabase.from("bookings").delete().eq("studio_id", studioId);
    await adminSupabase.from("payments").delete().eq("studio_id", studioId);
    await adminSupabase.from("class_sessions").delete().eq("studio_id", studioId);
    await adminSupabase.from("classes").delete().eq("studio_id", studioId);
    await adminSupabase.from("members").delete().eq("studio_id", studioId);
    await adminSupabase.from("instructors").delete().eq("studio_id", studioId);
    await adminSupabase.from("profiles").delete().eq("studio_id", studioId);
    await adminSupabase.from("studios").delete().eq("id", studioId);

    // Delete auth users
    for (const uid of userIdsToDelete) {
      await adminSupabase.auth.admin.deleteUser(uid);
    }

    // Sign out the current user
    await serverSupabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
