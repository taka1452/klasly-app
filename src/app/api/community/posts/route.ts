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

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select(`
      id,
      title,
      content,
      author_role,
      created_at,
      profiles:author_id (full_name),
      community_comments (
        id,
        content,
        author_role,
        created_at,
        profiles:author_id (full_name)
      )
    `)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, content } = await req.json();

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio" }, { status: 403 });
  }

  // Only owner/instructor/manager can create posts
  if (!["owner", "instructor", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Not authorized to create posts" }, { status: 403 });
  }

  const { data, error } = await supabase.from("community_posts").insert({
    studio_id: profile.studio_id,
    author_id: user.id,
    author_role: profile.role,
    title: title.trim(),
    content: content.trim(),
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
