import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studioId = searchParams.get("studioId");

  if (!studioId) {
    return NextResponse.json({ error: "studioId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: videos, error } = await supabase
    .from("video_content")
    .select(`
      id,
      title,
      description,
      thumbnail_url,
      duration,
      price,
      is_published,
      created_at,
      instructors (
        profiles (full_name)
      ),
      classes (name)
    `)
    .eq("studio_id", studioId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: videos || [] });
}

export async function POST(req: Request) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || !["owner", "instructor", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get instructor ID if applicable
  let instructorId = null;
  if (profile.role === "instructor") {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    instructorId = instructor?.id;
  }

  const { data, error } = await supabase.from("video_content").insert({
    studio_id: profile.studio_id,
    instructor_id: instructorId,
    class_id: body.classId || null,
    title: body.title,
    description: body.description || null,
    video_url: body.videoUrl,
    thumbnail_url: body.thumbnailUrl || null,
    duration: body.duration || null,
    price: body.price || 0,
    is_published: body.isPublished ?? false,
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
