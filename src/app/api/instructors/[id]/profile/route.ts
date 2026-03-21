import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    // owner, manager, instructor のみ閲覧可能（member はアクセス不可）
    const allowedRoles = ["owner", "manager", "instructor"];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: instructor } = await supabase
      .from("instructors")
      .select("*, profiles(full_name, email, phone)")
      .eq("id", instructorId)
      .single();

    if (!instructor) {
      return NextResponse.json(
        { error: "Instructor not found" },
        { status: 404 }
      );
    }

    if (instructor.studio_id !== profile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawProfile = Array.isArray(instructor.profiles)
      ? instructor.profiles[0]
      : instructor.profiles;
    const p = rawProfile as { full_name?: string; email?: string; phone?: string } | null;
    const specialties = instructor.specialties as string[] | null;

    const { count: classesCount } = await supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", instructorId)
      .eq("is_active", true);

    return NextResponse.json({
      instructor: {
        id: instructor.id,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "—",
        phone: p?.phone ?? "—",
        bio: instructor.bio ?? null,
        specialties: specialties ?? [],
        classes_count: classesCount ?? 0,
        created_at: instructor.created_at,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
