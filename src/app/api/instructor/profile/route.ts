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
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        )
      : serverSupabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const { data: instructor } = await supabase
      .from("instructors")
      .select("bio, specialties")
      .eq("profile_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      bio: instructor?.bio ?? "",
      specialties: instructor?.specialties ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        )
      : serverSupabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "instructor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { full_name, bio, specialties } = body;

    if (full_name !== undefined) {
      await supabase
        .from("profiles")
        .update({ full_name: full_name ?? null })
        .eq("id", user.id);
    }

    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (instructor && (bio !== undefined || specialties !== undefined)) {
      const updates: { bio?: string | null; specialties?: string[] | null } = {};
      if (bio !== undefined) updates.bio = bio || null;
      if (specialties !== undefined) {
        updates.specialties = Array.isArray(specialties)
          ? specialties.filter(Boolean)
          : specialties
            ? [String(specialties)]
            : null;
      }
      await supabase
        .from("instructors")
        .update(updates)
        .eq("id", instructor.id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
