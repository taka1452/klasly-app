import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/member/instructor/[id]
 * Returns public instructor info (name, bio, specialties) for member view.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instructorId } = await params;
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

    // Verify user belongs to a studio
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: instructor } = await supabase
      .from("instructors")
      .select("id, bio, specialties, studio_id, profiles(full_name)")
      .eq("id", instructorId)
      .single();

    if (!instructor || instructor.studio_id !== profile.studio_id) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 }
      );
    }

    const rawProfile = Array.isArray(instructor.profiles)
      ? instructor.profiles[0]
      : instructor.profiles;
    const p = rawProfile as { full_name?: string } | null;

    return NextResponse.json({
      id: instructor.id,
      full_name: p?.full_name ?? "Instructor",
      bio: instructor.bio ?? null,
      specialties: (instructor.specialties as string[] | null) ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
