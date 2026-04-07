import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { favoriteType, targetId } = await req.json();

  if (!favoriteType || !targetId || !["class", "instructor"].includes(favoriteType)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Toggle: check if exists
  const { data: existing } = await supabase
    .from("member_favorites")
    .select("id")
    .eq("member_id", member.id)
    .eq("favorite_type", favoriteType)
    .eq("target_id", targetId)
    .single();

  if (existing) {
    // Remove favorite
    await supabase.from("member_favorites").delete().eq("id", existing.id);
    return NextResponse.json({ favorited: false });
  }

  // Add favorite
  const { error } = await supabase.from("member_favorites").insert({
    studio_id: member.studio_id,
    member_id: member.id,
    favorite_type: favoriteType,
    target_id: targetId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorited: true });
}

export async function GET(req: Request) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: favorites } = await supabase
    .from("member_favorites")
    .select("id, favorite_type, target_id")
    .eq("member_id", member.id);

  return NextResponse.json({ favorites: favorites || [] });
}
